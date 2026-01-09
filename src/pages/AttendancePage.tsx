// src/pages/AttendancePage.tsx - FUTURISTIC BLUE DESIGN
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Select,
  Button,
  Typography,
  Space,
  Tag,
  Badge
} from 'antd';
import { 
  Camera, 
  CheckCircle, 
  XCircle,
  Clock
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import faceRecognition from '../utils/faceRecognition';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const AttendancePage: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedCourseData, setSelectedCourseData] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [successfulScans, setSuccessfulScans] = useState(0);
  const [alreadyMarkedScans, setAlreadyMarkedScans] = useState(0);
  
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markedStudentsRef = useRef<Set<string>>(new Set());

  // Fetch courses
  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('code');
      
      if (error) throw error;
      setCourses(data || []);
    } catch (error: any) {
      console.error('Error fetching courses:', error);
    }
  };

  // Check if student already marked attendance today
  const checkExistingAttendance = async (studentId: string): Promise<boolean> => {
    if (!selectedCourseData) return false;
    
    try {
      const attendanceDate = dayjs().format('YYYY-MM-DD');
      
      const { data, error } = await supabase
        .from('student_attendance')
        .select('id')
        .eq('student_id', studentId)
        .eq('course_code', selectedCourseData.code)
        .eq('attendance_date', attendanceDate)
        .maybeSingle();
      
      if (error) throw error;
      
      return !!data;
    } catch (error) {
      console.error('Error checking existing attendance:', error);
      return false;
    }
  };

  // Record Attendance
  const recordAttendance = async (studentData: any, confidence: number) => {
    try {
      const attendanceDate = dayjs().format('YYYY-MM-DD');
      
      // Check if already marked in database
      const alreadyMarked = await checkExistingAttendance(studentData.student_id);
      if (alreadyMarked) {
        return { success: false, alreadyMarked: true };
      }
      
      // Check if already marked in this session
      const studentKey = `${studentData.student_id}-${selectedCourseData.code}-${attendanceDate}`;
      if (markedStudentsRef.current.has(studentKey)) {
        return { success: false, alreadyMarked: true };
      }

      const attendanceData = {
        student_id: studentData.student_id,
        student_name: studentData.name,
        matric_number: studentData.matric_number,
        course_code: selectedCourseData.code,
        course_title: selectedCourseData.title,
        level: studentData.level || selectedCourseData.level,
        attendance_date: attendanceDate,
        check_in_time: new Date().toISOString(),
        status: 'present',
        verification_method: 'face_recognition',
        confidence_score: confidence,
        score: 2.00,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('student_attendance')
        .insert([attendanceData]);
      
      if (error) throw error;
      
      markedStudentsRef.current.add(studentKey);
      
      return { success: true, alreadyMarked: false };
      
    } catch (error: any) {
      console.error('Record attendance error:', error);
      throw error;
    }
  };

  // Handle face detection
  const handleFaceDetection = async (result: any) => {
    if (!result.success || !result.photoUrl || isProcessing || !selectedCourseData) return;
    
    setIsProcessing(true);
    setScanCount(prev => prev + 1);
    
    try {
      const matches = await faceRecognition.matchFaceForAttendance(result.photoUrl);
      
      if (matches.length === 0 || matches[0].confidence < 0.60) {
        setLastScanResult({ 
          success: false,
          type: 'no_match'
        });
        return;
      }
      
      const bestMatch = matches[0];
      
      // Get student data
      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .eq('student_id', bestMatch.studentId)
        .eq('enrollment_status', 'enrolled')
        .maybeSingle();
      
      if (!studentData) {
        setLastScanResult({ 
          success: false,
          type: 'not_enrolled'
        });
        return;
      }
      
      // Record attendance
      const attendanceResult = await recordAttendance(studentData, bestMatch.confidence);
      
      if (attendanceResult.alreadyMarked) {
        setLastScanResult({
          success: false,
          type: 'already_marked',
          student: {
            name: studentData.name,
            matric_number: studentData.matric_number
          }
        });
        setAlreadyMarkedScans(prev => prev + 1);
      } else if (attendanceResult.success) {
        setLastScanResult({
          success: true,
          student: {
            name: studentData.name,
            matric_number: studentData.matric_number
          }
        });
        setSuccessfulScans(prev => prev + 1);
        
        // Auto-reset after 1.5 seconds
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
        scanTimeoutRef.current = setTimeout(() => {
          setLastScanResult(null);
        }, 1500);
      }
      
    } catch (error: any) {
      console.error('Face recognition error:', error);
      setLastScanResult({ 
        success: false,
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Start scanning
  const startScanning = async () => {
    if (!faceModelsLoaded) {
      try {
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
      } catch (error) {
        console.log('Face models loading...');
      }
    }
    setIsCameraActive(true);
    setLastScanResult(null);
    markedStudentsRef.current.clear();
  };

  // Stop scanning
  const stopScanning = () => {
    setIsCameraActive(false);
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
  };

  // Reset scanner
  const resetScanner = () => {
    setIsCameraActive(false);
    setLastScanResult(null);
    setSelectedCourse('');
    setSelectedCourseData(null);
    setScanCount(0);
    setSuccessfulScans(0);
    setAlreadyMarkedScans(0);
    markedStudentsRef.current.clear();
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
  };

  useEffect(() => {
    fetchCourses();
    
    const loadModels = async () => {
      try {
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
      } catch (error) {
        console.log('Face models loading...');
      }
    };
    loadModels();

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      const course = courses.find(c => c.id === selectedCourse);
      setSelectedCourseData(course);
      markedStudentsRef.current.clear();
    }
  }, [selectedCourse]);

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a1a35', // Futuristic dark blue
      color: '#ffffff'
    }}>
      {/* Main Content - Fills screen */}
      <div style={{ 
        flex: 1,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Course Selection */}
        {!selectedCourse && (
          <div style={{ 
            textAlign: 'center', 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              width: 80,
              height: 80,
              backgroundColor: 'rgba(0, 150, 255, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              border: '2px solid rgba(0, 150, 255, 0.5)',
              boxShadow: '0 0 20px rgba(0, 150, 255, 0.3)'
            }}>
              <Camera size={36} color="#00aaff" />
            </div>
            
            <Text style={{ 
              fontSize: 20, 
              marginBottom: 24, 
              fontWeight: 600,
              color: '#ffffff'
            }}>
              SELECT COURSE
            </Text>
            
            <Select
              style={{ 
                width: '100%', 
                maxWidth: 400,
                marginBottom: 24
              }}
              placeholder="Choose course..."
              value={selectedCourse}
              onChange={setSelectedCourse}
              size="large"
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => {
                const label = option?.label?.toString().toLowerCase() || '';
                return label.includes(input.toLowerCase());
              }}
              options={courses.map(course => ({
                value: course.id,
                label: `${course.code} - ${course.title}`,
              }))}
            />
          </div>
        )}

        {/* Course Selected - Ready to Scan */}
        {selectedCourse && !isCameraActive && selectedCourseData && (
          <div style={{ 
            textAlign: 'center', 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              width: 100,
              height: 100,
              backgroundColor: 'rgba(0, 255, 150, 0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              border: '2px solid rgba(0, 255, 150, 0.5)',
              boxShadow: '0 0 30px rgba(0, 255, 150, 0.2)',
              animation: 'pulse 2s infinite'
            }}>
              <Camera size={44} color="#00ffaa" />
            </div>
            
            <Text style={{ 
              fontSize: 24, 
              marginBottom: 8, 
              color: '#00ffaa',
              fontWeight: 700,
              textShadow: '0 0 10px rgba(0, 255, 150, 0.5)'
            }}>
              {selectedCourseData.code}
            </Text>
            
            <Button
              type="primary"
              icon={<Camera size={20} />}
              onClick={startScanning}
              size="large"
              style={{
                height: 60,
                fontSize: 18,
                padding: '0 48px',
                borderRadius: 12,
                backgroundColor: '#00aaff',
                border: 'none',
                marginTop: 32,
                boxShadow: '0 0 20px rgba(0, 170, 255, 0.4)'
              }}
            >
              START SCANNING
            </Button>
          </div>
        )}

        {/* Active Scanning */}
        {isCameraActive && selectedCourseData && (
          <div style={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            {/* Success Count Badge - Top Right */}
            <div style={{
              position: 'absolute',
              top: 20,
              right: 20,
              zIndex: 100
            }}>
              <div style={{
                width: 50,
                height: 50,
                backgroundColor: 'rgba(0, 255, 150, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #00ffaa',
                boxShadow: '0 0 15px rgba(0, 255, 150, 0.3)'
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: 'bold',
                  color: '#00ffaa'
                }}>
                  {successfulScans}
                </Text>
              </div>
            </div>

            {/* Course Code Badge - Top Left */}
            <div style={{
              position: 'absolute',
              top: 20,
              left: 20,
              zIndex: 100
            }}>
              <div style={{
                backgroundColor: 'rgba(0, 150, 255, 0.2)',
                color: '#00aaff',
                padding: '8px 16px',
                borderRadius: 20,
                border: '1px solid rgba(0, 150, 255, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <Badge status="processing" color="#00ffaa" />
                <Text style={{ fontSize: 14, fontWeight: 600 }}>
                  {selectedCourseData.code}
                </Text>
              </div>
            </div>

            {/* Camera Feed - Full screen */}
            <div style={{ 
              flex: 1,
              minHeight: 0,
              position: 'relative'
            }}>
              <div style={{ 
                height: '100%',
                borderRadius: 16,
                overflow: 'hidden',
                border: '2px solid rgba(0, 150, 255, 0.3)',
                boxShadow: '0 0 30px rgba(0, 150, 255, 0.2)'
              }}>
                <FaceCamera
                  mode="attendance"
                  onAttendanceComplete={handleFaceDetection}
                  autoCapture={true}
                  captureInterval={3000}
                />
              </div>

              {/* Scan Status Overlay */}
              {isProcessing && (
                <div style={{
                  position: 'absolute',
                  bottom: 20,
                  left: 0,
                  right: 0,
                  textAlign: 'center'
                }}>
                  <div style={{
                    display: 'inline-block',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: '#00ffaa',
                    padding: '8px 20px',
                    borderRadius: 20,
                    fontSize: 14,
                    fontWeight: 600,
                    backdropFilter: 'blur(10px)'
                  }}>
                    SCANNING...
                  </div>
                </div>
              )}
            </div>

            {/* Last Scan Result - Minimal */}
            {lastScanResult && (
              <div style={{
                position: 'absolute',
                bottom: 80,
                left: 0,
                right: 0,
                textAlign: 'center',
                zIndex: 100
              }}>
                <div style={{
                  display: 'inline-block',
                  backgroundColor: lastScanResult.success 
                    ? 'rgba(0, 255, 150, 0.15)' 
                    : lastScanResult.type === 'already_marked'
                    ? 'rgba(255, 200, 0, 0.15)'
                    : 'rgba(255, 50, 50, 0.15)',
                  color: lastScanResult.success 
                    ? '#00ffaa' 
                    : lastScanResult.type === 'already_marked'
                    ? '#ffcc00'
                    : '#ff3333',
                  padding: '12px 24px',
                  borderRadius: 12,
                  border: lastScanResult.success 
                    ? '1px solid rgba(0, 255, 150, 0.5)' 
                    : lastScanResult.type === 'already_marked'
                    ? '1px solid rgba(255, 200, 0, 0.5)'
                    : '1px solid rgba(255, 50, 50, 0.5)',
                  fontSize: 16,
                  fontWeight: 600,
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)'
                }}>
                  {lastScanResult.success ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={20} />
                      <span>{lastScanResult.student?.name}</span>
                    </div>
                  ) : lastScanResult.type === 'already_marked' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <XCircle size={20} />
                      <span>ALREADY MARKED</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <XCircle size={20} />
                      <span>SCAN FAILED</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Control Buttons - Bottom */}
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 16,
              zIndex: 100
            }}>
              <Button
                type="primary"
                onClick={resetScanner}
                style={{
                  backgroundColor: 'rgba(0, 150, 255, 0.3)',
                  border: '1px solid rgba(0, 150, 255, 0.5)',
                  color: '#00aaff',
                  padding: '8px 20px',
                  borderRadius: 20,
                  backdropFilter: 'blur(10px)'
                }}
              >
                CHANGE COURSE
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Status Footer - Minimal */}
      <div style={{ 
        padding: '8px 16px',
        backgroundColor: 'rgba(10, 26, 53, 0.8)',
        borderTop: '1px solid rgba(0, 150, 255, 0.2)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: faceModelsLoaded ? '#00ffaa' : '#ffaa00',
              boxShadow: faceModelsLoaded ? '0 0 8px #00ffaa' : '0 0 8px #ffaa00'
            }} />
            <Text style={{ fontSize: 11, color: '#aaccff' }}>
              {faceModelsLoaded ? 'READY' : 'LOADING'}
            </Text>
          </Space>
          <Text style={{ fontSize: 11, color: '#aaccff' }}>
            <Clock size={10} style={{ marginRight: 4 }} />
            {dayjs().format('HH:mm')}
          </Text>
        </div>
      </div>

      {/* Add CSS animations */}
      <style>
        {`
          @keyframes pulse {
            0% { box-shadow: 0 0 20px rgba(0, 255, 150, 0.2); }
            50% { box-shadow: 0 0 30px rgba(0, 255, 150, 0.4); }
            100% { box-shadow: 0 0 20px rgba(0, 255, 150, 0.2); }
          }
        `}
      </style>
    </div>
  );
};

export default AttendancePage;