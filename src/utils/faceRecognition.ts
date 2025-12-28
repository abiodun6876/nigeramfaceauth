import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import { supabase } from '../lib/supabase';

class FaceRecognition {
  private static instance: FaceRecognition;
  private modelsLoaded = false;
  
  private constructor() {}
  
  public static getInstance(): FaceRecognition {
    if (!FaceRecognition.instance) {
      FaceRecognition.instance = new FaceRecognition();
    }
    return FaceRecognition.instance;
  }
  
  async loadModels() {
    if (this.modelsLoaded) return;
    
    try {
      console.log('Loading face recognition models...');
      
      // Load face-api.js models
      await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      
      // Initialize TensorFlow.js backend
      await tf.ready();
      
      this.modelsLoaded = true;
      console.log('Face recognition models loaded successfully');
      
    } catch (error) {
      console.error('Failed to load face recognition models:', error);
      throw error;
    }
  }
  
  // Extract face descriptor from image
  async extractFaceDescriptor(imageData: string): Promise<Float32Array | null> {
    try {
      if (!this.modelsLoaded) {
        await this.loadModels();
      }
      
      // Convert base64 to HTMLImageElement
      const img = await this.base64ToImage(imageData);
      
      // Detect face and extract descriptor
      const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (!detection) {
        console.log('No face detected in image');
        return null;
      }
      
      return detection.descriptor;
      
    } catch (error) {
      console.error('Error extracting face descriptor:', error);
      return null;
    }
  }
  
  // Compare two face descriptors
  compareFaces(descriptor1: Float32Array, descriptor2: Float32Array): number {
    // Calculate Euclidean distance (lower = more similar)
    let distance = 0;
    for (let i = 0; i < descriptor1.length; i++) {
      distance += Math.pow(descriptor1[i] - descriptor2[i], 2);
    }
    distance = Math.sqrt(distance);
    
    // Convert distance to similarity score (0-1)
    // Typical face matching threshold is around 0.6
    const similarity = Math.max(0, 1 - (distance / 2));
    
    return similarity;
  }
  
  // Find best match from database
  async findBestMatch(
    capturedDescriptor: Float32Array, 
    storedDescriptors: Array<{studentId: string, descriptor: Float32Array}>
  ): Promise<{studentId: string | null, confidence: number}> {
    let bestMatch = { studentId: null as string | null, confidence: 0 };
    const MATCH_THRESHOLD = 0.65; // Adjust based on testing
    
    for (const stored of storedDescriptors) {
      const similarity = this.compareFaces(capturedDescriptor, stored.descriptor);
      
      if (similarity > MATCH_THRESHOLD && similarity > bestMatch.confidence) {
        bestMatch = {
          studentId: stored.studentId,
          confidence: similarity
        };
      }
    }
    
    return bestMatch;
  }
  
  // Helper: Convert base64 to Image
  private base64ToImage(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = base64;
    });
  }
  
  // Helper: Convert base64 to Float32Array for storage
  base64ToFloat32Array(base64: string): Float32Array {
    // Remove data URL prefix if present
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // Note: This is simplified. In practice, you'd want to store
    // the face descriptor (128 or 512 floats) not the image bytes
    return new Float32Array(bytes.buffer);
  }
  
  // Helper: Float32Array to base64 for storage
  float32ArrayToBase64(array: Float32Array): string {
    const bytes = new Uint8Array(array.buffer);
    let binary = '';
    
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  }
  
  // Optimized face matching for attendance
  async matchFaceForAttendance(
    capturedImage: string,
    maxMatches: number = 5
  ): Promise<Array<{studentId: string, name: string, confidence: number}>> {
    try {
      // 1. Extract face from captured image
      const capturedDescriptor = await this.extractFaceDescriptor(capturedImage);
      
      if (!capturedDescriptor) {
        throw new Error('No face detected in captured image');
      }
      
      // 2. Get all enrolled students with face data
      const { data: students } = await supabase
        .from('students')
        .select('student_id, name, photo_data, face_embedding')
        .eq('enrollment_status', 'enrolled')
        .not('photo_data', 'is', null)
        .limit(100); // Limit for performance
      
      if (!students || students.length === 0) {
        return [];
      }
      
      // 3. Extract or load descriptors for each student
      const matches = [];
      
      for (const student of students) {
        try {
          let storedDescriptor: Float32Array;
          
          if (student.face_embedding) {
            // Use pre-computed embedding if available
            storedDescriptor = new Float32Array(Object.values(student.face_embedding));
          } else if (student.photo_data) {
            // Extract descriptor from photo
            storedDescriptor = await this.extractFaceDescriptor(
              `data:image/jpeg;base64,${student.photo_data}`
            );
            
            if (storedDescriptor) {
              // Store the descriptor for future use
              await this.updateFaceEmbedding(student.student_id, storedDescriptor);
            }
          }
          
          if (storedDescriptor) {
            const similarity = this.compareFaces(capturedDescriptor, storedDescriptor);
            
            if (similarity > 0.6) { // Basic threshold
              matches.push({
                studentId: student.student_id,
                name: student.name,
                confidence: similarity
              });
            }
          }
        } catch (error) {
          console.error(`Error processing student ${student.student_id}:`, error);
          continue;
        }
      }
      
      // 4. Sort by confidence and return top matches
      return matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxMatches);
      
    } catch (error) {
      console.error('Error in face matching:', error);
      return [];
    }
  }
  
  // Update face embedding in database
  async updateFaceEmbedding(studentId: string, descriptor: Float32Array) {
    try {
      // Convert Float32Array to array for JSON storage
      const embeddingArray = Array.from(descriptor);
      
      await supabase
        .from('students')
        .update({
          face_embedding: embeddingArray,
          face_enrolled_at: new Date().toISOString()
        })
        .eq('student_id', studentId);
        
    } catch (error) {
      console.error('Error updating face embedding:', error);
    }
  }
}

export default FaceRecognition.getInstance();