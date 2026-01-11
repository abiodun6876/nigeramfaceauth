import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import { supabase } from '../lib/supabase';

class FaceRecognition {
  private static instance: FaceRecognition;
  private modelsLoaded = false;
  private useTinyModel = true;
  
  private readonly EMBEDDINGS_KEY = 'staff_face_embeddings';
  
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
      
      const modelPath = '/models';
      
      // Load models
      if (this.useTinyModel) {
        await faceapi.nets.tinyFaceDetector.load(modelPath);
      } else {
        await faceapi.nets.ssdMobilenetv1.load(modelPath);
      }
      
      await faceapi.nets.faceLandmark68Net.load(modelPath);
      await faceapi.nets.faceRecognitionNet.load(modelPath);
      
      this.modelsLoaded = true;
      console.log('All face recognition models loaded successfully');
      
    } catch (error) {
      console.error('Failed to load models:', error);
      throw new Error('Could not load face recognition models.');
    }
  }
  
  // MAIN face extraction method
  async extractFaceDescriptor(imageData: string): Promise<Float32Array | null> {
    try {
      if (!this.modelsLoaded) {
        await this.loadModels();
      }
      
      // Create image
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = imageData;
      });
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Could not create canvas context');
        return null;
      }
      
      ctx.drawImage(img, 0, 0);
      
      // Use face-api.js with type assertion
      const faceapiAny = faceapi as any;
      
      // Try to get face descriptor
      const fullFaceDescription = await faceapiAny
        .detectSingleFace(canvas)
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (fullFaceDescription && fullFaceDescription.descriptor) {
        return fullFaceDescription.descriptor;
      }
      
      return null;
      
    } catch (error) {
      console.error('Face extraction failed:', error);
      return null;
    }
  }
  
  // ADD THIS METHOD - Simple extraction alternative
  async extractFaceDescriptorSimple(imageData: string): Promise<Float32Array | null> {
    try {
      if (!this.modelsLoaded) {
        await this.loadModels();
      }
      
      // Create image
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = imageData;
      });
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return null;
      
      ctx.drawImage(img, 0, 0);
      
      // Try a simpler approach using nets directly
      const faceapiAny = faceapi as any;
      
      // Detect face
      const detection = await faceapiAny.detectSingleFace(canvas);
      
      if (!detection) return null;
      
      // Get landmarks
      const landmarks = await faceapiAny.nets.faceLandmark68Net.detectLandmarks(canvas, detection);
      
      if (!landmarks) return null;
      
      // Compute descriptor
      const descriptor = await faceapiAny.nets.faceRecognitionNet.computeFaceDescriptor(canvas, {
        detection: detection,
        landmarks: landmarks
      });
      
      return descriptor;
      
    } catch (error) {
      console.log('Simple extraction failed:', error);
      return null;
    }
  }
  
  // ADD THIS METHOD - Alternative extraction
  async extractFaceDescriptorAlt(imageData: string): Promise<Float32Array | null> {
    try {
      if (!this.modelsLoaded) {
        await this.loadModels();
      }
      
      // Create image
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = imageData;
      });
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return null;
      
      ctx.drawImage(img, 0, 0);
      
      // Try detectAllFaces approach
      const faceapiAny = faceapi as any;
      
      const detections = await faceapiAny.detectAllFaces(canvas);
      
      if (detections.length === 0) return null;
      
      // Get landmarks for the first face
      const landmarks = await faceapiAny.nets.faceLandmark68Net.detectLandmarks(canvas, detections[0]);
      
      if (!landmarks) return null;
      
      // Compute descriptor using the face recognition net
      const descriptor = await faceapiAny.nets.faceRecognitionNet.computeFaceDescriptor(canvas, {
        detection: detections[0],
        landmarks: landmarks
      });
      
      // Handle return type
      if (Array.isArray(descriptor)) {
        return descriptor[0];
      }
      
      return descriptor;
      
    } catch (error) {
      console.error('Alternative extraction failed:', error);
      return null;
    }
  }
  
  compareFaces(descriptor1: Float32Array, descriptor2: Float32Array): number {
    try {
      if (!descriptor1 || !descriptor2 || 
          descriptor1.length === 0 || 
          descriptor2.length === 0 ||
          descriptor1.length !== descriptor2.length) {
        return 0;
      }
      
      let sumSquaredDiff = 0;
      for (let i = 0; i < descriptor1.length; i++) {
        const diff = descriptor1[i] - descriptor2[i];
        sumSquaredDiff += diff * diff;
      }
      
      const distance = Math.sqrt(sumSquaredDiff / descriptor1.length);
      
      // Convert distance to similarity (0-1)
      const similarity = Math.max(0, Math.min(1, 1 - (distance / 2)));
      
      return similarity;
    } catch (error) {
      console.error('Error comparing faces:', error);
      return 0;
    }
  }
  
  async matchFaceForAttendance(imageData: string) {
    try {
      // Try extraction methods in order
      let descriptor = await this.extractFaceDescriptor(imageData);
      
      if (!descriptor) {
        descriptor = await this.extractFaceDescriptorSimple(imageData);
      }
      
      if (!descriptor) {
        descriptor = await this.extractFaceDescriptorAlt(imageData);
      }
      
      if (!descriptor) {
        console.log('All face extraction methods failed');
        return [];
      }
      
      // Get staff from database
      const { data: staffList, error } = await supabase
        .from('staff')
        .select('staff_id, name, face_embedding')
        .eq('employment_status', 'active')
        .not('face_embedding', 'is', null);
      
      if (error || !staffList) {
        console.error('Database error:', error);
        return [];
      }
      
      const matches: Array<{
        staffId: string;
        name: string;
        confidence: number;
      }> = [];
      
      for (const staff of staffList) {
        if (!staff.face_embedding || !Array.isArray(staff.face_embedding)) {
          continue;
        }
        
        try {
          const staffDescriptor = new Float32Array(staff.face_embedding);
          const confidence = this.compareFaces(descriptor, staffDescriptor);
          
          if (confidence > 0.6) {
            matches.push({
              staffId: staff.staff_id,
              name: staff.name,
              confidence
            });
          }
        } catch (compareError) {
          console.warn(`Could not compare with staff ${staff.staff_id}:`, compareError);
        }
      }
      
      return matches.sort((a, b) => b.confidence - a.confidence);
      
    } catch (error) {
      console.error('Error matching face:', error);
      return [];
    }
  }
  
  async updateFaceEmbedding(staffId: string, descriptor: Float32Array) {
    try {
      const embeddingArray = Array.from(descriptor);
      
      const { error } = await supabase
        .from('staff')
        .update({
          face_embedding: embeddingArray,
          last_face_update: new Date().toISOString()
        })
        .eq('staff_id', staffId);
      
      if (error) {
        throw error;
      }
        
      console.log(`Face embedding updated for staff ${staffId}`);
      return true;
    } catch (error) {
      console.error('Error updating face embedding:', error);
      return false;
    }
  }
  
  saveEmbeddingToLocal(staffId: string, descriptor: Float32Array): boolean {
    try {
      const embeddings = this.getEmbeddingsFromLocal();
      
      // Remove existing embedding for this staff
      const filtered = embeddings.filter(e => e.staffId !== staffId);
      
      // Add new embedding
      const descriptorArray = Array.from(descriptor);
      filtered.push({ 
        staffId, 
        descriptor: descriptorArray,
        timestamp: new Date().toISOString() 
      });
      
      localStorage.setItem(this.EMBEDDINGS_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }
  
  getEmbeddingsFromLocal(): Array<{
    staffId: string;
    descriptor: number[];
    timestamp: string;
  }> {
    try {
      const data = localStorage.getItem(this.EMBEDDINGS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return [];
    }
  }
  
  getEmbeddingForStaff(staffId: string): Float32Array | null {
    try {
      const embeddings = this.getEmbeddingsFromLocal();
      const found = embeddings.find(e => e.staffId === staffId);
      
      if (found && found.descriptor) {
        return new Float32Array(found.descriptor);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting embedding:', error);
      return null;
    }
  }


  // In FaceRecognition class, update the syncLocalEmbeddingsToDatabase method:
async syncLocalEmbeddingsToDatabase(): Promise<Array<{
  staffId: string;
  descriptor: number[];
}>> {
  const localEmbeddings = this.getEmbeddingsFromLocal();
  const syncedEmbeddings: Array<{staffId: string; descriptor: number[]}> = [];
  
  for (const embedding of localEmbeddings) {
    try {
      // Use staffId, not studentId
      await this.updateFaceEmbedding(embedding.staffId, new Float32Array(embedding.descriptor));
      syncedEmbeddings.push(embedding);
    } catch (error) {
      console.error(`Failed to sync embedding for staff ${embedding.staffId}:`, error);
    }
  }
    
  return syncedEmbeddings;
}
  
  clearLocalEmbeddings(): void {
    localStorage.removeItem(this.EMBEDDINGS_KEY);
  }
  
  hasLocalEmbedding(staffId: string): boolean {
    return this.getEmbeddingForStaff(staffId) !== null;
  }
  
  getStatus() {
    return {
      modelsLoaded: this.modelsLoaded,
      useTinyModel: this.useTinyModel,
      backend: tf.getBackend(),
      localEmbeddingsCount: this.getEmbeddingsFromLocal().length
    };
  }
}

export default FaceRecognition.getInstance();