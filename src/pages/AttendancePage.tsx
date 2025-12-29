// src/pages/AttendancePage.tsx - PROFESSIONAL VERSION (CLEANED)
import React, { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Alert,
  Row,
  Col,
  Statistic,
  Modal,
  InputNumber,
  message,
  Grid,
  DatePicker,
  Steps,
  Progress,
  Badge,
  Divider,
  Switch,
  Tooltip,
} from 'antd';
import { 
  Camera, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Users, 
  RefreshCw,
  Filter,
  Download,
  Eye,
  Edit,
  Clock,
  Shield
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
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [scoreInputValue, setScoreInputValue] = useState<number>(2.00);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    attendanceRate: 0
  });
  
  // Face recognition
  const [faceResult, setFaceResult] = useState<any>(null);
  const [matchedStudentData, setMatchedStudentData] = useState<any>(null);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  // Quick stats
  const steps = [
    { title: 'Select Course', icon: <Filter size={16} /> },
    { title: 'Face Scan', icon: <Camera size={16} /> },
    { title: 'Confirm', icon: <CheckCircle size={16} /> },
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

  // Fetch attendance records
  const fetchAttendanceRecords = async () => {
    if (!selectedCourse) return;
    
    try {
      setLoading(true);
      const course = courses.find(c => c.id === selectedCourse);
      if (!course) return;
      setSelectedCourseData(course);
      
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('student_attendance')
        .select('*')
        .eq('course_code', course.code)
        .eq('attendance_date', selectedDate)
        .order('check_in_time', { ascending: false });
      
      if (attendanceError) throw attendanceError;
      setAttendanceRecords(attendanceData || []);
      
      // Calculate stats
      const { data: studentsData } = await supabase
        .from('students')
        .select('student_id')
        .eq('enrollment_status', 'enrolled');
      
      const totalStudents = studentsData?.length || 0;
      const presentToday = attendanceData?.length || 0;
      const attendanceRate = totalStudents > 0 ? (presentToday / totalStudents) * 100 : 0;
      
      setStats({ totalStudents, presentToday, attendanceRate });
      
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      message.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  // Record Attendance
  const recordAttendance = async (studentData: any, result: any) => {
    try {
      const attendanceDate = selectedDate;
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
      
      message.success(`Attendance recorded for ${studentName}`);
      fetchAttendanceRecords();
      
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
        
        setMatchedStudentData(studentData);
        setCurrentStep(2);
        
        setFaceResult({
          ...result,
          student: {
            name: studentData.name,
            matric_number: studentData.matric_number,
            student_id: studentData.student_id
          },
          confidence: bestMatch.confidence,
          success: true
        });
        
        await recordAttendance(studentData, {
          confidence: bestMatch.confidence,
          photoUrl: result.photoUrl
        });
        
      } catch (error: any) {
        console.error('Face recognition error:', error);
        message.error('Face recognition failed');
      }
    }
  };

  // Start face attendance
  const startFaceAttendance = async () => {
    if (!faceModelsLoaded) {
      try {
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
      } catch (error) {
        message.warning('Face recognition loading...');
      }
    }
    setIsCameraActive(true);
    setCurrentStep(1);
  };

  // Mark all present
  const handleMarkAllPresent = async () => {
    if (!selectedCourseData) {
      message.error('Select a course first');
      return;
    }
    
    Modal.confirm({
      title: 'Mark All Students Present',
      content: `Mark all enrolled students as present for ${selectedCourseData.title}?`,
      onOk: async () => {
        setLoading(true);
        try {
          const { data: studentsData } = await supabase
            .from('students')
            .select('student_id, name, matric_number, level')
            .eq('enrollment_status', 'enrolled');
          
          if (!studentsData) return;
          
          const attendanceRecords = studentsData.map(student => ({
            student_id: student.student_id,
            student_name: student.name,
            matric_number: student.matric_number,
            course_code: selectedCourseData.code,
            course_title: selectedCourseData.title,
            level: student.level || selectedCourseData.level,
            attendance_date: selectedDate,
            check_in_time: new Date().toISOString(),
            status: 'present',
            verification_method: 'batch',
            score: 2.00,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));
          
          await supabase
            .from('student_attendance')
            .insert(attendanceRecords);
          
          message.success(`Marked ${attendanceRecords.length} students present`);
          fetchAttendanceRecords();
          
        } catch (error) {
          message.error('Failed to mark all present');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Table columns
  const columns = [
    {
      title: 'Student',
      dataIndex: 'student_name',
      key: 'student_name',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.matric_number}
          </Text>
        </div>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'check_in_time',
      key: 'check_in_time',
      render: (time: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} />
          <span>{time ? dayjs(time).format('HH:mm') : '--:--'}</span>
        </div>
      ),
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      render: (score: number) => (
        <Tag color={score >= 1.5 ? 'success' : score >= 1.0 ? 'warning' : 'error'}>
          {score?.toFixed(2)} / 2.00
        </Tag>
      ),
    },
    {
      title: 'Method',
      dataIndex: 'verification_method',
      key: 'verification_method',
      render: (method: string) => (
        <Badge
          color={method === 'face_recognition' ? 'green' : 'blue'}
          text={method === 'face_recognition' ? 'Face ID' : 'Manual'}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          size="small"
          type="link"
          icon={<Edit size={14} />}
          onClick={() => {
            setSelectedStudent(record);
            setScoreInputValue(record.score || 2.00);
            setScoreModalVisible(true);
          }}
        />
      ),
    },
  ];

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
      fetchAttendanceRecords();
      setCurrentStep(0);
    }
  }, [selectedCourse, selectedDate]);

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <Title level={3} style={{ marginBottom: 8, fontWeight: 600 }}>
            Take Attendance
          </Title>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            Fast biometric attendance system
          </Text>
        </div>
        
        <Space>
          <Tag color="blue" icon={<Shield size={12} />}>
            {faceModelsLoaded ? 'AI Ready' : 'AI Loading...'}
          </Tag>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {dayjs(selectedDate).format('DD MMM YYYY')}
          </Text>
        </Space>
      </div>

      {/* Main Content Card */}
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 12,
          border: '1px solid #f0f0f0',
        }}
        bodyStyle={{ padding: isMobile ? '20px' : '24px' }}
      >
        {/* Quick Stats Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Statistic
                title="Total Students"
                value={stats.totalStudents}
                valueStyle={{ fontSize: '32px', fontWeight: 600 }}
                prefix={<Users size={20} />}
              />
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Statistic
                title="Present Today"
                value={stats.presentToday}
                valueStyle={{ 
                  fontSize: '32px', 
                  fontWeight: 600,
                  color: stats.presentToday > 0 ? '#52c41a' : undefined 
                }}
                prefix={<CheckCircle size={20} />}
              />
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Statistic
                title="Attendance Rate"
                value={stats.attendanceRate.toFixed(1)}
                suffix="%"
                valueStyle={{ 
                  fontSize: '32px', 
                  fontWeight: 600,
                  color: stats.attendanceRate > 70 ? '#52c41a' : '#f5222d'
                }}
              />
            </div>
          </Col>
        </Row>

        {/* Control Section */}
        <div style={{ 
          backgroundColor: '#fafafa',
          borderRadius: 8,
          padding: '20px',
          marginBottom: 24
        }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={6}>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>
                Date
              </Text>
              <DatePicker
                style={{ width: '100%' }}
                value={dayjs(selectedDate)}
                onChange={(date) => setSelectedDate(date ? date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
                size="large"
                suffixIcon={<Calendar size={16} />}
              />
            </Col>
            
            <Col xs={24} md={10}>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>
                Course
              </Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Select course"
                value={selectedCourse}
                onChange={setSelectedCourse}
                loading={loading}
                size="large"
                showSearch
                allowClear
                options={courses.map(course => ({
                  value: course.id,
                  label: `${course.code} - ${course.title}`,
                }))}
              />
            </Col>
            
            <Col xs={24} md={8}>
              <div style={{ 
                display: 'flex', 
                gap: 8, 
                flexWrap: 'wrap',
                justifyContent: isMobile ? 'center' : 'flex-end'
              }}>
                <Tooltip title="Auto-capture faces">
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8,
                    backgroundColor: '#fff',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #d9d9d9'
                  }}>
                    <Text style={{ fontSize: '13px' }}>Auto-capture</Text>
                    <Switch 
                      size="small" 
                      checked={autoCapture} 
                      onChange={setAutoCapture}
                    />
                  </div>
                </Tooltip>
                
                <Button
                  type="primary"
                  icon={<Camera size={16} />}
                  onClick={startFaceAttendance}
                  loading={loading}
                  disabled={!selectedCourse}
                  size="large"
                >
                  Start Face Scan
                </Button>
              </div>
            </Col>
          </Row>
        </div>

        {/* Progress Steps */}
        {selectedCourse && (
          <div style={{ marginBottom: 24 }}>
            <Steps
              current={currentStep}
              size="small"
              labelPlacement="vertical"
              items={steps}
              style={{ maxWidth: 400, margin: '0 auto' }}
            />
          </div>
        )}

        {/* Face Camera Section */}
        {isCameraActive && (
          <Card
            style={{
              marginBottom: 24,
              border: '2px solid #1890ff',
              borderRadius: 12,
              backgroundColor: '#f6f9ff'
            }}
          >
            <FaceCamera
              mode="attendance"
              onAttendanceComplete={handleAttendanceComplete}
            />
            
            <Divider />
            
            <div style={{ textAlign: 'center' }}>
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
          </Card>
        )}

        {/* Result Display */}
        {faceResult?.success && (
          <Alert
            message={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <CheckCircle style={{ color: '#52c41a', marginRight: 8 }} />
                  <strong>Attendance Recorded</strong>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: 4 }}>
                    {faceResult.student?.name} • {faceResult.student?.matric_number}
                  </div>
                </div>
                <div>
                  <Tag color="success">
                    {(faceResult.confidence * 100).toFixed(1)}% match
                  </Tag>
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
                    {dayjs().format('HH:mm:ss')}
                  </Text>
                </div>
              </div>
            }
            type="success"
            showIcon={false}
            closable
            onClose={() => setFaceResult(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          gap: 16,
          marginBottom: 24,
          flexWrap: 'wrap'
        }}>
          <Button
            type="default"
            icon={<Users size={16} />}
            onClick={handleMarkAllPresent}
            loading={loading}
            disabled={!selectedCourse}
          >
            Mark All Present
          </Button>
          
          <Button
            type="dashed"
            icon={<RefreshCw size={16} />}
            onClick={() => fetchAttendanceRecords()}
            loading={loading}
          >
            Refresh
          </Button>
          
          <Button
            type="text"
            icon={<Download size={16} />}
            onClick={() => message.info('Export feature coming soon')}
          >
            Export
          </Button>
        </div>
      </Card>

      {/* Attendance Records */}
      {selectedCourse && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={16} />
              <span>Today's Attendance</span>
              <Badge 
                count={stats.presentToday} 
                style={{ marginLeft: 8, backgroundColor: '#52c41a' }} 
              />
            </div>
          }
          extra={
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {selectedCourseData?.code} • {selectedCourseData?.title}
            </Text>
          }
          style={{
            borderRadius: 12,
            border: '1px solid #f0f0f0',
          }}
        >
          <Table
            columns={columns}
            dataSource={attendanceRecords}
            loading={loading}
            pagination={{ 
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total) => `${total} records`
            }}
            scroll={{ x: true }}
            size="middle"
            locale={{
              emptyText: (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Users size={32} style={{ color: '#d9d9d9', marginBottom: 16 }} />
                  <Text type="secondary">No attendance recorded yet</Text>
                  <div style={{ marginTop: 16 }}>
                    <Button
                      type="primary"
                      size="small"
                      onClick={startFaceAttendance}
                    >
                      Start Recording
                    </Button>
                  </div>
                </div>
              )
            }}
          />
        </Card>
      )}

      {/* Score Adjustment Modal */}
      <Modal
        title="Adjust Attendance Score"
        open={scoreModalVisible}
        onCancel={() => setScoreModalVisible(false)}
        onOk={() => {
          // Save logic here
          setScoreModalVisible(false);
          message.success('Score updated');
        }}
        width={400}
        okText="Save Changes"
      >
        {selectedStudent && (
          <div>
            <div style={{ 
              backgroundColor: '#f6f9ff',
              padding: '16px',
              borderRadius: 8,
              marginBottom: 20
            }}>
              <Text strong>{selectedStudent.student_name}</Text>
              <div style={{ fontSize: '13px', color: '#666', marginTop: 4 }}>
                {selectedStudent.matric_number}
              </div>
            </div>
            
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Attendance Score (Max: 2.00)
              </Text>
              <InputNumber
                min={0}
                max={2.00}
                value={scoreInputValue}
                onChange={(value) => setScoreInputValue(value || 0)}
                style={{ width: '100%' }}
                precision={2}
                step={0.25}
              />
              
              <Progress 
                percent={(scoreInputValue / 2.00) * 100}
                strokeColor={
                  scoreInputValue >= 1.5 ? '#52c41a' :
                  scoreInputValue >= 1.0 ? '#faad14' : '#ff4d4f'
                }
                style={{ marginTop: 16 }}
                format={() => `${scoreInputValue.toFixed(2)} / 2.00`}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Footer Note */}
      {!selectedCourse && (
        <div style={{ textAlign: 'center', marginTop: 40, padding: '40px 0' }}>
          <div style={{
            width: 64,
            height: 64,
            backgroundColor: '#f0f9ff',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16
          }}>
            <Camera size={32} color="#1890ff" />
          </div>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 500 }}>
            Select a Course to Begin
          </Title>
          <Text type="secondary" style={{ maxWidth: 500, margin: '0 auto', display: 'block' }}>
            Choose a course and date to start recording attendance with AI-powered face recognition.
          </Text>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;