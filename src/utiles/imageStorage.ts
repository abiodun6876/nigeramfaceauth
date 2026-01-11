// src/utils/imageStorage.ts - UPDATED
export interface StoredImage {
  id: string;
  staffId: string; // Changed from studentId
  imageData: string; // Base64 encoded
  timestamp: number;
  type: 'enrollment' | 'verification' | 'attendance';
  metadata?: {
    confidence?: number;
    location?: string;
    deviceInfo?: string;
  };
}

class ImageStorage {
  private readonly DB_NAME = 'face_images_db';
  private readonly STORE_NAME = 'images';
  private readonly MAX_IMAGES_PER_STAFF = 10; // Changed from student to staff
  private readonly MAX_TOTAL_IMAGES = 1000;

  // Initialize IndexedDB
  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 2);

      request.onerror = () => reject('Failed to open database');
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('staffId', 'staffId', { unique: false }); // Changed
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };
    });
  }

  // Save image to IndexedDB
  async saveImage(imageData: Omit<StoredImage, 'id'>): Promise<string> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const image: StoredImage = {
        ...imageData,
        id: `${imageData.staffId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // Changed
      };

      // Check if we need to cleanup old images for this staff member
      this.cleanupOldImages(store, image.staffId); // Changed

      const request = store.add(image);
      
      request.onsuccess = () => {
        console.log(`Image saved: ${image.id}`);
        resolve(image.id);
      };
      
      request.onerror = () => reject('Failed to save image');
    });
  }

  // Cleanup old images for a staff member
  private async cleanupOldImages(store: IDBObjectStore, staffId: string): Promise<void> { // Changed
    const index = store.index('staffId'); // Changed
    const request = index.getAll(staffId); // Changed
    
    request.onsuccess = () => {
      const images = request.result as StoredImage[];
      
      if (images.length > this.MAX_IMAGES_PER_STAFF) { // Changed
        // Sort by timestamp (oldest first)
        images.sort((a, b) => a.timestamp - b.timestamp);
        
        // Delete oldest images beyond limit
        const imagesToDelete = images.slice(0, images.length - this.MAX_IMAGES_PER_STAFF); // Changed
        
        imagesToDelete.forEach(image => {
          store.delete(image.id);
        });
      }
    };
  }

  // Get images for a staff member
  async getStaffImages(staffId: string): Promise<StoredImage[]> { // Changed method name
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('staffId'); // Changed
      
      const request = index.getAll(staffId); // Changed
      
      request.onsuccess = () => {
        const images = request.result as StoredImage[];
        // Sort by timestamp (newest first)
        images.sort((a, b) => b.timestamp - a.timestamp);
        resolve(images);
      };
      
      request.onerror = () => reject('Failed to get images');
    });
  }

  // Get image by ID
  async getImage(imageId: string): Promise<StoredImage | null> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const request = store.get(imageId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject('Failed to get image');
    });
  }

  // Delete image
  async deleteImage(imageId: string): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const request = store.delete(imageId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Failed to delete image');
    });
  }

  // Delete all images for a staff member
  async deleteStaffImages(staffId: string): Promise<void> { // Changed method name
    const images = await this.getStaffImages(staffId); // Changed
    
    await Promise.all(images.map(image => this.deleteImage(image.id)));
  }

  // Get storage statistics
  async getStorageStats(): Promise<{
    totalImages: number;
    staffWithImages: number; // Changed from studentsWithImages
    totalSize: number;
  }> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const images = request.result as StoredImage[];
        const staffIds = new Set(images.map(img => img.staffId)); // Changed
        
        // Estimate size (rough estimate: each Base64 character ≈ 0.75 bytes)
        const totalSize = images.reduce((acc, img) => 
          acc + (img.imageData.length * 0.75), 0
        );
        
        resolve({
          totalImages: images.length,
          staffWithImages: staffIds.size, // Changed
          totalSize: Math.round(totalSize / 1024) // Convert to KB
        });
      };
      
      request.onerror = () => reject('Failed to get stats');
    });
  }

  // Convert Blob to Base64
  async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix if present
        const base64 = base64String.split(',')[1] || base64String;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Convert Base64 to Blob
  base64ToBlob(base64: string, type: string = 'image/jpeg'): Blob {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type });
  }

  // Create thumbnail (compressed version)
  async createThumbnail(imageData: string, maxWidth: number = 200): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject('Failed to create canvas context');
          return;
        }
        
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to compressed JPEG
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        // Remove data URL prefix
        const base64 = compressed.split(',')[1];
        
        resolve(base64);
      };
      
      img.onerror = () => reject('Failed to load image');
      img.src = `data:image/jpeg;base64,${imageData}`;
    });
  }

  // Clear all images (for cleanup)
  async clearAllImages(): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Failed to clear images');
    });
  }
}

export const imageStorage = new ImageStorage();