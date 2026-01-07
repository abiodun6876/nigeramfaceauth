// src/pages/AttendancePage.tsx - SIMPLIFIED MOBILE VERSION
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Select,
  Button,
  Typography,
  message,
  Grid,
  Space,
  Tag,
  Statistic,
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
const { useBreakpoint } = Grid;

const AttendancePage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  
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
      padding: 0,
      margin: 0,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f0f2f5'
    }}>
      {/* Header - Fixed at top */}
      <div style={{ 
        textAlign: 'center', 
        padding: '12px 16px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #f0f0f0',
        flexShrink: 0
      }}>
        <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
          Face Attendance
        </Title>
      </div>

      {/* Main Content - Takes remaining space */}
      <div style={{ 
        flex: 1,
        overflow: 'hidden',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Course Selection */}
        {!selectedCourse && (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px 0',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{
              width: 60,
              height: 60,
              backgroundColor: '#f0f9ff',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <Camera size={28} color="#1890ff" />
            </div>
            
            <Text style={{ fontSize: 16, marginBottom: 24, fontWeight: 500 }}>
              Select Course
            </Text>
            
            <Select
              style={{ width: '100%' }}
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
            padding: '20px 0',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              width: 70,
              height: 70,
              backgroundColor: '#52c41a20',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <Camera size={32} color="#52c41a" />
            </div>
            
            <Text style={{ 
              fontSize: 18, 
              marginBottom: 8, 
              color: '#52c41a',
              fontWeight: 600
            }}>
              {selectedCourseData.code}
            </Text>
            <Text type="secondary" style={{ 
              marginBottom: 32, 
              fontSize: 14 
            }}>
              {selectedCourseData.title}
            </Text>
            
            <Button
              type="primary"
              icon={<Camera size={18} />}
              onClick={startScanning}
              size="large"
              style={{
                height: 52,
                fontSize: 16,
                padding: '0 40px',
                borderRadius: 12,
                minWidth: 200
              }}
            >
              Start Scanning
            </Button>
          </div>
        )}

        {/* Active Scanning - Full height layout */}
        {isCameraActive && selectedCourseData && (
          <div style={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            {/* Camera Feed - Takes 60% */}
            <div style={{ 
              flex: 6,
              minHeight: 0 // Important for flex children to shrink properly
            }}>
              <FaceCamera
                mode="attendance"
                onAttendanceComplete={handleFaceDetection}
                autoCapture={true}
                captureInterval={3000}
              />
            </div>

            {/* Results Panel - Takes 40% */}
            <div style={{ 
              flex: 4,
              paddingTop: 12,
              minHeight: 0
            }}>
              {/* Last Scan Result - Compact */}
              {lastScanResult && (
                <Card
                  style={{
                    marginBottom: 12,
                    borderRadius: 12,
                    border: 'none',
                    backgroundColor: lastScanResult.success ? '#f6ffed' : 
                                    lastScanResult.type === 'already_marked' ? '#fff7e6' : 
                                    '#fff2f0'
                  }}
                  bodyStyle={{ 
                    padding: '16px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginBottom: 12
                  }}>
                    {lastScanResult.success ? (
                      <CheckCircle size={28} color="#52c41a" />
                    ) : lastScanResult.type === 'already_marked' ? (
                      <XCircle size={28} color="#fa8c16" />
                    ) : (
                      <XCircle size={28} color="#ff4d4f" />
                    )}
                  </div>
                  
                  {lastScanResult.success && (
                    <>
                      <Text strong style={{ 
                        fontSize: '16px', 
                        display: 'block',
                        marginBottom: 4
                      }}>
                        {lastScanResult.student?.name}
                      </Text>
                      <Text type="secondary" style={{ 
                        display: 'block', 
                        fontSize: '14px',
                        marginBottom: 8
                      }}>
                        {lastScanResult.student?.matric_number}
                      </Text>
                      <Text style={{ 
                        display: 'block', 
                        color: '#52c41a',
                        fontSize: '14px'
                      }}>
                        ✓ Marked
                      </Text>
                    </>
                  )}
                  
                  {lastScanResult.type === 'already_marked' && (
                    <>
                      <Text strong style={{ 
                        fontSize: '16px', 
                        display: 'block',
                        marginBottom: 4
                      }}>
                        {lastScanResult.student?.name}
                      </Text>
                      <Text style={{ 
                        display: 'block', 
                        color: '#fa8c16',
                        fontSize: '14px'
                      }}>
                        Already Marked
                      </Text>
                    </>
                  )}
                  
                  {!lastScanResult.success && lastScanResult.type !== 'already_marked' && (
                    <Text style={{ 
                      display: 'block', 
                      color: '#ff4d4f',
                      fontSize: '14px'
                    }}>
                      Scan Failed
                    </Text>
                  )}
                </Card>
              )}

              {/* Status Bar */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderTop: '1px solid #f0f0f0',
                borderBottom: '1px solid #f0f0f0',
                marginBottom: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge status="processing" color="green" />
                  <Text style={{ fontSize: 14, fontWeight: 500 }}>
                    {selectedCourseData.code}
                  </Text>
                </div>
                <Button
                  type="text"
                  onClick={resetScanner}
                  size="small"
                  style={{ fontSize: 12 }}
                >
                  Change Course
                </Button>
              </div>

              {/* Compact Stats */}
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8
              }}>
                <div style={{ textAlign: 'center' }}>
                  <Text style={{ 
                    fontSize: 20, 
                    fontWeight: 'bold',
                    display: 'block'
                  }}>
                    {scanCount}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Total
                  </Text>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Text style={{ 
                    fontSize: 20, 
                    fontWeight: 'bold',
                    color: '#52c41a',
                    display: 'block'
                  }}>
                    {successfulScans}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Success
                  </Text>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Text style={{ 
                    fontSize: 20, 
                    fontWeight: 'bold',
                    color: '#fa8c16',
                    display: 'block'
                  }}>
                    {alreadyMarkedScans}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Duplicates
                  </Text>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Fixed at bottom */}
      <div style={{ 
        textAlign: 'center', 
        padding: '12px 16px',
        backgroundColor: '#fff',
        borderTop: '1px solid #f0f0f0',
        flexShrink: 0
      }}>
        <Space>
          <Tag color={faceModelsLoaded ? "green" : "orange"} style={{ fontSize: 12 }}>
            {faceModelsLoaded ? 'Ready' : 'Loading...'}
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <Clock size={10} style={{ marginRight: 4 }} />
            {dayjs().format('HH:mm')}
          </Text>
        </Space>
      </div>
    </div>
  );
};

export default AttendancePage;