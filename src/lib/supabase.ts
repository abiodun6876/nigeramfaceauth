// src/lib/supabase.ts (Updated with public methods)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://kevcsmymkhdyquzzkpdl.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_SET63j4Xz60f0GzM3utm4w_oyZlvul4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: "insert" | "update" | "delete";
  data: any;
  device_id: string;
  created_at: string;
  processed: boolean;
  synced_at?: string;
}

export class LocalSyncService {
  private static readonly SYNC_QUEUE_KEY = 'sync_queue';
  private static readonly LAST_SYNC_KEY = 'last_sync_time';
  private static readonly OFFLINE_DATA_KEY = 'offline_data';

  // Public method to get sync queue
  public static async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      const queue = localStorage.getItem(this.SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch {
      return [];
    }
  }

  // Public method to get pending sync count
  public static async getPendingSyncCount(): Promise<number> {
    try {
      const queue = await this.getSyncQueue();
      return queue.filter(item => !item.processed).length;
    } catch {
      return 0;
    }
  }

  // Public method to get all sync items (for SyncPage)
  public static async getAllSyncItems(): Promise<SyncQueueItem[]> {
    return await this.getSyncQueue();
  }

  // Private method to save queue
  private static async saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
    localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(queue));
  }

  // Add item to sync queue
  public static async addToSyncQueue(table: string, operation: "insert" | "update" | "delete", data: any): Promise<boolean> {
    try {
      const queue = await this.getSyncQueue();
      const item: SyncQueueItem = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        table_name: table,
        record_id: data.id || data.record_id,
        operation,
        data,
        device_id: 'web-app',
        created_at: new Date().toISOString(),
        processed: false,
      };
      
      queue.push(item);
      await this.saveSyncQueue(queue);
      return true;
    } catch (error) {
      console.error('Error adding to sync queue:', error);
      return false;
    }
  }

  // Sync pending items
  public static async syncPendingItems(): Promise<{ success: boolean; synced: number; errors: any[] }> {
    const queue = await this.getSyncQueue();
    const pendingItems = queue.filter(item => !item.processed);
    const errors: any[] = [];
    let synced = 0;

    for (const item of pendingItems) {
      try {
        switch (item.operation) {
          case "insert":
            await supabase.from(item.table_name).insert(item.data);
            break;
          case "update":
            await supabase
              .from(item.table_name)
              .update(item.data)
              .eq('id', item.record_id);
            break;
          case "delete":
            await supabase
              .from(item.table_name)
              .delete()
              .eq('id', item.record_id);
            break;
        }
        
        item.processed = true;
        item.synced_at = new Date().toISOString();
        synced++;
      } catch (error: any) {
        errors.push({ item, error: error.message });
      }
    }

    await this.saveSyncQueue(queue);
    localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());

    return {
      success: errors.length === 0,
      synced,
      errors,
    };
  }

  // Get last sync time
  public static getLastSyncTime(): Date | null {
    const lastSync = localStorage.getItem(this.LAST_SYNC_KEY);
    return lastSync ? new Date(lastSync) : null;
  }

  // Store data offline
  public static storeOfflineData(key: string, data: any): void {
    try {
      const offlineData = this.getOfflineData();
      offlineData[key] = {
        data,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(this.OFFLINE_DATA_KEY, JSON.stringify(offlineData));
    } catch (error) {
      console.error('Error storing offline data:', error);
    }
  }

  // Get offline data
  public static getOfflineData(): Record<string, any> {
    try {
      const data = localStorage.getItem(this.OFFLINE_DATA_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  // Clear processed items
  public static async clearProcessedItems(): Promise<void> {
    const queue = await this.getSyncQueue();
    const pendingItems = queue.filter(item => !item.processed);
    await this.saveSyncQueue(pendingItems);
  }
}

// Helper for offline attendance recording
export const recordAttendanceOffline = async (attendanceData: any) => {
  const key = `attendance_${Date.now()}`;
  LocalSyncService.storeOfflineData(key, attendanceData);
  
  await LocalSyncService.addToSyncQueue('attendance_records', 'insert', attendanceData);
  
  return { success: true, localKey: key };
};

// Helper functions
export const formatDateForDB = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const formatTimeForDB = (date: Date): string => {
  return date.toTimeString().split(' ')[0].substring(0, 5);
};