// src/pages/AttendancePage.tsx (FIXED VERSION)
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Typography, 
  Space,
  Alert,
  message,
  Row,
  Col,
  Select,
  Avatar,
  Tag,
  Table,
  Statistic,
  Input,
  Spin,
  Modal,
  Descriptions
} from 'antd';
import { 
  Camera, 
  Users, 
  CheckCircle, 
  Clock, 
  Calendar,
  RefreshCw,
  MapPin,
  BookOpen,
  User,
  XCircle,
  Building,
  GraduationCap,
  Download
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import { Event, AttendanceRecord, Student } from '../types/database';
import { format } from 'date-fns';

const { Title, Text } = Typography;
const { Option } = Select;

const AttendancePage: React.FC = () => {
  // Event selection state
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [eventData, setEventData] = useState<Event | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isTakingAttendance, setIsTakingAttendance] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
  });

  // Session setup state (NEW)
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<number>(0);
  const [courseCode, setCourseCode] = useState<string>('');
  const [faculties, setFaculties] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [showSessionSetup, setShowSessionSetup] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState<'event' | 'session'>('event');

  useEffect(() => {
    fetchEvents();
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventData(selectedEvent);
      fetchAttendanceRecords(selectedEvent);
    }
  }, [selectedEvent]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // Fetch faculties
      const { data: facultiesData } = await supabase
        .from('faculties')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      
      if (facultiesData) setFaculties(facultiesData);

      // Fetch levels
      const { data: levelsData } = await supabase
        .from('levels')
        .select('id, name, level_order')
        .eq('is_active', true)
        .order('level_order');
      
      if (levelsData) setLevels(levelsData);

    } catch (error) {
      console.error('Error fetching initial data:', error);
      message.error('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async (facultyId: string) => {
    try {
      const { data } = await supabase
        .from('departments')
        .select('id, name, code')
        .eq('faculty_id', facultyId)
        .eq('is_active', true)
        .order('name');
      
      if (data) setDepartments(data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchEvents = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('date', today)
        .eq('is_active', true)
        .order('start_time');

      if (!error && data) {
        setEvents(data);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchEventData = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          course:course_id (*),
          department:department_id (*),
          faculty:faculty_id (*),
          lecturer:lecturer_id (*)
        `)
        .eq('id', eventId)
        .single();

      if (!error && data) {
        setEventData(data);
      }
    } catch (error) {
      console.error('Error fetching event data:', error);
    }
  };

  const fetchAttendanceRecords = async (eventId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          student:student_id (*)
        `)
        .eq('event_id', eventId)
        .order('check_in_time', { ascending: false });

      if (!error && data) {
        setAttendanceRecords(data);
        
        // Calculate stats
        const total = data.length;
        const present = data.filter(r => r.status === 'present').length;
        const absent = data.filter(r => r.status === 'absent').length;
        const late = data.filter(r => r.status === 'late').length;
        
        setStats({ total, present, absent, late });
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    } finally {
      setLoading(false);
    }
  };

  const startAttendanceSession = async () => {
    if (!selectedFaculty || !selectedDepartment || !selectedLevel || !courseCode) {
      message.error('Please select all required fields');
      return;
    }

    try {
      setLoading(true);
      
      // Create attendance session
      const sessionData = {
        course_code: courseCode,
        faculty_id: selectedFaculty,
        department_id: selectedDepartment,
        level: selectedLevel,
        session_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: format(new Date(), 'HH:mm:ss'),
        total_students: 0,
        attended_students: 0,
        is_active: true
      };

      

      const { data: session, error } = await supabase
        .from('attendance_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (error) throw error;

      setEventData(session as any);
      setAttendanceMode('session');
      setShowSessionSetup(false);
      setIsTakingAttendance(true);
      message.success('Attendance session started!');

    } catch (error: any) {
      console.error('Error starting session:', error);
      message.error(`Failed to start session: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFaceScanComplete = async (result: any) => {
    setVerificationResult(result);
    
    if (result.success && result.match && result.student) {
    // Pass 'result' as second parameter
    await recordAttendance(result.student, result); // ✅ Pass result here
      
      
      // Refresh attendance records
      if (selectedEvent) {
        setTimeout(() => {
          fetchAttendanceRecords(selectedEvent);
        }, 1000);
      }
    }
  };

  const recordAttendance = async (student: any, result: any) => {
    const now = new Date();
    const eventStart = eventData ? new Date(`${eventData.date}T${eventData.start_time}`) : now;
    
    // Determine if late (more than 15 minutes late)
    const isLate = (now.getTime() - eventStart.getTime()) > 15 * 60 * 1000;
    
    const attendanceData = {
      id: crypto.randomUUID(),
      event_id: attendanceMode === 'event' ? selectedEvent : 'session_' + Date.now(),
      session_id: attendanceMode === 'session' ? eventData?.id : null,
      student_id: student.id,
      student_name: student.name,
      matric_number: student.matric_number || student.student_id,
      faculty_code: student.faculty_code,
      department_code: student.department_code,
      program: student.program,
      level: student.level,
      check_in_time: now.toISOString(),
      date: format(now, 'yyyy-MM-dd'),
      status: isLate ? 'late' : 'present',
      verified: true,
      face_match_score: result.matchScore || (result.confidence * 100),
      device_id: 'web-camera',
      synced: false,
    };

    // Try online first
    try {
      const { error } = await supabase
        .from('attendance_records')
        .upsert(attendanceData);

      if (error) {
        console.error('Online attendance error:', error);
        message.warning('Attendance saved offline');
      } else {
        message.success('Attendance recorded successfully!');
        console.log('Attendance recorded online');
      }
    } catch (error) {
      console.error('Network error:', error);
      message.warning('Attendance saved offline due to network error');
    }
  };

  const exportAttendance = () => {
    if (attendanceRecords.length === 0) {
      message.warning('No attendance records to export');
      return;
    }

    const csvContent = [
      ['Matric Number', 'Name', 'Faculty', 'Department', 'Program', 'Level', 'Check-in Time', 'Status', 'Match Score'],
      ...attendanceRecords.map(record => [
        record.matric_number || record.student?.matric_number || 'N/A',
        record.student_name || record.student?.name || 'N/A',
        record.faculty_code || record.student?.faculty_code || 'N/A',
        record.department_code || record.student?.department_code || 'N/A',
        record.program || record.student?.program || 'N/A',
        record.level || record.student?.level || 'N/A',
        record.check_in_time ? format(new Date(record.check_in_time), 'HH:mm:ss') : 'N/A',
        record.status || 'N/A',
        `${record.face_match_score || 0}%`
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('Attendance exported successfully');
  };

  const columns = [
    {
      title: 'Matric Number',
      dataIndex: ['student', 'matric_number'],
      key: 'matric_number',
      render: (text: string, record: any) => text || record.matric_number || 'N/A',
    },
    {
      title: 'Name',
      dataIndex: ['student', 'name'],
      key: 'name',
      render: (text: string, record: any) => (
        <Space>
          <Avatar size="small" icon={<User size={14} />} />
          {text || record.student_name || 'N/A'}
        </Space>
      ),
    },
    {
      title: 'Check-in Time',
      dataIndex: 'check_in_time',
      key: 'time',
      render: (time: string) => time ? format(new Date(time), 'HH:mm:ss') : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'present' ? 'green' : 
                     status === 'late' ? 'orange' : 'red';
        return <Tag color={color}>{status?.toUpperCase() || 'N/A'}</Tag>;
      },
    },
    {
      title: 'Match Score',
      dataIndex: 'face_match_score',
      key: 'face_match_score',
      render: (score: number) => score ? `${score}%` : '-',
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Face Authentication Attendance</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Mode Selection */}
        <Card>
          <Title level={4}>Select Attendance Mode</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Card 
                hoverable 
                onClick={() => setAttendanceMode('event')}
                style={{ 
                  textAlign: 'center',
                  border: attendanceMode === 'event' ? '2px solid #1890ff' : '1px solid #d9d9d9'
                }}
              >
                <Calendar size={32} style={{ marginBottom: 12 }} />
                <Text strong>Event-based</Text>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">Select from scheduled events</Text>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card 
                hoverable 
                onClick={() => {
                  setAttendanceMode('session');
                  setShowSessionSetup(true);
                }}
                style={{ 
                  textAlign: 'center',
                  border: attendanceMode === 'session' ? '2px solid #1890ff' : '1px solid #d9d9d9'
                }}
              >
                <Camera size={32} style={{ marginBottom: 12 }} />
                <Text strong>Quick Session</Text>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">Start a new attendance session</Text>
                </div>
              </Card>
            </Col>
          </Row>
        </Card>

        {/* Event Selection (only for event mode) */}
        {attendanceMode === 'event' && (
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Title level={4}>
                <Calendar size={20} style={{ marginRight: 8 }} />
                Select Event
              </Title>
              <Select
                placeholder="Select event for attendance"
                style={{ width: '100%' }}
                value={selectedEvent}
                onChange={setSelectedEvent}
                options={events.map(event => ({
                  label: `${event.name} - ${event.start_time} (${event.course_code || 'No Course'})`,
                  value: event.id,
                }))}
              />
            </Space>
          </Card>
        )}

        {/* Session Setup Modal */}
        <Modal
          title="Start Attendance Session"
          open={showSessionSetup}
          onCancel={() => setShowSessionSetup(false)}
          onOk={startAttendanceSession}
          okText="Start Session"
          okButtonProps={{ 
            loading: loading,
            disabled: !selectedFaculty || !selectedDepartment || !selectedLevel || !courseCode
          }}
          width={600}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Faculty *</Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder="Select faculty"
                    onChange={(value) => {
                      setSelectedFaculty(value);
                      fetchDepartments(value);
                      setSelectedDepartment('');
                    }}
                    loading={loading}
                  >
                    {faculties.map(faculty => (
                      <Option key={faculty.id} value={faculty.id}>
                        {faculty.name} ({faculty.code})
                      </Option>
                    ))}
                  </Select>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Department *</Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder="Select department"
                    value={selectedDepartment}
                    onChange={setSelectedDepartment}
                    disabled={!selectedFaculty}
                    loading={loading}
                  >
                    {departments.map(dept => (
                      <Option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </Option>
                    ))}
                  </Select>
                </div>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Level *</Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder="Select level"
                    onChange={(value) => setSelectedLevel(value)}
                    loading={loading}
                  >
                    {levels.map(level => (
                      <Option key={level.id} value={level.level_order}>
                        Level {level.level_order} - {level.name}
                      </Option>
                    ))}
                  </Select>
                </div>
              </Col>
              
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Course Code *</Text>
                  <Input
                    placeholder="e.g., CSC101"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                    style={{ marginTop: 8 }}
                  />
                </div>
              </Col>
            </Row>
          </Space>
        </Modal>

        {/* Event/Session Details */}
        {(eventData || attendanceMode === 'session') && (
          <Card>
            <Title level={4}>
              <Calendar size={20} style={{ marginRight: 8 }} />
              {attendanceMode === 'event' ? 'Event Details' : 'Session Details'}
            </Title>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>{attendanceMode === 'event' ? 'Event Name' : 'Course Code'}:</Text>
                  <div>
                    {attendanceMode === 'event' 
                      ? eventData?.name 
                      : courseCode}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Time:</Text>
                  <div>
                    <Clock size={14} style={{ marginRight: 4 }} />
                    {eventData?.start_time || format(new Date(), 'HH:mm:ss')}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Date:</Text>
                  <div>
                    <Calendar size={14} style={{ marginRight: 4 }} />
                    {eventData?.date || format(new Date(), 'yyyy-MM-dd')}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        )}

        {/* Attendance Statistics */}
        {(selectedEvent || attendanceMode === 'session') && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={4}>
                <Users size={20} style={{ marginRight: 8 }} />
                Attendance Statistics
              </Title>
              <Button
                icon={<Download />}
                onClick={exportAttendance}
                disabled={attendanceRecords.length === 0}
              >
                Export CSV
              </Button>
            </div>
            <Row gutter={16}>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Total Students"
                  value={stats.total}
                  prefix={<Users size={20} />}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Present"
                  value={stats.present}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircle size={20} />}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Late"
                  value={stats.late}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Absent"
                  value={stats.absent}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
            </Row>
          </Card>
        )}

        {/* Face Verification Section */}
        {(selectedEvent || attendanceMode === 'session') && (
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={4}>
                  <Camera size={20} style={{ marginRight: 8 }} />
                  Face Verification
                </Title>
                <Button
                  type={isTakingAttendance ? 'default' : 'primary'}
                  onClick={() => setIsTakingAttendance(!isTakingAttendance)}
                  icon={<Camera />}
                >
                  {isTakingAttendance ? 'Stop Scanning' : 'Start Scanning'}
                </Button>
              </div>

              {isTakingAttendance ? (
                <>
                  <Alert
                    message="Scanning Active"
                    description="Students should look directly at the camera to mark attendance. Make sure face is well-lit and clearly visible."
                    type="info"
                    showIcon
                  />
                  <FaceCamera
                    mode="attendance"
                    sessionInfo={{
                      facultyId: selectedFaculty,
                      departmentId: selectedDepartment,
                      level: selectedLevel,
                      courseCode: courseCode
                    }}
                    onAttendanceComplete={handleFaceScanComplete}
                  />
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Camera size={64} style={{ opacity: 0.3, marginBottom: 20 }} />
                  <Text type="secondary">
                    Click "Start Scanning" to begin taking attendance with face recognition
                  </Text>
                </div>
              )}

              {/* Verification Result */}
              {verificationResult && (
                <Alert
                  message={
                    verificationResult.success && verificationResult.match ? 
                    `✅ Verified: ${verificationResult.student?.name}` : 
                    '❌ No match found'
                  }
                  description={
                    verificationResult.success && verificationResult.match ? 
                    `Matric: ${verificationResult.student?.matric_number} | Match: ${verificationResult.matchScore || 0}% | Time: ${new Date(verificationResult.timestamp).toLocaleTimeString()}` :
                    'Please ensure face is clearly visible and try again. Student may not be enrolled in the system.'
                  }
                  type={verificationResult.success && verificationResult.match ? 'success' : 'warning'}
                  showIcon
                />
              )}
            </Space>
          </Card>
        )}

        {/* Recent Attendance Records */}
        {(selectedEvent || attendanceMode === 'session') && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={4}>
                <Users size={20} style={{ marginRight: 8 }} />
                Attendance Records
              </Title>
              <Button
                icon={<RefreshCw />}
                onClick={() => selectedEvent && fetchAttendanceRecords(selectedEvent)}
                loading={loading}
              >
                Refresh
              </Button>
            </div>
            
            {attendanceRecords.length === 0 ? (
              <Alert
                message="No attendance records yet"
                description="Start face scanning to record attendance"
                type="info"
                showIcon
              />
            ) : (
              <Table
                columns={columns}
                dataSource={attendanceRecords}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                loading={loading}
              />
            )}
          </Card>
        )}
      </Space>
    </div>
  );
};

export default AttendancePage;