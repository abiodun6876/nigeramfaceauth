import * as faceapi from 'face-api.js';
import { supabase } from '../lib/supabase';

class FaceRecognition {
  private static instance: FaceRecognition;
  private modelsLoaded = false;
  private loadingPromise: Promise<void> | null = null;
  
  private readonly EMBEDDINGS_KEY = 'staff_face_embeddings';
  
  private constructor() {}
  
  public static getInstance(): FaceRecognition {
    if (!FaceRecognition.instance) {
      FaceRecognition.instance = new FaceRecognition();
    }
    return FaceRecognition.instance;
  }
  
  async loadModels(): Promise<void> {
    // If already loading, return the same promise
    if (this.loadingPromise) {
      return this.loadingPromise;
    }
    
    if (this.modelsLoaded) {
      return;
    }
    
    this.loadingPromise = this._loadModelsInternal();
    return this.loadingPromise;
  }
  
  private async _loadModelsInternal(): Promise<void> {
    try {
      console.log('Loading face recognition models...');
      
      // Try different model paths
      const modelPaths = [
        '/models',
        '/face-api-models',
        'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
      ];
      
      let modelsLoaded = false;
      
      for (const modelPath of modelPaths) {
        try {
          console.log(`Trying to load models from: ${modelPath}`);
          
          // Load lightweight models for mobile
          await faceapi.nets.tinyFaceDetector.load(modelPath);
          await faceapi.nets.faceLandmark68TinyNet.load(modelPath);
          await faceapi.nets.faceRecognitionNet.load(modelPath);
          
          console.log(`✅ Models loaded from ${modelPath}`);
          modelsLoaded = true;
          break;
        } catch (pathError) {
          console.log(`Failed to load from ${modelPath}:`, pathError);
        }
      }
      
      if (!modelsLoaded) {
        throw new Error('Could not load models from any path');
      }
      
      this.modelsLoaded = true;
      this.loadingPromise = null;
      console.log('All face recognition models loaded successfully');
      
    } catch (error) {
      this.loadingPromise = null;
      console.error('Failed to load models:', error);
      throw new Error('Could not load face recognition models.');
    }
  }
  
  // Create a utility function to load image
  private async loadImage(imageData: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      
      // For data URLs, we need to decode them
      if (imageData.startsWith('data:image')) {
        img.src = imageData;
      } else {
        reject(new Error('Invalid image data format'));
      }
    });
  }
  
  // MAIN face extraction method - UPDATED for face-api.js v0.22.2
  async extractFaceDescriptor(imageData: string): Promise<Float32Array | null> {
    try {
      await this.loadModels();
      
      // Load image
      const img = await this.loadImage(imageData);
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Could not create canvas context');
        return null;
      }
      
      // Draw image to canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Use the correct face-api.js API for v0.22.2
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 160, // Smaller for mobile
        scoreThreshold: 0.5
      });
      
      // Detect all faces
      const detections = await faceapi
        .detectAllFaces(canvas, detectionOptions)
        .withFaceLandmarks(true) // Use tiny landmarks for mobile
        .withFaceDescriptors();
      
      if (detections.length === 0) {
        console.log('No face detected in image');
        return null;
      }
      
      // Return the descriptor of the largest face (most likely the main subject)
      const largestFace = detections.reduce((prev, current) => {
        const prevArea = prev.detection.box.width * prev.detection.box.height;
        const currentArea = current.detection.box.width * current.detection.box.height;
        return currentArea > prevArea ? current : prev;
      });
      
      if (!largestFace.descriptor) {
        console.log('No descriptor found for face');
        return null;
      }
      
      console.log(`✅ Face descriptor extracted, length: ${largestFace.descriptor.length}`);
      return largestFace.descriptor;
      
    } catch (error) {
      console.error('Face extraction failed:', error);
      return null;
    }
  }
  
  // Simple face detection without landmarks (fallback)
  async extractFaceDescriptorSimple(imageData: string): Promise<Float32Array | null> {
    try {
      await this.loadModels();
      
      const img = await this.loadImage(imageData);
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return null;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Simple detection only
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 128,
        scoreThreshold: 0.3
      });
      
      const detections = await faceapi.detectAllFaces(canvas, detectionOptions);
      
      if (detections.length === 0) {
        return null;
      }
      
      // For the simple version, we'll create a placeholder descriptor
      // This is just for testing - in production you'd want proper face recognition
      console.log('Simple detection successful, creating placeholder descriptor');
      
      // Create a random descriptor (for testing only - in production use proper face recognition)
      const descriptor = new Float32Array(128);
      for (let i = 0; i < descriptor.length; i++) {
        descriptor[i] = Math.random() * 2 - 1; // Random values between -1 and 1
      }
      
      return descriptor;
      
    } catch (error) {
      console.log('Simple extraction failed:', error);
      return null;
    }
  }
  
  // Compare two face descriptors
  compareFaces(descriptor1: Float32Array, descriptor2: Float32Array): number {
    try {
      if (!descriptor1 || !descriptor2 || 
          descriptor1.length === 0 || 
          descriptor2.length === 0 ||
          descriptor1.length !== descriptor2.length) {
        return 0;
      }
      
      let sumSquaredDiff = 0;
      const length = Math.min(descriptor1.length, descriptor2.length);
      
      for (let i = 0; i < length; i++) {
        const diff = descriptor1[i] - descriptor2[i];
        sumSquaredDiff += diff * diff;
      }
      
      const euclideanDistance = Math.sqrt(sumSquaredDiff);
      const maxDistance = Math.sqrt(length * 4); // Maximum possible distance
      
      // Convert to similarity score (0-1)
      const similarity = Math.max(0, 1 - (euclideanDistance / maxDistance));
      
      // Boost the score slightly for mobile (face detection might be less accurate)
      const boostedSimilarity = Math.min(1, similarity * 1.2);
      
      return parseFloat(boostedSimilarity.toFixed(4));
    } catch (error) {
      console.error('Error comparing faces:', error);
      return 0;
    }
  }
  
  // Match face for attendance
  async matchFaceForAttendance(imageData: string) {
    try {
      // Extract face descriptor
      const descriptor = await this.extractFaceDescriptor(imageData);
      
      if (!descriptor) {
        console.log('No face detected in image');
        return [];
      }
      
      // First check local storage for quick matching
      const localMatches = await this.matchWithLocalEmbeddings(descriptor);
      if (localMatches.length > 0 && localMatches[0].confidence > 0.7) {
        return localMatches;
      }
      
      // Fallback to database
      const dbMatches = await this.matchWithDatabase(descriptor);
      return dbMatches;
      
    } catch (error) {
      console.error('Error matching face:', error);
      return [];
    }
  }
  
  // Match with local storage embeddings
  private async matchWithLocalEmbeddings(descriptor: Float32Array) {
    const matches: Array<{
      staffId: string;
      name: string;
      confidence: number;
    }> = [];
    
    const embeddings = this.getEmbeddingsFromLocal();
    
    for (const embedding of embeddings) {
      try {
        const staffDescriptor = new Float32Array(embedding.descriptor);
        const confidence = this.compareFaces(descriptor, staffDescriptor);
        
        if (confidence > 0.6) {
          // Try to get name from local storage or use placeholder
          const staffName = embedding.name || 'Staff Member';
          matches.push({
            staffId: embedding.staffId,
            name: staffName,
            confidence
          });
        }
      } catch (error) {
        console.warn('Error comparing with local embedding:', error);
      }
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
  
  // Match with database embeddings
  private async matchWithDatabase(descriptor: Float32Array) {
    const matches: Array<{
      staffId: string;
      name: string;
      confidence: number;
    }> = [];
    
    try {
      const { data: staffList, error } = await supabase
        .from('staff')
        .select('staff_id, name, face_embedding')
        .eq('employment_status', 'active')
        .not('face_embedding', 'is', null)
        .limit(50); // Limit for mobile performance
      
      if (error || !staffList) {
        console.error('Database error:', error);
        return matches;
      }
      
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
      console.error('Database matching error:', error);
      return matches;
    }
  }
  
  // Save embedding to database
  async updateFaceEmbedding(staffId: string, descriptor: Float32Array): Promise<boolean> {
    try {
      const embeddingArray = Array.from(descriptor);
      
      const { error } = await supabase
        .from('staff')
        .update({
          face_embedding: embeddingArray,
          face_enrolled_at: new Date().toISOString(),
          enrollment_status: 'enrolled',
          updated_at: new Date().toISOString()
        })
        .eq('staff_id', staffId);
      
      if (error) {
        console.error('Database update error:', error);
        return false;
      }
      
      console.log(`✅ Face embedding updated for staff ${staffId}`);
      return true;
    } catch (error) {
      console.error('Error updating face embedding:', error);
      return false;
    }
  }
  
  // Save embedding to local storage
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
      console.log(`✅ Embedding saved to localStorage for staff ${staffId}`);
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }
  
  // Get embeddings from local storage
  getEmbeddingsFromLocal(): Array<{
    staffId: string;
    descriptor: number[];
    timestamp: string;
    name?: string;
  }> {
    try {
      const data = localStorage.getItem(this.EMBEDDINGS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return [];
    }
  }
  
  // Get specific embedding from local storage
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
  
  // Sync local embeddings to database
  async syncLocalEmbeddingsToDatabase(): Promise<Array<{
    staffId: string;
    descriptor: number[];
  }>> {
    const localEmbeddings = this.getEmbeddingsFromLocal();
    const syncedEmbeddings: Array<{staffId: string; descriptor: number[]}> = [];
    
    for (const embedding of localEmbeddings) {
      try {
        await this.updateFaceEmbedding(
          embedding.staffId, 
          new Float32Array(embedding.descriptor)
        );
        syncedEmbeddings.push(embedding);
      } catch (error) {
        console.error(`Failed to sync embedding for staff ${embedding.staffId}:`, error);
      }
    }
      
    return syncedEmbeddings;
  }
  
  // Clear local embeddings
  clearLocalEmbeddings(): void {
    localStorage.removeItem(this.EMBEDDINGS_KEY);
    console.log('✅ Local embeddings cleared');
  }
  
  // Check if staff has local embedding
  hasLocalEmbedding(staffId: string): boolean {
    return this.getEmbeddingForStaff(staffId) !== null;
  }
  
  // Get status information
  getStatus() {
    return {
      modelsLoaded: this.modelsLoaded,
      backend: 'webgl', // face-api.js uses WebGL
      localEmbeddingsCount: this.getEmbeddingsFromLocal().length,
      timestamp: new Date().toISOString()
    };
  }
  
  // Test function to verify face detection works
  async testFaceDetection(imageData: string): Promise<{
    success: boolean;
    message: string;
    facesDetected?: number;
  }> {
    try {
      await this.loadModels();
      
      const img = await this.loadImage(imageData);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return { success: false, message: 'Could not create canvas context' };
      }
      
      ctx.drawImage(img, 0, 0);
      
      const detections = await faceapi.detectAllFaces(
        canvas, 
        new faceapi.TinyFaceDetectorOptions()
      );
      
      return {
        success: true,
        message: `Detected ${detections.length} face(s)`,
        facesDetected: detections.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Face detection test failed: ${error}`
      };
    }
  }
}

export default FaceRecognition.getInstance();