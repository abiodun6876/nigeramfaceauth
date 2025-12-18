// src/types/database.ts
export interface Student {
  id: string;
  student_id: string;
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  faculty_id?: string;
  faculty_code?: string;
  faculty?: Faculty;
  department_id?: string;
  department_code?: string;
  department?: Department;
  program_id?: string;
  program?: Program;
  current_level_id?: string;
  current_level?: Level;
  current_semester_id?: string;
  current_semester?: Semester;
  academic_session_id?: string;
  academic_session?: AcademicSession;
  admission_year?: string;
  year_of_entry?: string;
  matric_number?: string;
  program_name?: string;
  level_code?: string;
  level?: string | number; // For backward compatibility
  semester_number?: number;
  session_year?: string;
  course_codes?: string[];
  face_embedding?: number[];
  photo_url?: string;
  face_enrolled_at?: string;
  face_match_threshold?: number;
  enrollment_status: 'pending' | 'enrolled' | 'verified';
  last_face_scan?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lecturer {
  id: string;
  staff_id: string;
  name: string;
  email?: string;
  phone?: string;
  department_id?: string;
  department?: Department;
  faculty_id?: string;
  faculty?: Faculty;
  title?: string;
  is_active: boolean;
  device_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Faculty {
  id: string;
  code: string;
  name: string;
  description?: string;
  dean?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  faculty_id: string;
  faculty?: Faculty;
  code: string;
  name: string;
  hod?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Level {
  id: string;
  code: string;
  name: string;
  description?: string;
  level_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  code: string;
  name: string;
  short_name?: string;
  faculty_id?: string;
  faculty?: Faculty;
  department_id?: string;
  department?: Department;
  program_type?: 'UNDERGRADUATE' | 'POSTGRADUATE' | 'DIPLOMA' | 'CERTIFICATE';
  duration_years?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicSession {
  id: string;
  code: string;
  name: string;
  session_year: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Semester {
  id: string;
  code: string;
  name: string;
  academic_session_id?: string;
  academic_session?: AcademicSession;
  semester_number: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  department_id: string;
  department?: Department;
  level_id?: string;
  level?: Level;
  semester_id?: string;
  semester?: Semester;
  academic_session_id?: string;
  academic_session?: AcademicSession;
  credit_units: number;
  is_core: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  type: "class" | "lecture" | "seminar" | "exam" | "practical" | "tutorial" | "meeting" | "workshop";
  start_time: string;
  end_time: string;
  date: string;
  location?: string;
  faculty_id?: string;
  faculty_code?: string;
  faculty?: Faculty;
  department_id?: string;
  department_code?: string;
  department?: Department;
  program_id?: string;
  program?: Program;
  course_code?: string;
  course_title?: string;
  course_id?: string;
  course?: Course;
  level_id?: string;
  level?: Level;
  lecturer_id?: string;
  lecturer_name?: string;
  created_by: string;
  academic_session_id?: string;
  academic_session?: AcademicSession;
  semester_id?: string;
  semester?: Semester;
  auto_enroll?: boolean;
  max_capacity?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  event_id?: string; // Optional for session-based attendance
  session_id?: string; // New: For attendance sessions
  student_id: string;
  student_name?: string; // Added for session-based attendance
  matric_number?: string; // Added for session-based attendance
  faculty_code?: string; // Added for session-based attendance
  department_code?: string; // Added for session-based attendance
  program?: string; // Added for session-based attendance
  level?: number; // Added for session-based attendance
  student?: Student;
  check_in_time: string;
  check_out_time?: string;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  verified: boolean;
  device_id: string;
  synced?: boolean;
  face_match_score?: number; // Added for face verification score
  photo_url?: string; // Added for captured face photo
  created_at: string;
  updated_at: string;
}

// New interface for Attendance Session
export interface AttendanceSession {
  id: string;
  course_code: string;
  faculty_id: string;
  department_id: string;
  level: number;
  session_date: string;
  start_time: string;
  end_time?: string;
  total_students: number;
  attended_students: number;
  status: 'active' | 'completed';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaceEnrollment {
  id: string;
  student_id: string;
  embedding: number[];
  photo_url: string;
  quality_score: number;
  capture_device?: string;
  enrolled_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaceMatchLog {
  id: string;
  student_id?: string;
  event_id?: string;
  session_id?: string;
  confidence: number;
  threshold: number;
  is_match: boolean;
  embedding?: number[];
  photo_url?: string;
  device_id: string;
  created_at: string;
}

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

export interface StudentAcademicHistory {
  id: string;
  student_id: string;
  student?: Student;
  academic_session_id: string;
  academic_session?: AcademicSession;
  level_id: string;
  level?: Level;
  semester_id: string;
  semester?: Semester;
  program_id: string;
  program?: Program;
  cgpa?: number;
  status: 'ACTIVE' | 'PROBATION' | 'SUSPENDED' | 'WITHDRAWN' | 'GRADUATED' | 'DISMISSED';
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentCourseRegistration {
  id: string;
  student_id: string;
  student?: Student;
  course_id: string;
  course?: Course;
  academic_session_id: string;
  academic_session?: AcademicSession;
  semester_id: string;
  semester?: Semester;
  is_registered: boolean;
  registration_date?: string;
  created_at: string;
  updated_at: string;
}

// New interface for Face Verification Result
export interface FaceVerificationResult {
  success: boolean;
  match: boolean;
  student?: Student;
  confidence?: number;
  matchScore?: number;
  message: string;
  timestamp: string;
  image?: string;
  sessionInfo?: {
    totalStudents?: number;
    courseCode?: string;
    level?: number;
  };
}

// New interface for Enrollment Result
export interface EnrollmentResult {
  success: boolean;
  studentId?: string;
  studentName?: string;
  embedding?: number[];
  quality?: number;
  photoUrl?: string;
  timestamp: string;
  message: string;
}