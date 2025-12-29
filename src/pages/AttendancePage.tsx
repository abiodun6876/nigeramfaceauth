// src/pages/AttendancePage.tsx - ULTRA SIMPLIFIED VERSION
import React, { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Button,
  Typography,
  Alert,
  message,
  Grid,
  DatePicker,
  Steps,
  Tag,
  Space,
  Modal,
  Progress
} from 'antd';
import { 
  Camera, 
  Calendar, 
  CheckCircle, 
  Filter,
  Shield,
  User
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
  const [loading, setLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [faceResult, setFaceResult] = useState<any>(null);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Progress steps
  const steps = [
    { title: 'Select Course', icon: <Filter size={16} /> },
    { title: 'Face Scan', icon: <Camera size={16} /> },
    { title: 'Complete', icon: <CheckCircle size={16} /> },
  ];

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
      message.error('Failed to load courses');
    }
  };

  // Record Attendance
  const recordAttendance = async (studentData: any, result: any) => {
    try {
      const attendanceDate = dayjs().format('YYYY-MM-DD');
      const studentId = studentData.student_id;
      const studentName = studentData.name;
      
      // Check existing attendance
      const { data: existingAttendance } = await supabase
        .from('student_attendance')
        .select('id, score')
        .eq('student_id', studentId)
        .eq('course_code', selectedCourseData.code)
        .eq('attendance_date', attendanceDate)
        .single();
      
      const attendanceData = {
        student_id: studentId,
        student_name: studentData.name,
        matric_number: studentData.matric_number,
        course_code: selectedCourseData.code,
        course_title: selectedCourseData.title,
        level: studentData.level || selectedCourseData.level,
        attendance_date: attendanceDate,
        check_in_time: new Date().toISOString(),
        status: 'present',
        verification_method: 'face_recognition',
        confidence_score: result.confidence || 0.95,
        score: 2.00,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (existingAttendance) {
        await supabase
          .from('student_attendance')
          .update(attendanceData)
          .eq('id', existingAttendance.id);
      } else {
        await supabase
          .from('student_attendance')
          .insert([attendanceData]);
      }
      
      return { success: true, studentName };
      
    } catch (error: any) {
      console.error('Record attendance error:', error);
      throw error;
    }
  };

  // Face attendance handler
  const handleAttendanceComplete = async (result: any) => {
    setFaceResult(result);
    
    if (result.success && result.photoUrl) {
      setCurrentStep(1);
      
      try {
        const matches = await faceRecognition.matchFaceForAttendance(result.photoUrl);
        
        if (matches.length === 0) {
          message.error('No matching student found');
          return;
        }
        
        const bestMatch = matches[0];
        if (bestMatch.confidence < 0.65) {
          message.warning('Low confidence match. Please try again.');
          return;
        }
        
        const { data: studentData } = await supabase
          .from('students')
          .select('*')
          .eq('student_id', bestMatch.studentId)
          .eq('enrollment_status', 'enrolled')
          .maybeSingle();
        
        if (!studentData) {
          message.error('Student not enrolled');
          return;
        }
        
        setCurrentStep(2);
        
        // Record attendance
        const attendanceResult = await recordAttendance(studentData, {
          confidence: bestMatch.confidence,
          photoUrl: result.photoUrl
        });
        
        setFaceResult({
          ...result,
          student: {
            name: studentData.name,
            matric_number: studentData.matric_number,
            student_id: studentData.student_id
          },
          confidence: bestMatch.confidence,
          success: true,
          attendanceResult
        });
        
        message.success(`Attendance recorded for ${studentData.name}`);
        
      } catch (error: any) {
        console.error('Face recognition error:', error);
        message.error('Face recognition failed');
        setCurrentStep(0);
      }
    }
  };

  // Start face attendance
  const startFaceAttendance = async () => {
    if (!faceModelsLoaded) {
      try {
        message.info('Loading face recognition models...');
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
        message.success('Face recognition ready!');
      } catch (error) {
        message.warning('Face recognition loading...');
      }
    }
    setIsCameraActive(true);
    setCurrentStep(1);
    setFaceResult(null);
  };

  useEffect(() => {
    fetchCourses();
    const loadModels = async () => {
      try {
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
      } catch (error) {
        console.warn('Face models loading deferred');
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      const course = courses.find(c => c.id === selectedCourse);
      setSelectedCourseData(course);
      setCurrentStep(0);
    }
  }, [selectedCourse]);

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={3} style={{ marginBottom: 8, fontWeight: 600 }}>
          Face Attendance
        </Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          Scan student faces to mark attendance
        </Text>
      </div>

      {/* Main Card */}
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
        bodyStyle={{ padding: isMobile ? '20px' : '32px' }}
      >
        {/* Progress Steps */}
        <div style={{ marginBottom: 32 }}>
          <Steps
            current={currentStep}
            size="small"
            items={steps}
          />
        </div>

        {/* Course Selection */}
        {currentStep === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: '16px' }}>
                Select Course
              </Text>
              <Select
                style={{ width: '100%', maxWidth: 400 }}
                placeholder="Choose course..."
                value={selectedCourse}
                onChange={setSelectedCourse}
                loading={loading}
                size="large"
                showSearch
                options={courses.map(course => ({
                  value: course.id,
                  label: `${course.code} - ${course.title}`,
                }))}
              />
            </div>

            <div style={{ 
              backgroundColor: '#f6f9ff', 
              padding: '20px', 
              borderRadius: 8,
              marginTop: 24 
            }}>
              <User size={24} color="#1890ff" style={{ marginBottom: 12 }} />
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                Ready to scan
              </Text>
              <Tag color="blue" icon={<Shield size={12} />}>
                {faceModelsLoaded ? 'Face AI Ready' : 'Loading AI...'}
              </Tag>
            </div>
          </div>
        )}

        {/* Face Camera Section */}
        {isCameraActive && currentStep >= 1 && (
          <div style={{ textAlign: 'center' }}>
            <FaceCamera
              mode="attendance"
              onAttendanceComplete={handleAttendanceComplete}
            />
            
            <div style={{ marginTop: 24 }}>
              <Button
                type="default"
                onClick={() => {
                  setIsCameraActive(false);
                  setCurrentStep(0);
                }}
              >
                Cancel Scan
              </Button>
            </div>
          </div>
        )}

        {/* Start Scan Button */}
        {selectedCourse && currentStep === 0 && !isCameraActive && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Button
              type="primary"
              icon={<Camera size={20} />}
              onClick={startFaceAttendance}
              loading={loading}
              size="large"
              style={{
                height: 56,
                fontSize: '18px',
                padding: '0 40px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #1890ff, #52c41a)',
                border: 'none'
              }}
            >
              Start Face Scan
            </Button>
            <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: '14px' }}>
              Position student in front of the camera
            </Text>
          </div>
        )}

        {/* Result Display */}
        {faceResult?.success && (
          <div style={{ 
            marginTop: 32,
            textAlign: 'center',
            animation: 'fadeIn 0.5s ease-in'
          }}>
            <div style={{
              width: 64,
              height: 64,
              backgroundColor: '#52c41a20',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <CheckCircle size={32} color="#52c41a" />
            </div>
            
            <Title level={4} style={{ marginBottom: 8, color: '#52c41a' }}>
              Attendance Recorded!
            </Title>
            
            <div style={{ 
              backgroundColor: '#f6ffed',
              padding: '20px',
              borderRadius: 8,
              marginBottom: 16,
              border: '1px solid #b7eb8f'
            }}>
              <Text strong style={{ fontSize: '18px', display: 'block', marginBottom: 8 }}>
                {faceResult.student?.name}
              </Text>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                {faceResult.student?.matric_number}
              </Text>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 16,
                marginTop: 16
              }}>
                <Tag color="success" style={{ fontSize: '14px', padding: '4px 12px' }}>
                  {(faceResult.confidence * 100).toFixed(1)}% match
                </Tag>
                <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>
                  {selectedCourseData?.code}
                </Tag>
                <Tag color="purple" style={{ fontSize: '14px', padding: '4px 12px' }}>
                  {dayjs().format('HH:mm')}
                </Tag>
              </div>
            </div>

            {/* Confidence Progress Bar */}
            <div style={{ maxWidth: 300, margin: '20px auto' }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Match Confidence
              </Text>
              <Progress 
                percent={Number((faceResult.confidence * 100).toFixed(1))} 
                strokeColor={
                  faceResult.confidence > 0.8 ? '#52c41a' : 
                  faceResult.confidence > 0.6 ? '#faad14' : '#f5222d'
                }
                format={() => `${(faceResult.confidence * 100).toFixed(1)}%`}
              />
              <Text type="secondary" style={{ fontSize: '12px', marginTop: 8 }}>
                {faceResult.confidence > 0.8 ? 'High Confidence' : 
                 faceResult.confidence > 0.6 ? 'Medium Confidence' : 'Low Confidence'}
              </Text>
            </div>

            {/* Next Student Button */}
            <div style={{ marginTop: 32 }}>
              <Button
                type="primary"
                icon={<Camera size={16} />}
                onClick={startFaceAttendance}
                style={{ marginRight: 12 }}
              >
                Scan Next Student
              </Button>
              <Button
                type="default"
                onClick={() => {
                  setFaceResult(null);
                  setCurrentStep(0);
                }}
              >
                Select Another Course
              </Button>
            </div>
          </div>
        )}

        {/* No Course Selected */}
        {!selectedCourse && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: 80,
              height: 80,
              backgroundColor: '#f0f9ff',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20
            }}>
              <Camera size={36} color="#1890ff" />
            </div>
            <Title level={4} style={{ marginBottom: 12, fontWeight: 500 }}>
              Select a Course to Begin
            </Title>
            <Text type="secondary" style={{ maxWidth: 400, margin: '0 auto', display: 'block' }}>
              Choose a course to start recording attendance with face recognition.
            </Text>
          </div>
        )}
      </Card>

      {/* Status Footer */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: 32,
        padding: '16px',
        borderTop: '1px solid #f0f0f0'
      }}>
        <Space>
          <Tag color={faceModelsLoaded ? "green" : "orange"}>
            {faceModelsLoaded ? 'Face AI Active ✓' : 'AI Loading...'}
          </Tag>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            AFE Babalola University • {dayjs().format('DD MMM YYYY')}
          </Text>
        </Space>
      </div>
    </div>
  );
};

export default AttendancePage;