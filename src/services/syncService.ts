import { supabase } from '../lib/supabase';
import faceRecognition from '../utils/faceRecognition';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors: string[];
  timestamp: string;
}

class SyncService {
  private readonly SYNC_STATUS_KEY = 'last_sync_status';
  private readonly PENDING_UPLOADS_KEY = 'pending_uploads';

  // Get sync status
  getSyncStatus(): { lastSync: string | null; pendingCount: number } {
    const status = localStorage.getItem(this.SYNC_STATUS_KEY);
    const pending = localStorage.getItem(this.PENDING_UPLOADS_KEY);
    
    const pendingData = pending ? JSON.parse(pending) : [];
    
    return {
      lastSync: status ? JSON.parse(status).timestamp : null,
      pendingCount: pendingData.length
    };
  }

  // Save attendance to local storage (for offline)
  saveAttendanceLocally(staffId: string, eventId?: string): void { // Changed studentId to staffId
    const attendance = {
      staffId, // Changed from studentId
      eventId,
      timestamp: new Date().toISOString(),
      status: 'pending_sync'
    };

    const pending = localStorage.getItem(this.PENDING_UPLOADS_KEY);
    const pendingArray = pending ? JSON.parse(pending) : [];
    
    pendingArray.push(attendance);
    localStorage.setItem(this.PENDING_UPLOADS_KEY, JSON.stringify(pendingArray));
    
    console.log('Attendance saved locally:', attendance);
  }

  // Sync pending data to Supabase
  async syncPendingData(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Get pending attendance records
      const pending = localStorage.getItem(this.PENDING_UPLOADS_KEY);
      const pendingArray = pending ? JSON.parse(pending) : [];

      if (pendingArray.length === 0) {
        result.success = true;
        result.syncedCount = 0;
        return result;
      }

      const synced: any[] = [];
      const errors: any[] = [];

      // Sync each attendance record
      for (const record of pendingArray) {
        try {
          const { error } = await supabase
            .from('staff_attendance') // Changed from 'attendance_records'
            .insert({
              staff_id: record.staffId, // Changed from student_id
              event_id: record.eventId,
              timestamp: record.timestamp,
              status: 'present',
              source: 'face_recognition',
              synced_at: new Date().toISOString()
            });

          if (error) {
            errors.push({ record, error: error.message });
          } else {
            synced.push(record);
          }
        } catch (error: any) {
          errors.push({ record, error: error.message });
        }
      }

      // Update local storage
      const remaining = pendingArray.filter((r: any) => 
        !synced.find(s => s.timestamp === r.timestamp && s.staffId === r.staffId) // Changed from studentId
      );

      localStorage.setItem(this.PENDING_UPLOADS_KEY, JSON.stringify(remaining));

      // Save sync status
      localStorage.setItem(this.SYNC_STATUS_KEY, JSON.stringify({
        timestamp: result.timestamp,
        syncedCount: synced.length,
        errorCount: errors.length
      }));

      result.success = errors.length === 0;
      result.syncedCount = synced.length;
      result.errors = errors.map(e => e.error);

      console.log(`Sync completed: ${synced.length} records synced, ${errors.length} errors`);

    } catch (error: any) {
      console.error('Sync failed:', error);
      result.errors.push(error.message);
    }

    return result;
  }

  // Sync face embeddings to Supabase (for backup)
  async syncFaceEmbeddings(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      // This should now work with the faceRecognition module
      const embeddings = faceRecognition.getEmbeddingsFromLocal();
      
      for (const embedding of embeddings) {
        try {
          // FIXED: Use staff table and staff_id field
          const { error } = await supabase
            .from('staff') // Changed from 'students'
            .update({
              face_embedding: embedding.descriptor,
              last_face_update: new Date().toISOString()
            })
            .eq('staff_id', embedding.staffId); // Changed from studentId and id/matric_number

          if (error) {
            result.errors.push(`Staff ${embedding.staffId}: ${error.message}`); // Changed from Student
          } else {
            result.syncedCount++;
          }
        } catch (error: any) {
          result.errors.push(`Staff ${embedding.staffId}: ${error.message}`); // Changed from Student
        }
      }

      result.success = result.errors.length === 0;

    } catch (error: any) {
      console.error('Face embeddings sync failed:', error);
      result.errors.push(error.message);
    }

    return result;
  }

  // Clear all pending data
  clearPendingData(): void {
    localStorage.removeItem(this.PENDING_UPLOADS_KEY);
    localStorage.removeItem(this.SYNC_STATUS_KEY);
    console.log('Cleared all pending sync data');
  }

  // Check if online
  isOnline(): boolean {
    return navigator.onLine;
  }

  // Auto-sync when online
  setupAutoSync(): void {
    window.addEventListener('online', () => {
      console.log('Network connection restored. Starting auto-sync...');
      this.syncPendingData();
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost. Working offline...');
    });
  }
}

export const syncService = new SyncService();