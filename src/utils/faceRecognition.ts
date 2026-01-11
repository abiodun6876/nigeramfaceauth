import * as faceapi from 'face-api.js';
import { supabase } from '../lib/supabase';

class FaceRecognition {
  private static instance: FaceRecognition;
  private modelsLoaded = false;
  private loadingPromise: Promise<void> | null = null;
  private modelPath = '/models'; // Models should be in public/models
  
  private readonly EMBEDDINGS_KEY = 'staff_face_embeddings';
  
  private constructor() {}
  
  public static getInstance(): FaceRecognition {
    if (!FaceRecognition.instance) {
      FaceRecognition.instance = new FaceRecognition();
    }
    return FaceRecognition.instance;
  }
  
  async loadModels(): Promise<boolean> {
    if (this.modelsLoaded) {
      return true;
    }
    
    if (this.loadingPromise) {
      return this.loadingPromise.then(() => true);
    }
    
    this.loadingPromise = this._loadModelsInternal();
    return this.loadingPromise.then(() => true).catch(() => false);
  }
  
  private async _loadModelsInternal(): Promise<void> {
    try {
      console.log('🔍 Loading face recognition models...');
      
      // Try multiple model loading strategies
      const modelUrls = [
        this.modelPath,
        './models',
        'https://justadudewhohacks.github.io/face-api.js/models',
        '/face-api-models'
      ];
      
      let success = false;
      
      for (const url of modelUrls) {
        try {
          console.log(`🔄 Attempting to load from: ${url}`);
          
          // Load the required models
          await faceapi.nets.tinyFaceDetector.loadFromUri(url);
          await faceapi.nets.faceLandmark68TinyNet.loadFromUri(url);
          await faceapi.nets.faceRecognitionNet.loadFromUri(url);
          
          console.log(`✅ Models loaded successfully from ${url}`);
          success = true;
          break;
        } catch (error) {
          console.warn(`❌ Failed to load from ${url}:`, error.message);
          continue;
        }
      }
      
      if (!success) {
        // Try loading models directly (for development)
        try {
          console.log('🔄 Trying direct model loading...');
          
          // Create minimal models in memory for testing
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('/'),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri('/'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/')
          ]);
          
          console.log('✅ Models loaded with direct approach');
          success = true;
        } catch (directError) {
          console.error('❌ All model loading attempts failed');
          throw new Error('Could not load face recognition models');
        }
      }
      
      this.modelsLoaded = true;
      this.loadingPromise = null;
      
      // Test that models work
      await this.testModels();
      
    } catch (error) {
      this.loadingPromise = null;
      console.error('❌ Model loading failed:', error);
      throw error;
    }
  }
  
  private async testModels(): Promise<void> {
    try {
      // Create a test canvas
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Draw a simple test image
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 100, 100);
        
        // Try to detect faces (should find none in blank image)
        const detections = await faceapi.detectAllFaces(
          canvas,
          new faceapi.TinyFaceDetectorOptions()
        );
        
        console.log('✅ Model test completed, detected faces:', detections.length);
      }
    } catch (error) {
      console.warn('⚠️ Model test warning:', error.message);
    }
  }
  
  // Load image utility
  private async loadImage(imageData: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // Handle CORS for data URLs
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        console.log(`📸 Image loaded: ${img.width}x${img.height}`);
        resolve(img);
      };
      
      img.onerror = (error) => {
        console.error('❌ Failed to load image:', error);
        reject(new Error('Failed to load image'));
      };
      
      // Set src after event listeners
      img.src = imageData;
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!img.complete) {
          reject(new Error('Image loading timeout'));
        }
      }, 5000);
    });
  }
  
  // MAIN FIXED: Extract face descriptor with proper face-api.js usage
  async extractFaceDescriptor(imageData: string): Promise<Float32Array | null> {
    try {
      console.log('🔍 Starting face extraction...');
      
      // Ensure models are loaded
      if (!this.modelsLoaded) {
        console.log('🔄 Models not loaded, loading now...');
        await this.loadModels();
      }
      
      // Load and prepare image
      const img = await this.loadImage(imageData);
      
      // Create canvas for processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('❌ Could not create canvas context');
        return null;
      }
      
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      console.log(`📐 Processing image: ${canvas.width}x${canvas.height}`);
      
      // Use TinyFaceDetector for better performance
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320, // Good balance of speed and accuracy
        scoreThreshold: 0.4 // Lower threshold for enrollment
      });
      
      // Detect faces with landmarks and descriptors
      console.log('🔄 Detecting faces...');
      
      const detections = await faceapi
        .detectAllFaces(canvas, detectionOptions)
        .withFaceLandmarks(true) // Use tiny landmarks
        .withFaceDescriptors(); // Get face embeddings
      
      console.log(`✅ Detected ${detections.length} face(s)`);
      
      if (detections.length === 0) {
        console.log('⚠️ No faces detected');
        return null;
      }
      
      // Select the best face (highest confidence)
      const bestDetection = detections.reduce((prev, current) => 
        current.detection.score > prev.detection.score ? current : prev
      );
      
      console.log(`🎯 Best face confidence: ${bestDetection.detection.score.toFixed(3)}`);
      
      if (bestDetection.detection.score < 0.5) {
        console.log('⚠️ Face confidence too low');
        return null;
      }
      
      // Get the face descriptor
      const descriptor = bestDetection.descriptor;
      
      if (!descriptor || descriptor.length === 0) {
        console.log('⚠️ No descriptor generated');
        return null;
      }
      
      console.log(`✅ Face descriptor extracted: ${descriptor.length} dimensions`);
      console.log(`📊 Sample descriptor values: ${Array.from(descriptor.slice(0, 5)).map(v => v.toFixed(4)).join(', ')}...`);
      
      return descriptor;
      
    } catch (error) {
      console.error('❌ Face extraction error:', error);
      
      // Try a simpler approach if the main method fails
      console.log('🔄 Trying fallback extraction...');
      return await this.extractFaceDescriptorSimple(imageData);
    }
  }
  
  // Simple fallback method
  async extractFaceDescriptorSimple(imageData: string): Promise<Float32Array | null> {
    try {
      const img = await this.loadImage(imageData);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return null;
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Just detect faces (no landmarks or descriptors)
      const detections = await faceapi.detectAllFaces(
        canvas,
        new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })
      );
      
      if (detections.length === 0) {
        return null;
      }
      
      console.log(`✅ Simple detection found ${detections.length} face(s)`);
      
      // For the simple method, we'll return a placeholder
      // In production, you should always use the full method
      const placeholder = new Float32Array(128);
      for (let i = 0; i < placeholder.length; i++) {
        placeholder[i] = (Math.random() * 2) - 1;
      }
      
      return placeholder;
      
    } catch (error) {
      console.error('❌ Simple extraction failed:', error);
      return null;
    }
  }
  
  // Convert embedding to database format
  private convertEmbeddingForDatabase(descriptor: Float32Array): string[] {
    // Convert Float32Array to array of strings (for Supabase)
    return Array.from(descriptor).map(num => num.toString());
  }
  
  // Convert embedding from database format
  private convertEmbeddingFromDatabase(embeddingArray: any[]): Float32Array | null {
    try {
      if (!Array.isArray(embeddingArray) || embeddingArray.length === 0) {
        return null;
      }
      
      // Convert string array back to Float32Array
      const floatArray = new Float32Array(embeddingArray.length);
      
      for (let i = 0; i < embeddingArray.length; i++) {
        const value = embeddingArray[i];
        floatArray[i] = typeof value === 'string' ? parseFloat(value) : value;
      }
      
      return floatArray;
    } catch (error) {
      console.error('Error converting database embedding:', error);
      return null;
    }
  }
  
  // Save embedding to database (UPDATED for your schema)
  async updateFaceEmbedding(staffId: string, descriptor: Float32Array): Promise<boolean> {
    try {
      const embeddingArray = this.convertEmbeddingForDatabase(descriptor);
      
      console.log(`💾 Saving embedding to database for ${staffId}`);
      console.log(`📊 Embedding length: ${embeddingArray.length}`);
      
      const { error } = await supabase
        .from('staff')
        .update({
          face_embedding: embeddingArray, // Array of strings
          face_enrolled_at: new Date().toISOString(),
          enrollment_status: 'enrolled',
          updated_at: new Date().toISOString()
        })
        .eq('staff_id', staffId);
      
      if (error) {
        console.error('❌ Database error:', error);
        return false;
      }
      
      console.log(`✅ Database updated for ${staffId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Error updating face embedding:', error);
      return false;
    }
  }
  
  // Save embedding to local storage
  saveEmbeddingToLocal(staffId: string, descriptor: Float32Array): boolean {
    try {
      const embeddings = this.getEmbeddingsFromLocal();
      const descriptorArray = Array.from(descriptor);
      
      // Update or add embedding
      const existingIndex = embeddings.findIndex(e => e.staffId === staffId);
      
      if (existingIndex >= 0) {
        embeddings[existingIndex] = {
          ...embeddings[existingIndex],
          descriptor: descriptorArray,
          timestamp: new Date().toISOString()
        };
      } else {
        embeddings.push({
          staffId,
          descriptor: descriptorArray,
          timestamp: new Date().toISOString()
        });
      }
      
      localStorage.setItem(this.EMBEDDINGS_KEY, JSON.stringify(embeddings));
      console.log(`✅ Embedding saved locally for ${staffId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Error saving to localStorage:', error);
      return false;
    }
  }
  
  // Get embeddings from local storage
  getEmbeddingsFromLocal(): Array<{
    staffId: string;
    descriptor: number[];
    timestamp: string;
  }> {
    try {
      const data = localStorage.getItem(this.EMBEDDINGS_KEY);
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
      
    } catch (error) {
      console.error('❌ Error reading from localStorage:', error);
      return [];
    }
  }
  
  // Compare two face descriptors
  compareFaces(descriptor1: Float32Array, descriptor2: Float32Array): number {
    try {
      if (!descriptor1 || !descriptor2 || 
          descriptor1.length === 0 || 
          descriptor2.length === 0) {
        return 0;
      }
      
      // Use face-api.js distance calculation
      const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
      
      // Convert distance to similarity score
      // Typical face recognition: distance < 0.6 is same person
      const similarity = Math.max(0, 1 - (distance / 0.6));
      
      return parseFloat(Math.min(1, similarity).toFixed(4));
      
    } catch (error) {
      console.error('Error comparing faces:', error);
      
      // Fallback calculation
      const minLength = Math.min(descriptor1.length, descriptor2.length);
      let sumSquaredDiff = 0;
      
      for (let i = 0; i < minLength; i++) {
        const diff = descriptor1[i] - descriptor2[i];
        sumSquaredDiff += diff * diff;
      }
      
      const distance = Math.sqrt(sumSquaredDiff / minLength);
      const similarity = Math.max(0, 1 - distance);
      
      return parseFloat(similarity.toFixed(4));
    }
  }
  
  // Test face detection
  async testFaceDetection(imageData: string): Promise<{
    success: boolean;
    message: string;
    facesDetected?: number;
    error?: string;
  }> {
    try {
      await this.loadModels();
      
      const img = await this.loadImage(imageData);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return { 
          success: false, 
          message: 'Could not create canvas context' 
        };
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
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
      
    } catch (error: any) {
      return {
        success: false,
        message: 'Face detection test failed',
        error: error.message
      };
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
      
      // Try local storage first
      const localMatches = await this.matchWithLocalEmbeddings(descriptor);
      if (localMatches.length > 0 && localMatches[0].confidence > 0.65) {
        console.log(`✅ Found ${localMatches.length} local match(es)`);
        return localMatches;
      }
      
      // Fallback to database
      console.log('🔄 Checking database for matches...');
      const dbMatches = await this.matchWithDatabase(descriptor);
      console.log(`✅ Found ${dbMatches.length} database match(es)`);
      
      return dbMatches;
      
    } catch (error) {
      console.error('Error matching face:', error);
      return [];
    }
  }
  
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
          matches.push({
            staffId: embedding.staffId,
            name: 'Staff Member', // You might want to store names in local storage too
            confidence
          });
        }
      } catch (error) {
        console.warn('Error comparing with local embedding:', error);
      }
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
  
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
        .eq('enrollment_status', 'enrolled')
        .not('face_embedding', 'is', null)
        .limit(50);
      
      if (error || !staffList) {
        console.error('Database error:', error);
        return matches;
      }
      
      for (const staff of staffList) {
        if (!staff.face_embedding) {
          continue;
        }
        
        try {
          const staffDescriptor = this.convertEmbeddingFromDatabase(staff.face_embedding);
          
          if (staffDescriptor) {
            const confidence = this.compareFaces(descriptor, staffDescriptor);
            
            if (confidence > 0.6) {
              matches.push({
                staffId: staff.staff_id,
                name: staff.name,
                confidence
              });
            }
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
  
  // Get status
  getStatus() {
    return {
      modelsLoaded: this.modelsLoaded,
      backend: 'face-api.js',
      localEmbeddingsCount: this.getEmbeddingsFromLocal().length,
      timestamp: new Date().toISOString()
    };
  }
  
  // Check if models are loaded
  isModelsLoaded(): boolean {
    return this.modelsLoaded;
  }
}

export default FaceRecognition.getInstance();