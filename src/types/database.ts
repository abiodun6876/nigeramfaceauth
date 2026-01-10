// src/types/database.ts - NIGERAM STAFF VERSION

// ========== STAFF RELATED TYPES ==========
export interface Staff {
  id: string;
  staff_id: string;
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  department: 'studio' | 'logistics' | 'bakery' | 'spa';  
  department_name?: string;
  position?: string;
  employment_date: string;
  employment_status: 'active' | 'inactive' | 'terminated' | 'on_leave';
  enrollment_status: 'pending' | 'enrolled' | 'verified';
  
  // Face recognition data
  face_embedding?: number[];
  photo_url?: string;
  face_enrolled_at?: string;
  face_match_threshold?: number;
  last_face_scan?: string;
  
  // Additional fields
  shift_schedule?: string;
  salary_grade?: string;
  supervisor_id?: string;
  emergency_contact?: string;
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Relationships
  face_enrollments?: StaffFaceEnrollment[];
  attendance_records?: StaffAttendanceRecord[];
}

export interface StaffFaceEnrollment {
  id: string;
  staff_id: string;
  staff?: Staff;
  embedding: number[];
  photo_url: string;
  quality_score: number;
  capture_device?: string;
  enrolled_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  has_local_image?: boolean;
}

export interface StaffAttendanceRecord {
  id: string;
  staff_id: string;
  staff?: Staff;
  staff_name?: string;
  department: 'studio' | 'logistics' | 'bakery' | 'spa';
  
  // Check times
  check_in_time: string;
  check_out_time?: string;
  date: string;
  
  // Status and verification
  status: 'present' | 'absent' | 'late' | 'early_departure' | 'excused';
  verified: boolean;
  device_id: string;
  location?: string;
  
  // Face verification data
  face_match_score?: number;
  photo_url?: string;
  verification_method?: 'face_recognition' | 'manual' | 'card_swipe';
  confidence_score?: number;
  
  // Work hours calculation
  total_hours?: number;
  overtime_minutes?: number;
  shift_type?: string;
  
  synced?: boolean;
  created_at: string;
  updated_at: string;
}

// ========== DEPARTMENT TYPES ==========
export interface Department {
  id: string;
  code: string;
  name: 'Studio' | 'Logistics' | 'Bakery' | 'Spa';  // Fixed values for your business
  description?: string;
  manager?: string;
  location?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ========== SHIFT MANAGEMENT ==========
export interface Shift {
  id: string;
  name: string;
  department: 'studio' | 'logistics' | 'bakery' | 'spa';
  start_time: string;
  end_time: string;
  duration_hours: number;
  break_duration_minutes?: number;
  is_night_shift: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffShiftAssignment {
  id: string;
  staff_id: string;
  staff?: Staff;
  shift_id: string;
  shift?: Shift;
  effective_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ========== ATTENDANCE SESSIONS ==========
export interface AttendanceSession {
  id: string;
  session_type: 'morning' | 'afternoon' | 'evening' | 'full_day' | 'special';
  session_date: string;
  start_time: string;
  end_time?: string;
  location?: string;
  
  // Department filtering (if needed)
  department?: 'studio' | 'logistics' | 'bakery' | 'spa';
  
  // Stats
  total_staff: number;
  attended_staff: number;
  late_arrivals: number;
  early_departures: number;
  
  status: 'active' | 'completed';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ========== LEAVE MANAGEMENT ==========
export interface LeaveRequest {
  id: string;
  staff_id: string;
  staff?: Staff;
  leave_type: 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'other';
  start_date: string;
  end_date: string;
  total_days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  approved_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ========== OVERTIME MANAGEMENT ==========
export interface OvertimeRecord {
  id: string;
  staff_id: string;
  staff?: Staff;
  date: string;
  start_time: string;
  end_time: string;
  total_minutes: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  approved_by?: string;
  rate_multiplier?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ========== FACE VERIFICATION TYPES ==========
export interface FaceMatchLog {
  id: string;
  staff_id?: string;
  session_id?: string;
  confidence: number;
  threshold: number;
  is_match: boolean;
  embedding?: number[];
  photo_url?: string;
  device_id: string;
  created_at: string;
}

export interface FaceVerificationResult {
  success: boolean;
  match: boolean;
  staff?: Staff;
  confidence?: number;
  matchScore?: number;
  message: string;
  timestamp: string;
  image?: string;
  sessionInfo?: {
    totalStaff?: number;
    department?: string;
    time?: string;
  };
}

// ========== ATTENDANCE RESULTS ==========
export interface AttendanceResult {
  success: boolean;
  staff?: {
    id: string;
    name: string;
    staff_id: string;
    department: string;
  };
  confidence?: number;
  message: string;
  timestamp: string;
  offline?: boolean;
  alreadyMarked?: boolean;
}

// ========== ENROLLMENT RESULTS ==========
export interface EnrollmentResult {
  success: boolean;
  staffId?: string;
  staffName?: string;
  embedding?: number[];
  quality?: number;
  photoUrl?: string;
  timestamp: string;
  message: string;
}

// ========== SYNCHRONIZATION ==========
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

// ========== REPORTS AND ANALYTICS ==========
export interface AttendanceSummary {
  date: string;
  department: string;
  total_staff: number;
  present: number;
  absent: number;
  late: number;
  early_departures: number;
  average_hours: number;
  total_overtime_minutes: number;
}

export interface DepartmentAttendance {
  department: 'studio' | 'logistics' | 'bakery' | 'spa';
  total_staff: number;
  present_count: number;
  attendance_rate: number;
  average_arrival_time: string;
  average_departure_time: string;
}

// ========== SETTINGS AND CONFIGURATION ==========
export interface AttendanceSettings {
  id: string;
  organization_name: string;
  timezone: string;
  work_start_time: string;
  work_end_time: string;
  late_threshold_minutes: number;
  early_departure_threshold_minutes: number;
  overtime_start_minutes: number;
  face_match_threshold: number;
  auto_capture_interval: number;
  enable_auto_capture: boolean;
  enable_email_notifications: boolean;
  enable_sms_notifications: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ========== UTILITY TYPES ==========
export interface DailyAttendanceStats {
  date: string;
  studio: AttendanceStats;
  logistics: AttendanceStats;
  bakery: AttendanceStats;
  spa: AttendanceStats;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  attendance_rate: number;
}

export interface StaffDashboardStats {
  total_staff: number;
  active_staff: number;
  todays_attendance: number;
  attendance_rate: number;
  pending_leave_requests: number;
  monthly_overtime_hours: number;
  department_breakdown: DepartmentBreakdown[];
}

export interface DepartmentBreakdown {
  department: string;
  staff_count: number;
  todays_present: number;
  attendance_rate: number;
}