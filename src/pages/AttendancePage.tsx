// src/pages/AttendancePage.tsx - PROFESSIONAL MODERN VERSION
import React, { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Button,
  Typography,
  message,
  Grid,
  Steps,
  Tag,
  Space,
  Progress,
  Avatar,
  Divider,
  Row,
  Col,
  Statistic
} from 'antd';
import { 
  Camera, 
  Calendar, 
  CheckCircle, 
  Filter,
  Shield,
  User,
  Users,
  Clock,
  BookOpen,
  Award,
  ChevronRight,
  X
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import faceRecognition from '../utils/faceRecognition';
import dayjs from 'dayjs';
import './AttendancePage.css';

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
  const [studentStats, setStudentStats] = useState<any>(null);

  // Progress steps
  const steps = [
    { title: 'Select Course', icon: <BookOpen size={16} /> },
    { title: 'Face Verification', icon: <Camera size={16} /> },
    { title: 'Attendance Confirmed', icon: <Award size={16} /> },
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

  // Fetch course statistics
  const fetchCourseStats = async (courseCode: string) => {
    try {
      const { data, error } = await supabase
        .from('student_attendance')
        .select('student_id')
        .eq('course_code', courseCode)
        .eq('attendance_date', dayjs().format('YYYY-MM-DD'));
      
      if (!error && data) {
        setStudentStats({
          attendedToday: data.length,
          totalEnrolled: selectedCourseData?.enrolled_count || 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Record Attendance
  const recordAttendance = async (studentData: any, result: any) => {
    try {
      const attendanceDate = dayjs().format('YYYY-MM-DD');
      const studentId = studentData.student_id;
      
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
      
      const { data: existingAttendance } = await supabase
        .from('student_attendance')
        .select('id')
        .eq('student_id', studentId)
        .eq('course_code', selectedCourseData.code)
        .eq('attendance_date', attendanceDate)
        .single();
      
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
      
      return { success: true, studentName: studentData.name };
      
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
          setCurrentStep(0);
          return;
        }
        
        const bestMatch = matches[0];
        if (bestMatch.confidence < 0.65) {
          message.warning('Low confidence match. Please try again.');
          setCurrentStep(0);
          return;
        }
        
        const { data: studentData } = await supabase
          .from('students')
          .select('*')
          .eq('student_id', bestMatch.studentId)
          .eq('enrollment_status', 'enrolled')
          .maybeSingle();
        
        if (!studentData) {
          message.error('Student not enrolled in this course');
          setCurrentStep(0);
          return;
        }
        
        setCurrentStep(2);
        
        // Record attendance
        const attendanceResult = await recordAttendance(studentData, {
          confidence: bestMatch.confidence,
          photoUrl: result.photoUrl
        });
        
        // Update stats
        if (studentStats) {
          setStudentStats(prev => ({
            ...prev,
            attendedToday: prev.attendedToday + 1
          }));
        }
        
        setFaceResult({
          ...result,
          student: {
            name: studentData.name,
            matric_number: studentData.matric_number,
            student_id: studentData.student_id,
            department: studentData.department,
            level: studentData.level
          },
          confidence: bestMatch.confidence,
          success: true,
          attendanceResult,
          timestamp: new Date().toISOString()
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
        message.loading({ content: 'Initializing face recognition...', key: 'modelLoad', duration: 2 });
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
        message.success({ content: 'Face recognition ready!', key: 'modelLoad' });
      } catch (error) {
        message.warning({ content: 'Using basic face detection', key: 'modelLoad' });
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
      if (course?.code) {
        fetchCourseStats(course.code);
      }
    }
  }, [selectedCourse, courses]);

  return (
    <div className="attendance-container">
      {/* Modern Header */}
      <div className="attendance-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-container">
              <Camera size={24} color="#1890ff" />
              <Title level={4} style={{ margin: 0, marginLeft: 12 }}>
                Face Attendance System
              </Title>
            </div>
            <Text type="secondary" className="header-subtitle">
              Automated biometric attendance marking
            </Text>
          </div>
          <div className="header-right">
            <Tag color={faceModelsLoaded ? "success" : "processing"} className="status-tag">
              <Shield size={12} style={{ marginRight: 6 }} />
              {faceModelsLoaded ? 'AI Active' : 'AI Loading'}
            </Tag>
            <Text type="secondary" className="date-display">
              <Clock size={14} style={{ marginRight: 6 }} />
              {dayjs().format('DD MMM YYYY • HH:mm')}
            </Text>
          </div>
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="dashboard-grid">
        {/* Left Column - Course Selection & Camera */}
        <Card className="dashboard-card control-card">
          <div className="card-header">
            <Title level={5} className="card-title">
              <BookOpen size={18} style={{ marginRight: 10 }} />
              Course Selection
            </Title>
          </div>
          
          <div className="course-selection-section">
            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>
              Select Course
            </Text>
            <Select
              className="course-select"
              placeholder="Search course by code or title..."
              value={selectedCourse}
              onChange={setSelectedCourse}
              loading={loading}
              size="large"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              optionFilterProp="label"
              suffixIcon={<ChevronRight size={16} />}
              options={courses.map(course => ({
                value: course.id,
                label: `${course.code} - ${course.title}`,
              }))}
            />
            
            {selectedCourseData && (
              <div className="course-info-panel">
                <div className="course-info-header">
                  <Text strong style={{ fontSize: '16px' }}>
                    {selectedCourseData.code}
                  </Text>
                  <Tag color="blue" className="level-tag">
                    Level {selectedCourseData.level}
                  </Tag>
                </div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  {selectedCourseData.title}
                </Text>
                
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col span={12}>
                    <Statistic
                      title="Enrolled Students"
                      value={selectedCourseData.enrolled_count || 0}
                      prefix={<Users size={14} />}
                      valueStyle={{ fontSize: '20px', fontWeight: 600 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Attended Today"
                      value={studentStats?.attendedToday || 0}
                      prefix={<User size={14} />}
                      valueStyle={{ 
                        fontSize: '20px', 
                        fontWeight: 600,
                        color: studentStats?.attendedToday > 0 ? '#52c41a' : undefined
                      }}
                    />
                  </Col>
                </Row>
              </div>
            )}
          </div>
          
          {/* Camera Section */}
          {selectedCourse && !isCameraActive && (
            <div className="camera-control-section">
              <div className="scan-ready-card">
                <div className="scan-icon">
                  <Camera size={32} color="#1890ff" />
                </div>
                <div className="scan-text">
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>
                    Ready to Scan
                  </Text>
                  <Text type="secondary" style={{ fontSize: '13px' }}>
                    Ensure student is facing the camera with good lighting
                  </Text>
                </div>
              </div>
              
              <Button
                type="primary"
                icon={<Camera size={20} />}
                onClick={startFaceAttendance}
                loading={loading}
                className="scan-button"
                size="large"
                block
              >
                Start Face Verification
              </Button>
            </div>
          )}
          
          {isCameraActive && (
            <div className="camera-active-section">
              <div className="camera-header">
                <Text strong style={{ fontSize: '16px' }}>
                  <Camera size={18} style={{ marginRight: 8 }} />
                  Live Face Scan
                </Text>
                <Button
                  type="text"
                  icon={<X size={16} />}
                  onClick={() => {
                    setIsCameraActive(false);
                    setCurrentStep(0);
                  }}
                  className="close-camera-btn"
                >
                  Cancel
                </Button>
              </div>
              
              <div className="camera-container">
                <FaceCamera
                  mode="attendance"
                  onAttendanceComplete={handleAttendanceComplete}
                />
                <div className="camera-guidelines">
                  <Text type="secondary" style={{ fontSize: '12px', textAlign: 'center' }}>
                    Position face within the frame • Ensure good lighting • Remove sunglasses/hats
                  </Text>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Right Column - Results & Progress */}
        <Card className="dashboard-card result-card">
          <div className="card-header">
            <Title level={5} className="card-title">
              <Award size={18} style={{ marginRight: 10 }} />
              Attendance Results
            </Title>
            <Steps
              current={currentStep}
              size="small"
              items={steps}
              className="progress-steps"
            />
          </div>
          
          {/* Empty State */}
          {!faceResult && currentStep === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <User size={48} color="#d9d9d9" />
              </div>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: '16px' }}>
                No Attendance Yet
              </Text>
              <Text type="secondary" style={{ textAlign: 'center' }}>
                {selectedCourse 
                  ? 'Start scanning to mark attendance for selected course'
                  : 'Select a course to begin'}
              </Text>
            </div>
          )}
          
          {/* Scanning State */}
          {isCameraActive && currentStep === 1 && (
            <div className="scanning-state">
              <div className="scanning-animation">
                <div className="pulse-ring"></div>
                <Camera size={32} color="#1890ff" className="scanning-icon" />
              </div>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: '18px' }}>
                Scanning Face...
              </Text>
              <Text type="secondary" style={{ textAlign: 'center' }}>
                Please keep still while we verify your identity
              </Text>
              <Progress
                percent={45}
                status="active"
                strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                className="scan-progress"
              />
            </div>
          )}
          
          {/* Success State */}
          {faceResult?.success && (
            <div className="success-state">
              <div className="success-header">
                <div className="success-icon">
                  <CheckCircle size={40} color="#52c41a" />
                </div>
                <div>
                  <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                    Attendance Confirmed!
                  </Title>
                  <Text type="secondary">
                    Successfully recorded for {selectedCourseData?.code}
                  </Text>
                </div>
              </div>
              
              <Divider style={{ margin: '20px 0' }} />
              
              {/* Student Details */}
              <div className="student-details-card">
                <div className="student-header">
                  <Avatar size={56} className="student-avatar">
                    {faceResult.student?.name?.charAt(0) || 'S'}
                  </Avatar>
                  <div className="student-info">
                    <Text strong style={{ fontSize: '20px', display: 'block' }}>
                      {faceResult.student?.name}
                    </Text>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                      {faceResult.student?.matric_number}
                    </Text>
                    <Space size={[8, 8]} wrap>
                      <Tag color="blue" className="detail-tag">
                        {faceResult.student?.department}
                      </Tag>
                      <Tag color="purple" className="detail-tag">
                        Level {faceResult.student?.level}
                      </Tag>
                      <Tag color="green" className="detail-tag">
                        {dayjs(faceResult.timestamp).format('HH:mm')}
                      </Tag>
                    </Space>
                  </div>
                </div>
                
                <Divider style={{ margin: '16px 0' }} />
                
                {/* Confidence Meter */}
                <div className="confidence-meter">
                  <div className="meter-header">
                    <Text strong>Match Confidence</Text>
                    <Text strong style={{ 
                      color: faceResult.confidence > 0.8 ? '#52c41a' : 
                             faceResult.confidence > 0.6 ? '#faad14' : '#f5222d'
                    }}>
                      {(faceResult.confidence * 100).toFixed(1)}%
                    </Text>
                  </div>
                  <Progress
                    percent={Number((faceResult.confidence * 100).toFixed(1))}
                    strokeColor={{
                      '0%': '#f5222d',
                      '50%': '#faad14',
                      '100%': '#52c41a'
                    }}
                    strokeLinecap="round"
                    className="confidence-bar"
                  />
                  <div className="confidence-labels">
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {faceResult.confidence > 0.8 ? 'High Confidence Match' : 
                       faceResult.confidence > 0.6 ? 'Good Match' : 'Verify Manually'}
                    </Text>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="action-buttons">
                  <Button
                    type="primary"
                    icon={<Camera size={16} />}
                    onClick={startFaceAttendance}
                    className="next-student-btn"
                    size="large"
                  >
                    Scan Next Student
                  </Button>
                  <Button
                    type="default"
                    onClick={() => {
                      setFaceResult(null);
                      setCurrentStep(0);
                    }}
                    className="change-course-btn"
                    size="large"
                  >
                    Change Course
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Course Stats Footer */}
          {selectedCourseData && (
            <div className="stats-footer">
              <Divider style={{ margin: '20px 0' }} />
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <div className="stat-item">
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                      Total Enrolled
                    </Text>
                    <Text strong style={{ fontSize: '18px' }}>
                      {selectedCourseData.enrolled_count || 0}
                    </Text>
                  </div>
                </Col>
                <Col span={12}>
                  <div className="stat-item">
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                      Present Today
                    </Text>
                    <Text strong style={{ 
                      fontSize: '18px',
                      color: studentStats?.attendedToday > 0 ? '#52c41a' : undefined
                    }}>
                      {studentStats?.attendedToday || 0}
                    </Text>
                  </div>
                </Col>
              </Row>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AttendancePage;