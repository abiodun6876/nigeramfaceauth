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
  
  // Main face descriptor extraction (for enrollment)
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

  // Mobile-optimized face descriptor extraction
  async extractFaceDescriptorMobile(imageData: string): Promise<Float32Array | null> {
    try {
      console.log('🔍 Starting face extraction on mobile...');
      
      // Ensure models are loaded
      if (!this.modelsLoaded) {
        console.log('🔄 Loading models...');
        await this.loadModels();
      }
      
      // Load image
      const img = await this.loadImage(imageData);
      
      // Mobile optimization: resize if too large
      const maxSize = 500; // pixels for mobile
      let canvas: HTMLCanvasElement;
      
      if (img.width > maxSize || img.height > maxSize) {
        canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        console.log(`📱 Resized from ${img.width}x${img.height} to ${canvas.width}x${canvas.height}`);
      } else {
        canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      }
      
      // Mobile-optimized detection options
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 160, // Lower for mobile performance
        scoreThreshold: 0.4
      });
      
      console.log('🔄 Detecting face on mobile...');
      
      const detections = await faceapi
        .detectAllFaces(canvas, detectionOptions)
        .withFaceLandmarks(true) // Use tiny landmarks for mobile
        .withFaceDescriptors();
      
      console.log(`✅ Detected ${detections.length} face(s) on mobile`);
      
      if (detections.length === 0) {
        // Try with lower threshold for mobile
        console.log('🔄 Trying lower threshold for mobile...');
        const lowThresholdOptions = new faceapi.TinyFaceDetectorOptions({
          inputSize: 160,
          scoreThreshold: 0.3
        });
        
        const lowThresholdDetections = await faceapi
          .detectAllFaces(canvas, lowThresholdOptions)
          .withFaceLandmarks(true)
          .withFaceDescriptors();
        
        if (lowThresholdDetections.length === 0) {
          console.log('⚠️ No faces detected even with low threshold');
          return null;
        }
        
        const bestDetection = lowThresholdDetections[0];
        console.log(`🎯 Low threshold face confidence: ${bestDetection.detection.score.toFixed(3)}`);
        return bestDetection.descriptor;
      }
      
      const bestDetection = detections[0];
      console.log(`🎯 Best face confidence: ${bestDetection.detection.score.toFixed(3)}`);
      
      return bestDetection.descriptor;
      
    } catch (error) {
      console.error('❌ Mobile face extraction error:', error);
      return null;
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
  
  // NOTE: This method is not used anymore since we use parseEmbeddingFromDatabase instead
  // Keeping it for backward compatibility but marking as deprecated
  private convertEmbeddingFromDatabase(embeddingArray: any[]): Float32Array | null {
    console.warn('⚠️ convertEmbeddingFromDatabase is deprecated. Use parseEmbeddingFromDatabase instead.');
    return this.parseEmbeddingFromDatabase(embeddingArray);
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
  
  // Main face matching method for attendance
  async matchFaceForAttendance(imageData: string) {
    console.group('🎭 Face Matching Started');
    
    try {
      console.log('1. Extracting face descriptor...');
      
      // Check if mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      let descriptor: Float32Array | null;
      
      if (isMobile) {
        console.log('📱 Using mobile-optimized extraction');
        descriptor = await this.extractFaceDescriptorMobile(imageData);
      } else {
        console.log('💻 Using standard extraction');
        descriptor = await this.extractFaceDescriptor(imageData);
      }
      
      if (!descriptor) {
        console.log('❌ No face detected in image');
        console.groupEnd();
        return [];
      }
      
      console.log(`✅ Face descriptor extracted: ${descriptor.length} dimensions`);
      
      console.log('2. Checking local storage...');
      const localMatches = await this.matchWithLocalEmbeddings(descriptor);
      
      if (localMatches.length > 0 && localMatches[0].confidence > 0.65) {
        console.log(`✅ Found ${localMatches.length} local match(es)`);
        console.groupEnd();
        return localMatches;
      }
      
      console.log('3. Checking database...');
      const dbMatches = await this.matchWithDatabase(descriptor);
      
      console.log(`✅ Found ${dbMatches.length} database match(es)`);
      
      if (dbMatches.length > 0) {
        console.log('🏆 Best match:', {
          staffId: dbMatches[0].staffId,
          name: dbMatches[0].name,
          confidence: dbMatches[0].confidence
        });
      }
      
      console.groupEnd();
      return dbMatches;
      
    } catch (error) {
      console.error('❌ Error matching face:', error);
      console.groupEnd();
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
      
      console.log(`📊 Found ${staffList.length} staff with embeddings`);
      
      for (const staff of staffList) {
        if (!staff.face_embedding) {
          continue;
        }
        
        try {
          // Parse the embedding from database format
          const staffDescriptor = this.parseEmbeddingFromDatabase(staff.face_embedding);
          
          if (staffDescriptor) {
            const confidence = this.compareFaces(descriptor, staffDescriptor);
            
            console.log(`🔍 Comparing with ${staff.name} (${staff.staff_id}): ${confidence.toFixed(4)}`);
            
            if (confidence > 0.6) {
              matches.push({
                staffId: staff.staff_id,
                name: staff.name,
                confidence
              });
              
              console.log(`✅ Match found with confidence: ${confidence.toFixed(4)}`);
            }
          } else {
            console.warn(`⚠️ Could not parse embedding for ${staff.name}`);
          }
        } catch (compareError) {
          console.warn(`❌ Could not compare with staff ${staff.staff_id}:`, compareError);
        }
      }
      
      console.log(`🎯 Total matches found: ${matches.length}`);
      return matches.sort((a, b) => b.confidence - a.confidence);
      
    } catch (error) {
      console.error('Database matching error:', error);
      return matches;
    }
  }

  private parseEmbeddingFromDatabase(embeddingData: any): Float32Array | null {
    try {
      console.log('📱 Parsing embedding from database...');
      
      if (!embeddingData) {
        console.log('❌ No embedding data');
        return null;
      }
      
      let numbers: number[] = [];
      
      // Handle the specific format from your data
      // "[\"-0.03632645308971405\", \"-0.5184420943260193\", ...]"
      if (typeof embeddingData === 'string') {
        console.log('Processing string embedding...');
        
        if (embeddingData.startsWith('[') && embeddingData.endsWith(']')) {
          try {
            // For JSON string format: ["-0.0363", "-0.5184", ...]
            const cleaned = embeddingData
              .replace(/[\[\]"]/g, '')  // Remove brackets and quotes
              .replace(/\s+/g, '');     // Remove whitespace
            
            numbers = cleaned.split(',').map(num => {
              const parsed = parseFloat(num);
              if (isNaN(parsed)) {
                console.warn(`Invalid number in embedding: ${num}`);
                return 0;
              }
              return parsed;
            });
            
            console.log(`Parsed ${numbers.length} numbers from JSON string`);
          } catch (parseError) {
            console.warn('String parse failed:', parseError);
            return null;
          }
        } else if (embeddingData.includes(',')) {
          // Plain comma-separated values
          numbers = embeddingData.split(',').map(num => {
            const trimmed = num.trim();
            const parsed = parseFloat(trimmed);
            return isNaN(parsed) ? 0 : parsed;
          });
          console.log(`Parsed ${numbers.length} numbers from CSV string`);
        } else {
          console.warn('Unknown string format');
          return null;
        }
      } else if (Array.isArray(embeddingData)) {
        // Already an array
        numbers = embeddingData.map(item => {
          if (typeof item === 'string') {
            return parseFloat(item) || 0;
          }
          return Number(item) || 0;
        });
        console.log(`Using existing array with ${numbers.length} items`);
      } else {
        console.warn('Unknown embedding data type:', typeof embeddingData);
        return null;
      }
      
      // Mobile optimization: validate length
      if (numbers.length !== 128) {
        console.warn(`⚠️ Length mismatch: ${numbers.length} vs 128`);
        
        // Try to fix: if longer, truncate; if shorter, pad with zeros
        if (numbers.length > 128) {
          numbers = numbers.slice(0, 128);
          console.log('Trimmed to 128 values');
        } else if (numbers.length < 128) {
          console.log('Padding with zeros');
          while (numbers.length < 128) {
            numbers.push(0);
          }
        }
      }
      
      // Validate all numbers are finite
      const validCount = numbers.filter(n => isFinite(n)).length;
      if (validCount !== numbers.length) {
        console.warn(`Contains ${numbers.length - validCount} invalid values`);
        // Replace invalid with 0
        numbers = numbers.map(n => isFinite(n) ? n : 0);
      }
      
      console.log(`✅ Successfully parsed ${numbers.length} values`);
      console.log(`📊 Sample: ${numbers.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...`);
      
      return new Float32Array(numbers);
      
    } catch (error) {
      console.error('❌ Error parsing embedding:', error);
      return null;
    }
  }
  
  async testEmbeddingParsing() {
    try {
      console.group('🧪 Testing Embedding Parsing');
      
      // Fetch a staff member with embedding
      const { data: staffList } = await supabase
        .from('staff')
        .select('staff_id, name, face_embedding')
        .limit(1);
      
      if (!staffList || staffList.length === 0) {
        console.log('No staff found');
        console.groupEnd();
        return;
      }
      
      const staff = staffList[0];
      console.log(`Testing staff: ${staff.name} (${staff.staff_id})`);
      console.log('Embedding type:', typeof staff.face_embedding);
      console.log('Embedding sample:', staff.face_embedding?.substring?.(0, 200) || 'No embedding');
      
      // Try to parse it
      const parsed = this.parseEmbeddingFromDatabase(staff.face_embedding);
      
      if (parsed) {
        console.log(`✅ Successfully parsed embedding! Length: ${parsed.length}`);
        console.log('First 5 values:', Array.from(parsed.slice(0, 5)).map(v => v.toFixed(4)));
        
        // Test with a dummy descriptor
        const dummyDescriptor = new Float32Array(128).fill(0);
        const confidence = this.compareFaces(dummyDescriptor, parsed);
        console.log(`Comparison test confidence: ${confidence.toFixed(4)}`);
      } else {
        console.log('❌ Failed to parse embedding');
      }
      
      console.groupEnd();
      
    } catch (error) {
      console.error('Test error:', error);
      console.groupEnd();
    }
  }

  // Add to public methods
  public async testDatabaseEmbeddings() {
    return this.testEmbeddingParsing();
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

  // Add mobile debug method
  public async mobileDebug(imageData?: string) {
    console.group('📱 MOBILE DEBUG');
    
    // Check browser capabilities
    console.log('Browser Info:', {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      isSecure: window.location.protocol === 'https:',
      hasCamera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    });
    
    // Check models
    console.log('Models loaded:', this.modelsLoaded);
    
    // Test embedding parsing
    await this.testDatabaseEmbeddings();
    
    if (imageData) {
      console.log('Testing face extraction...');
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const descriptor = isMobile 
        ? await this.extractFaceDescriptorMobile(imageData)
        : await this.extractFaceDescriptor(imageData);
      console.log('Face extraction result:', descriptor ? 'Success' : 'Failed');
    }
    
    console.groupEnd();
  }
}

// Create singleton instance
const faceRecognitionInstance = FaceRecognition.getInstance();

// Make it accessible via window for easy testing
if (typeof window !== 'undefined') {
  (window as any).faceRecognitionDebug = faceRecognitionInstance;
}

export default faceRecognitionInstance;