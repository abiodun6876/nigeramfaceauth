// src/pages/AttendancePage.tsx (FIXED)
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
  Select, // ADDED
  Avatar, // ADDED
  Tag, // ADDED
  Table, // ADDED
  Statistic // ADDED
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
  User
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase, recordAttendanceOffline } from '../lib/supabase';
import { Event, AttendanceRecord, Student } from '../types/database';
import { format } from 'date-fns';

const { Title, Text } = Typography;
const { Option } = Select; // For Select component if needed

const AttendancePage: React.FC = () => {
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

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventData(selectedEvent);
      fetchAttendanceRecords(selectedEvent);
    }
  }, [selectedEvent]);

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

  const handleVerificationComplete = async (result: any) => {
    setVerificationResult(result);
    
    if (result.match && result.student && selectedEvent) {
      // Record attendance
      await recordAttendance(result.student.id);
      
      // Refresh attendance records
      setTimeout(() => {
        fetchAttendanceRecords(selectedEvent);
      }, 1000);
    }
  };

  const recordAttendance = async (studentId: string) => {
    const now = new Date();
    const eventStart = eventData ? new Date(`${eventData.date}T${eventData.start_time}`) : now;
    
    // Determine if late (more than 15 minutes late)
    const isLate = (now.getTime() - eventStart.getTime()) > 15 * 60 * 1000;
    
    const attendanceData = {
      id: crypto.randomUUID(),
      event_id: selectedEvent,
      student_id: studentId,
      check_in_time: now.toISOString(),
      date: format(now, 'yyyy-MM-dd'),
      status: isLate ? 'late' : 'present',
      verified: true,
      device_id: 'web-camera',
      synced: false,
    };

    // Try online first, then offline
    try {
      const { error } = await supabase
        .from('attendance_records')
        .upsert(attendanceData);

      if (error) {
        // Fallback to offline storage
        await recordAttendanceOffline(attendanceData);
        console.log('Attendance recorded offline');
      } else {
        console.log('Attendance recorded online');
      }
    } catch (error) {
      // Fallback to offline storage
      await recordAttendanceOffline(attendanceData);
      console.log('Attendance recorded offline due to network error');
    }
  };

  const columns = [
    {
      title: 'Student ID',
      dataIndex: ['student', 'student_id'],
      key: 'student_id',
    },
    {
      title: 'Name',
      dataIndex: ['student', 'name'],
      key: 'name',
      render: (text: string, record: any) => (
        <Space>
          <Avatar size="small" icon={<User size={14} />} />
          {text}
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
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Verified',
      dataIndex: 'verified',
      key: 'verified',
      render: (verified: boolean) => (
        verified ? <CheckCircle color="#52c41a" /> : <span>-</span>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Face Authentication Attendance</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Event Selection */}
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

        {/* Event Details */}
        {eventData && (
          <Card>
            <Title level={4}>
              <Calendar size={20} style={{ marginRight: 8 }} />
              Event Details
            </Title>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Event Name:</Text>
                  <div>{eventData.name}</div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Course:</Text>
                  <div>
                    <BookOpen size={14} style={{ marginRight: 4 }} />
                    {eventData.course?.title || eventData.course_title || 'N/A'}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Time:</Text>
                  <div>
                    <Clock size={14} style={{ marginRight: 4 }} />
                    {eventData.start_time} - {eventData.end_time}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Location:</Text>
                  <div>
                    <MapPin size={14} style={{ marginRight: 4 }} />
                    {eventData.location || 'N/A'}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        )}

        {/* Attendance Statistics */}
        {selectedEvent && (
          <Card>
            <Title level={4}>
              <Users size={20} style={{ marginRight: 8 }} />
              Attendance Statistics
            </Title>
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
        {selectedEvent && (
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
                  {isTakingAttendance ? 'Stop Verification' : 'Start Verification'}
                </Button>
              </div>

              {isTakingAttendance ? (
                <>
                  <Alert
                    message="Verification Active"
                    description="Students should look directly at the camera to mark attendance. Make sure face is well-lit and clearly visible."
                    type="info"
                    showIcon
                  />
                  <FaceCamera
                    mode="verification"
                    eventId={selectedEvent}
                    onVerificationComplete={handleVerificationComplete}
                  />
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Camera size={64} style={{ opacity: 0.3, marginBottom: 20 }} />
                  <Text type="secondary">
                    Click "Start Verification" to begin taking attendance with face recognition
                  </Text>
                </div>
              )}

              {/* Verification Result */}
              {verificationResult && (
                <Alert
                  message={
                    verificationResult.match ? 
                    `✅ Verified: ${verificationResult.student?.name}` : 
                    '❌ No match found'
                  }
                  description={
                    verificationResult.match ? 
                    `Student ID: ${verificationResult.student?.student_id} | Confidence: ${Math.round(verificationResult.confidence * 100)}% | Status: ${verificationResult.student?.enrollment_status}` :
                    'Please ensure face is clearly visible and try again. Student may not be enrolled in the system.'
                  }
                  type={verificationResult.match ? 'success' : 'warning'}
                  showIcon
                />
              )}
            </Space>
          </Card>
        )}

        {/* Recent Attendance Records */}
        {selectedEvent && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={4}>
                <Users size={20} style={{ marginRight: 8 }} />
                Attendance Records
              </Title>
              <Button
                icon={<RefreshCw />}
                onClick={() => fetchAttendanceRecords(selectedEvent)}
                loading={loading}
              >
                Refresh
              </Button>
            </div>
            
            {attendanceRecords.length === 0 ? (
              <Alert
                message="No attendance records yet"
                description="Start face verification to record attendance"
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

        {/* Quick Actions */}
        {!selectedEvent && (
          <Card>
            <Title level={4}>Quick Actions</Title>
            <Row gutter={16}>
              <Col span={8}>
                <Card 
                  hoverable 
                  onClick={() => window.location.href = '/enroll'}
                  style={{ textAlign: 'center' }}
                >
                  <User size={32} style={{ marginBottom: 12 }} />
                  <Text strong>Enroll Students</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">Add new students to the system</Text>
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card 
                  hoverable 
                  onClick={() => window.location.href = '/events'}
                  style={{ textAlign: 'center' }}
                >
                  <Calendar size={32} style={{ marginBottom: 12 }} />
                  <Text strong>Create Event</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">Schedule new class or lecture</Text>
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card 
                  hoverable 
                  onClick={() => window.location.href = '/sync'}
                  style={{ textAlign: 'center' }}
                >
                  <RefreshCw size={32} style={{ marginBottom: 12 }} />
                  <Text strong>Sync Data</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">Sync offline attendance records</Text>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        )}
      </Space>
    </div>
  );
};

export default AttendancePage;