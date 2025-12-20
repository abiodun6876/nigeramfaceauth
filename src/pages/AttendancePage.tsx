// src/pages/AttendancePage.tsx
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
  message
} from 'antd';
import { Camera } from 'lucide-react';
import { UserAddOutlined, TeamOutlined } from '@ant-design/icons';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;
const { Option } = Select;

const AttendancePage: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceSession, setAttendanceSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [scoreInputValue, setScoreInputValue] = useState<number>(0);

  // Fetch courses - FIXED to match your database schema
  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('id, code, title, level, semester')
      .order('code');
    
    if (error) {
      console.error('Error fetching courses:', error);
      message.error('Failed to load courses');
    } else {
      setCourses(data || []);
    }
  };

  // Fetch students for selected course - FIXED with proper attendance data
  const fetchStudents = async (courseId: string) => {
    if (!courseId) return;
    
    setLoading(true);
    
    try {
      // Get course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('code, title, level, semester')
        .eq('id', courseId)
        .single();
      
      if (courseError) throw courseError;
      
      if (courseData) {
        // Fetch students at the same level
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('level', courseData.level)
          .eq('enrollment_status', 'enrolled');
        
        if (studentsError) throw studentsError;
        
        if (studentsData) {
          // Get today's date
          const today = new Date().toISOString().split('T')[0];
          
          // For each student, fetch their attendance for today
          const studentsWithAttendance = await Promise.all(
            studentsData.map(async (student) => {
              // Fetch attendance records for this student today for this course
              const { data: attendanceRecords } = await supabase
                .from('student_attendance')
                .select('*')
                .eq('student_id', student.student_id)
                .eq('course_code', courseData.code)
                .gte('check_in_time', `${today}T00:00:00`)
                .lte('check_in_time', `${today}T23:59:59`)
                .order('check_in_time', { ascending: false });
              
              return {
                ...student,
                attendance_record: attendanceRecords || [],
                key: student.student_id
              };
            })
          );
          
          setStudents(studentsWithAttendance);
          
          // Check if attendance_sessions table exists and create/get session
          const { data: tableExists } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_name', 'attendance_sessions')
            .single();
          
          if (tableExists) {
            const weekNumber = Math.ceil(new Date().getDate() / 7);
            
            const { data: sessionData } = await supabase
              .from('attendance_sessions')
              .select('*')
              .eq('course_id', courseId)
              .eq('session_date', today)
              .single();
            
            if (sessionData) {
              setAttendanceSession(sessionData);
            } else {
              // Create new session
              const { data: newSession } = await supabase
                .from('attendance_sessions')
                .insert([{
                  course_id: courseId,
                  session_date: today,
                  week_number: weekNumber,
                  max_score: 2.00
                }])
                .select()
                .single();
              
              if (newSession) {
                setAttendanceSession(newSession);
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching students:', error);
      message.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourse(courseId);
    fetchStudents(courseId);
  };

  const handleAttendanceComplete = async (result: any) => {
    console.log('Attendance result:', result);
    
    if (result.success && result.student) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const studentId = result.student.student_id;
        
        if (!studentId) {
          message.error('Student ID not found');
          return;
        }
        
        // Get selected course details
        const selectedCourseData = courses.find(c => c.id === selectedCourse);
        if (!selectedCourseData) {
          message.error('Course not found');
          return;
        }
        
        // Check if attendance already exists for today
        const { data: existingAttendance } = await supabase
          .from('student_attendance')
          .select('id, score')
          .eq('student_id', studentId)
          .eq('course_code', selectedCourseData.code)
          .gte('check_in_time', `${today}T00:00:00`)
          .lte('check_in_time', `${today}T23:59:59`)
          .single();
        
        if (existingAttendance) {
          // Update existing attendance
          const { error } = await supabase
            .from('student_attendance')
            .update({
              check_in_time: new Date().toISOString(),
              verification_method: 'face_recognition',
              confidence_score: result.confidence || 0.95,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingAttendance.id);
          
          if (error) throw error;
        } else {
          // Create new attendance record
          const attendanceData = {
            student_id: studentId,
            student_name: result.student.name,
            matric_number: result.student.matric_number,
            course_code: selectedCourseData.code,
            course_title: selectedCourseData.title,
            level: selectedCourseData.level,
            attendance_date: today,
            check_in_time: new Date().toISOString(),
            status: 'present',
            verification_method: 'face_recognition',
            confidence_score: result.confidence || 0.95,
            score: 2.00, // Default full score for face recognition
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { error } = await supabase
            .from('student_attendance')
            .insert([attendanceData]);
          
          if (error) throw error;
        }
        
        message.success(`Attendance recorded for ${result.student.name}`);
        fetchStudents(selectedCourse);
        
      } catch (error: any) {
        console.error('Attendance error:', error);
        message.error('Failed to save attendance: ' + error.message);
      }
    } else {
      message.error(`Face recognition failed: ${result.message || 'Unknown error'}`);
    }
  };

  const handleManualAttendance = (student: any) => {
    setSelectedStudent(student);
    setManualModalVisible(true);
  };

  const confirmManualAttendance = async () => {
    if (!selectedStudent || !selectedCourse) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const selectedCourseData = courses.find(c => c.id === selectedCourse);
      
      if (!selectedCourseData) {
        message.error('Course not found');
        return;
      }
      
      // Check if attendance already exists for today
      const { data: existingAttendance } = await supabase
        .from('student_attendance')
        .select('id, score')
        .eq('student_id', selectedStudent.student_id)
        .eq('course_code', selectedCourseData.code)
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)
        .single();
      
      if (existingAttendance) {
        // Update existing attendance
        const { error } = await supabase
          .from('student_attendance')
          .update({
            check_in_time: new Date().toISOString(),
            verification_method: 'manual',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAttendance.id);
        
        if (error) throw error;
      } else {
        // Create new attendance record
        const attendanceData = {
          student_id: selectedStudent.student_id,
          student_name: selectedStudent.name,
          matric_number: selectedStudent.matric_number,
          course_code: selectedCourseData.code,
          course_title: selectedCourseData.title,
          level: selectedCourseData.level,
          attendance_date: today,
          check_in_time: new Date().toISOString(),
          status: 'present',
          verification_method: 'manual',
          score: 2.00, // Default full score for manual entry
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('student_attendance')
          .insert([attendanceData]);
        
        if (error) throw error;
      }
      
      message.success(`Manual attendance recorded for ${selectedStudent.name}`);
      fetchStudents(selectedCourse);
      
    } catch (error: any) {
      console.error('Manual attendance error:', error);
      message.error('Failed to record manual attendance: ' + error.message);
    }
    
    setManualModalVisible(false);
    setSelectedStudent(null);
  };

  const updateStudentScore = (student: any) => {
    setSelectedStudent(student);
    const currentScore = student.attendance_record?.[0]?.score || 2.00;
    setScoreInputValue(currentScore);
    setScoreModalVisible(true);
  };

  const saveStudentScore = async () => {
    if (!selectedStudent || !selectedCourse) {
      message.error('No student or course selected');
      return;
    }
    
    const score = scoreInputValue;
    const maxScore = attendanceSession?.max_score || 2.00;
    
    if (score < 0 || score > maxScore) {
      message.error(`Invalid score. Must be between 0 and ${maxScore}`);
      return;
    }
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const selectedCourseData = courses.find(c => c.id === selectedCourse);
      
      if (!selectedCourseData) {
        message.error('Course not found');
        return;
      }
      
      // Check if attendance record exists for today
      const { data: existingAttendance } = await supabase
        .from('student_attendance')
        .select('id')
        .eq('student_id', selectedStudent.student_id)
        .eq('course_code', selectedCourseData.code)
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)
        .single();
      
      if (existingAttendance) {
        // Update existing record score
        const { error } = await supabase
          .from('student_attendance')
          .update({ 
            score: score,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAttendance.id);
        
        if (error) throw error;
      } else {
        // Create new record with score
        const attendanceData = {
          student_id: selectedStudent.student_id,
          student_name: selectedStudent.name,
          matric_number: selectedStudent.matric_number,
          course_code: selectedCourseData.code,
          course_title: selectedCourseData.title,
          level: selectedCourseData.level,
          attendance_date: today,
          check_in_time: new Date().toISOString(),
          status: 'present',
          verification_method: 'manual_score',
          score: score,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('student_attendance')
          .insert([attendanceData]);
        
        if (error) throw error;
      }
      
      message.success(`Score updated to ${score} for ${selectedStudent.name}`);
      fetchStudents(selectedCourse);
      
    } catch (error: any) {
      console.error('Score update error:', error);
      message.error('Failed to update score: ' + error.message);
    } finally {
      setScoreModalVisible(false);
      setSelectedStudent(null);
      setScoreInputValue(0);
    }
  };

  const handleMarkAllPresent = async () => {
    if (!selectedCourse || students.length === 0) return;
    
    Modal.confirm({
      title: 'Mark All Present',
      content: `Are you sure you want to mark all ${students.length} students as present?`,
      onOk: async () => {
        setLoading(true);
        try {
          const today = new Date().toISOString().split('T')[0];
          const selectedCourseData = courses.find(c => c.id === selectedCourse);
          
          if (!selectedCourseData) {
            message.error('Course not found');
            return;
          }
          
          // Get students who are not already marked present
          const absentStudents = students.filter(student => 
            !student.attendance_record || student.attendance_record.length === 0
          );
          
          // Create attendance records for all absent students
          const attendanceRecords = absentStudents.map(student => ({
            student_id: student.student_id,
            student_name: student.name,
            matric_number: student.matric_number,
            course_code: selectedCourseData.code,
            course_title: selectedCourseData.title,
            level: selectedCourseData.level,
            attendance_date: today,
            check_in_time: new Date().toISOString(),
            status: 'present',
            verification_method: 'batch',
            score: 2.00,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));
          
          if (attendanceRecords.length > 0) {
            const { error } = await supabase
              .from('student_attendance')
              .insert(attendanceRecords);
            
            if (error) throw error;
          }
          
          message.success(`Marked ${attendanceRecords.length} students as present`);
          fetchStudents(selectedCourse);
        } catch (error: any) {
          console.error('Mark all error:', error);
          message.error('Failed to mark all students: ' + error.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const columns = [
    {
      title: 'Student ID',
      dataIndex: 'student_id',
      key: 'student_id',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Matric Number',
      dataIndex: 'matric_number',
      key: 'matric_number',
    },
    {
      title: 'Score',
      key: 'score',
      render: (_: any, record: any) => {
        const hasAttendance = record.attendance_record?.length > 0;
        const score = hasAttendance ? (record.attendance_record[0].score || 0) : 0;
        const maxScore = 2.00;
        
        return (
          <div>
            <span style={{ fontWeight: 'bold' }}>{score.toFixed(2)} / {maxScore}</span>
            <div style={{ width: 100, height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, marginTop: 4 }}>
              <div 
                style={{ 
                  width: `${(score / maxScore) * 100}%`, 
                  height: '100%', 
                  backgroundColor: score >= maxScore * 0.5 ? '#52c41a' : '#f5222d',
                  borderRadius: 4
                }} 
              />
            </div>
          </div>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => {
        const hasAttendance = record.attendance_record?.length > 0;
        return hasAttendance ? (
          <Tag color="green">Present</Tag>
        ) : (
          <Tag color="red">Absent</Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        const hasAttendance = record.attendance_record?.length > 0;
        return (
          <Space>
            <Button
              size="small"
              onClick={() => handleManualAttendance(record)}
              disabled={hasAttendance}
            >
              Mark Present
            </Button>
            {hasAttendance && (
              <Button
                size="small"
                type="link"
                onClick={() => updateStudentScore(record)}
              >
                Adjust Score
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Take Attendance</Title>
      
      <Card style={{ marginBottom: 20 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col span={8}>
            <Text strong>Select Course:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Choose a course"
              value={selectedCourse}
              onChange={handleCourseSelect}
              loading={loading}
            >
              {courses.map(course => (
                <Option key={course.id} value={course.id}>
                  {course.code} - {course.title} (Level {course.level})
                </Option>
              ))}
            </Select>
          </Col>
          
          <Col span={8}>
            <Statistic
              title="Total Students"
              value={students.length}
              prefix={<TeamOutlined />}
            />
          </Col>
          
          <Col span={8}>
            <Statistic
              title="Present Today"
              value={students.filter(s => s.attendance_record?.length > 0).length}
              prefix={<UserAddOutlined />}
              suffix={`/ ${students.length}`}
            />
          </Col>
        </Row>
      </Card>

      {selectedCourse && (
        <>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<Camera />}
                onClick={() => setIsCameraActive(true)}
                style={{ marginBottom: 10 }}
                loading={loading}
              >
                Start Face Attendance
              </Button>
              <div>
                <Text type="secondary">or</Text>
              </div>
              <Button
                type="default"
                size="large"
                onClick={handleMarkAllPresent}
                style={{ marginTop: 10 }}
                loading={loading}
              >
                Mark All Present
              </Button>
            </div>
          </Card>

          <Card title={`Student List - ${courses.find(c => c.id === selectedCourse)?.title || 'Selected Course'}`}>
            <Table
              columns={columns}
              dataSource={students}
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>

          {isCameraActive && (
            <div style={{ marginTop: 20 }}>
              <FaceCamera
                mode="attendance"
                onAttendanceComplete={handleAttendanceComplete}
              />
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <Button onClick={() => setIsCameraActive(false)}>
                  Stop Camera
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Manual Attendance Modal */}
      <Modal
        title="Manual Attendance"
        open={manualModalVisible}
        onCancel={() => setManualModalVisible(false)}
        onOk={confirmManualAttendance}
        confirmLoading={loading}
      >
        {selectedStudent && (
          <div>
            <p>Mark <strong>{selectedStudent.name}</strong> as present?</p>
            <p>Student ID: {selectedStudent.student_id}</p>
            <p>Matric: {selectedStudent.matric_number}</p>
            <p>Score: 2.00 points (default)</p>
          </div>
        )}
      </Modal>

      {/* Score Adjustment Modal */}
      <Modal
        title="Adjust Score"
        open={scoreModalVisible}
        onCancel={() => setScoreModalVisible(false)}
        onOk={saveStudentScore}
        confirmLoading={loading}
      >
        {selectedStudent && (
          <div>
            <p>Student: <strong>{selectedStudent.name}</strong></p>
            <p>Matric: {selectedStudent.matric_number}</p>
            <p>Max possible score: 2.00</p>
            <InputNumber
              min={0}
              max={2.00}
              value={scoreInputValue}
              onChange={(value) => setScoreInputValue(value || 0)}
              style={{ width: '100%', marginTop: 10 }}
              step={0.25}
              precision={2}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AttendancePage;