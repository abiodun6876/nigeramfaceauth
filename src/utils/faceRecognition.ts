import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import { supabase } from '../lib/supabase';

class FaceRecognition {
  private static instance: FaceRecognition;
  private modelsLoaded = false;
  private useTinyModel = true; // Use tiny model for mobile
  
  // For local storage of embeddings
  private readonly EMBEDDINGS_KEY = 'face_embeddings';
  
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
      console.log('Loading face recognition models for mobile...');
      
      // FOR MOBILE: Use tiny models for better performance
      if (this.useTinyModel) {
        console.log('Using tiny face detector for mobile...');
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      } else {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
      }
      
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      
      // Configure TensorFlow.js for mobile
      await this.configureTensorFlowForMobile();
      
      this.modelsLoaded = true;
      console.log('Face recognition models loaded successfully on mobile');
      
    } catch (error) {
      console.error('Failed to load models on mobile:', error);
      // Try alternative loading strategy
      await this.loadModelsAlternative();
    }
  }
  
  private async configureTensorFlowForMobile() {
    // Optimize TensorFlow for mobile
    await tf.ready();
    
    // Set backend - try WebGL first, fall back to CPU
    const backends = ['webgl', 'cpu'];
    
    for (const backend of backends) {
      try {
        await tf.setBackend(backend);
        console.log(`TensorFlow backend set to: ${backend}`);
        break;
      } catch (err) {
        console.warn(`Failed to set backend ${backend}:`, err);
        continue;
      }
    }
    
    // Optimize for mobile
    tf.ENV.set('WEBGL_PACK', true);
    tf.ENV.set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
    
    console.log('TensorFlow ready. Backend:', tf.getBackend());
  }
  
  private async loadModelsAlternative() {
    console.log('Trying alternative model loading...');
    
    try {
      // Try loading from CDN as alternative
      const modelPath = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
      
      if (this.useTinyModel) {
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
      } else {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);
      }
      
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      
      this.modelsLoaded = true;
      console.log('Models loaded from CDN successfully');
      
    } catch (error) {
      console.error('Alternative loading also failed:', error);
      throw error;
    }
  }
  
  // ========== FACE EXTRACTION METHODS ==========
  
  async extractFaceDescriptor(imageData: string): Promise<Float32Array | null> {
    try {
      if (!this.modelsLoaded) {
        await this.loadModels();
      }
      
      // Convert base64 to HTMLImageElement
      const img = await this.base64ToImage(imageData);
      
      // MOBILE OPTIMIZATION: Use smaller input size
      const maxSize = 320; // Smaller for mobile
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      const resizedWidth = img.width * scale;
      const resizedHeight = img.height * scale;
      
      // Detect face with mobile-optimized settings
      let detection;
      
      if (this.useTinyModel) {
        detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
            inputSize: 160, // Smaller for mobile
            scoreThreshold: 0.5
          }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      } else {
        detection = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
      }
      
      if (!detection) {
        console.log('No face detected in image');
        return null;
      }
      
      console.log('Face detected successfully on mobile');
      return detection.descriptor;
      
    } catch (error) {
      console.error('Error extracting face descriptor on mobile:', error);
      
      // Check for specific mobile errors
      if (error.message.includes('WebGL')) {
        console.error('WebGL error - common on mobile. Check browser settings.');
      }
      
      return null;
    }
  }
  
  // Helper: Convert base64 to Image
  private base64ToImage(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = base64;
      img.crossOrigin = 'anonymous'; // Important for CORS
    });
  }
  
  // ========== FACE COMPARISON METHODS ==========
  
  // Compare two face descriptors
  compareFaces(descriptor1: Float32Array, descriptor2: Float32Array): number {
    // Calculate Euclidean distance (lower = more similar)
    let distance = 0;
    for (let i = 0; i < descriptor1.length; i++) {
      distance += Math.pow(descriptor1[i] - descriptor2[i], 2);
    }
    distance = Math.sqrt(distance);
    
    // Convert distance to similarity score (0-1)
    const similarity = Math.max(0, 1 - (distance / 2));
    
    return similarity;
  }
  
  // Find best match from database
  async findBestMatch(
    capturedDescriptor: Float32Array, 
    storedDescriptors: Array<{studentId: string, descriptor: Float32Array}>
  ): Promise<{studentId: string | null, confidence: number}> {
    let bestMatch = { studentId: null as string | null, confidence: 0 };
    const MATCH_THRESHOLD = 0.65;
    
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
  
  // ========== ATTENDANCE MATCHING METHODS ==========
  
  async matchFaceForAttendance(
    capturedImage: string,
    maxMatches: number = 5
  ): Promise<Array<{studentId: string, name: string, matric_number: string, confidence: number}>> {
    try {
      // 1. Extract face from captured image
      const capturedDescriptor = await this.extractFaceDescriptor(capturedImage);
      
      if (!capturedDescriptor) {
        console.log('No face detected in captured image');
        return [];
      }
      
      // 2. Get all enrolled students WITH face embeddings
      const { data: students, error } = await supabase
        .from('students')
        .select('student_id, name, matric_number, face_embedding')
        .eq('enrollment_status', 'enrolled')
        .not('face_embedding', 'is', null)
        .limit(50);
      
      if (error) {
        console.error('Database error:', error);
        return [];
      }
      
      if (!students || students.length === 0) {
        console.log('No students with face embeddings found');
        return [];
      }
      
      const matches = [];
      const MATCH_THRESHOLD = 0.65;
      
      // 3. Compare with each student's embedding
      for (const student of students) {
        try {
          if (!student.face_embedding || student.face_embedding.length === 0) {
            continue;
          }
          
          // Convert stored array back to Float32Array
          const storedDescriptor = new Float32Array(student.face_embedding);
          
          // Compare faces
          const similarity = this.compareFaces(capturedDescriptor, storedDescriptor);
          
          console.log(`Comparing with ${student.name}: ${similarity.toFixed(3)}`);
          
          if (similarity > MATCH_THRESHOLD) {
            matches.push({
              studentId: student.student_id,
              name: student.name,
              matric_number: student.matric_number,
              confidence: similarity
            });
          }
        } catch (error) {
          console.error(`Error processing student ${student.student_id}:`, error);
          continue;
        }
      }
      
      // 4. Sort by confidence and return top matches
      const sortedMatches = matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxMatches);
      
      console.log('Found matches:', sortedMatches.length);
      return sortedMatches;
      
    } catch (error) {
      console.error('Error in face matching:', error);
      return [];
    }
  }
  
  // ========== DATABASE METHODS ==========
  
  // Update face embedding in database
  async updateFaceEmbedding(studentId: string, descriptor: Float32Array) {
    try {
      // Convert Float32Array to array for JSON storage
      const embeddingArray = Array.from(descriptor);
      
      await supabase
        .from('students')
        .update({
          face_embedding: embeddingArray,
          last_face_update: new Date().toISOString()
        })
        .eq('student_id', studentId);
        
      console.log(`Face embedding updated for student ${studentId}`);
    } catch (error) {
      console.error('Error updating face embedding:', error);
    }
  }
  
  // Extract and save embedding for existing student
  async processExistingStudentPhoto(studentId: string, photoBase64: string) {
    try {
      const descriptor = await this.extractFaceDescriptor(photoBase64);
      
      if (descriptor) {
        await this.updateFaceEmbedding(studentId, descriptor);
        await this.saveEmbeddingToLocal(studentId, descriptor);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error processing existing student photo:', error);
      return false;
    }
  }
  
  // ========== LOCAL STORAGE METHODS ==========
  
  // Save an embedding to localStorage
  saveEmbeddingToLocal(studentId: string, descriptor: Float32Array): void {
    const embeddings = this.getEmbeddingsFromLocal();
    
    // Remove existing embedding for this student
    const filtered = embeddings.filter(e => e.studentId !== studentId);
    
    // Add new embedding (convert Float32Array to regular array for localStorage)
    const descriptorArray = Array.from(descriptor);
    filtered.push({ 
      studentId, 
      descriptor: descriptorArray,
      timestamp: new Date().toISOString() 
    });
    
    localStorage.setItem(this.EMBEDDINGS_KEY, JSON.stringify(filtered));
  }
  
  // Get all embeddings from localStorage (what syncService.ts expects)
  getEmbeddingsFromLocal(): Array<{
    studentId: string;
    descriptor: number[];
    timestamp: string;
  }> {
    const data = localStorage.getItem(this.EMBEDDINGS_KEY);
    return data ? JSON.parse(data) : [];
  }
  
  // Convert number[] back to Float32Array
  getEmbeddingForStudent(studentId: string): Float32Array | null {
    const embeddings = this.getEmbeddingsFromLocal();
    const found = embeddings.find(e => e.studentId === studentId);
    return found ? new Float32Array(found.descriptor) : null;
  }
  
  // Clear all local embeddings
  clearLocalEmbeddings(): void {
    localStorage.removeItem(this.EMBEDDINGS_KEY);
  }
  
  // Check if student has local embedding
  hasLocalEmbedding(studentId: string): boolean {
    return this.getEmbeddingForStudent(studentId) !== null;
  }
  
  // Sync local embeddings to Supabase
  async syncLocalEmbeddingsToDatabase(): Promise<Array<{
    studentId: string;
    descriptor: number[];
  }>> {
    const localEmbeddings = this.getEmbeddingsFromLocal();
    const syncedEmbeddings: Array<{studentId: string; descriptor: number[]}> = [];
    
    for (const embedding of localEmbeddings) {
      try {
        await this.updateFaceEmbedding(embedding.studentId, new Float32Array(embedding.descriptor));
        syncedEmbeddings.push(embedding);
      } catch (error) {
        console.error(`Failed to sync embedding for student ${embedding.studentId}:`, error);
      }
    }
      
    return syncedEmbeddings;
  }
  
  // ========== UTILITY METHODS ==========
  
  // Helper: Float32Array to base64 for storage
  float32ArrayToBase64(array: Float32Array): string {
    const bytes = new Uint8Array(array.buffer);
    let binary = '';
    
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  }
  
  // Helper: base64 to Float32Array for storage
  base64ToFloat32Array(base64: string): Float32Array {
    // Remove data URL prefix if present
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return new Float32Array(bytes.buffer);
  }
  
  // ========== DEBUG & STATUS METHODS ==========
  
  getStatus() {
    return {
      modelsLoaded: this.modelsLoaded,
      useTinyModel: this.useTinyModel,
      hasWebGL: tf.getBackend() === 'webgl',
      backend: tf.getBackend(),
      localEmbeddingsCount: this.getEmbeddingsFromLocal().length
    };
  }
  
  // Force reload models (useful for debugging)
  async reloadModels() {
    this.modelsLoaded = false;
    return this.loadModels();
  }
}

export default FaceRecognition.getInstance();