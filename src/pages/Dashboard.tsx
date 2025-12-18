// src/pages/Dashboard.tsx (With Debug)
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Alert, Button, Progress, Space, Tag } from 'antd';
import { 
  Users, 
  UserCheck, 
  Calendar, 
  Camera, 
  Database,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { supabase, LocalSyncService } from '../lib/supabase';
import { format } from 'date-fns';

const { Title, Text } = Typography;

interface DebugInfo {
  connectionTest: {
    success: boolean | null;
    error: any;
    timestamp: string;
  } | null;
  studentCountError: {
    message: string;
    code: string;
    details: any;
    hint: string;
    timestamp: string;
  } | null;
  enrolledError: {
    message: string;
    code: string;
    details: any;
    hint: string;
    timestamp: string;
  } | null;
  eventsError: {
    message: string;
    code: string;
    details: any;
    hint: string;
    timestamp: string;
  } | null;
  loadError: {
    message: string;
    timestamp: string;
  } | null;
  supabaseConfig: {
    url: string | undefined;
    keyLoaded: boolean;
    timestamp: string;
  } | null;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    enrolledStudents: 0,
    todayEvents: 0,
    pendingSync: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    connectionTest: null,
    studentCountError: null,
    enrolledError: null,
    eventsError: null,
    loadError: null,
    supabaseConfig: null
  });

  // Debug: Check Supabase configuration
  useEffect(() => {
    console.log('🔍 Dashboard Debug - Initializing');
    console.log('Supabase URL:', process.env.REACT_APP_SUPABASE_URL);
    console.log('Supabase Key exists:', !!process.env.REACT_APP_SUPABASE_ANON_KEY);
    console.log('Current supabase client:', supabase);
    
    setDebugInfo((prev: DebugInfo) => ({
      ...prev,
      supabaseConfig: {
        url: process.env.REACT_APP_SUPABASE_URL,
        keyLoaded: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
        timestamp: new Date().toISOString()
      }
    }));
  }, []);

  useEffect(() => {
    loadDashboardData();
    setLastSync(LocalSyncService.getLastSyncTime());
    testDatabaseConnection();
  }, []);

  // Test database connection
  const testDatabaseConnection = async () => {
    try {
      console.log('🧪 Testing database connection...');
      
      // Test 1: Simple query to test connection
      const { data, error } = await supabase
        .from('students')
        .select('id')
        .limit(1);

      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        connectionTest: {
          success: !error,
          error: error ? {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          } : null,
          timestamp: new Date().toISOString()
        }
      }));

      console.log('Connection test result:', { data, error });
      
      if (error) {
        console.error('❌ Database connection failed:', error);
      } else {
        console.log('✅ Database connection successful');
      }
    } catch (error) {
      console.error('❌ Connection test exception:', error);
      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        connectionTest: {
          success: false,
          error: String(error),
          timestamp: new Date().toISOString()
        }
      }));
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    console.log('📊 Loading dashboard data...');
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      console.log('Today:', today);
      
      // Get total students - WITH DEBUG
      console.log('1️⃣ Fetching total students...');
      const { count: totalStudents, error: studentsError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      console.log('Total students result:', { count: totalStudents, error: studentsError });
      
      if (studentsError) {
        console.error('❌ Students count error:', {
          message: studentsError.message,
          code: studentsError.code,
          details: studentsError.details,
          hint: studentsError.hint
        });
        
        setDebugInfo((prev: DebugInfo) => ({
          ...prev,
          studentCountError: {
            message: studentsError.message,
            code: studentsError.code,
            details: studentsError.details,
            hint: studentsError.hint,
            timestamp: new Date().toISOString()
          }
        }));
      }

      // Get enrolled students - WITH DEBUG
      console.log('2️⃣ Fetching enrolled students...');
      const { count: enrolledStudents, error: enrolledError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('enrollment_status', 'enrolled');

      console.log('Enrolled students result:', { count: enrolledStudents, error: enrolledError });
      
      if (enrolledError) {
        console.error('❌ Enrolled students error:', {
          message: enrolledError.message,
          code: enrolledError.code,
          details: enrolledError.details,
          hint: enrolledError.hint
        });
        
        setDebugInfo((prev: DebugInfo) => ({
          ...prev,
          enrolledError: {
            message: enrolledError.message,
            code: enrolledError.code,
            details: enrolledError.details,
            hint: enrolledError.hint,
            timestamp: new Date().toISOString()
          }
        }));
      }

      // Get today's events - WITH DEBUG
      console.log('3️⃣ Fetching today\'s events...');
      const { count: todayEvents, error: eventsError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .eq('is_active', true);

      console.log('Today events result:', { count: todayEvents, error: eventsError });
      
      if (eventsError) {
        console.error('❌ Events error:', {
          message: eventsError.message,
          code: eventsError.code,
          details: eventsError.details,
          hint: eventsError.hint
        });
        
        setDebugInfo((prev: DebugInfo) => ({
          ...prev,
          eventsError: {
            message: eventsError.message,
            code: eventsError.code,
            details: eventsError.details,
            hint: eventsError.hint,
            timestamp: new Date().toISOString()
          }
        }));
      }

      // Get pending sync items
      console.log('4️⃣ Getting pending sync count...');
      const pendingSync = await LocalSyncService.getPendingSyncCount();
      console.log('Pending sync:', pendingSync);

      setStats({
        totalStudents: totalStudents || 0,
        enrolledStudents: enrolledStudents || 0,
        todayEvents: todayEvents || 0,
        pendingSync,
      });

      console.log('✅ Dashboard data loaded:', {
        totalStudents: totalStudents || 0,
        enrolledStudents: enrolledStudents || 0,
        todayEvents: todayEvents || 0,
        pendingSync
      });

    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        loadError: {
          message: String(error),
          timestamp: new Date().toISOString()
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncStatus('syncing');
    try {
      const result = await LocalSyncService.syncPendingItems();
      if (result.success) {
        setSyncStatus('success');
        setLastSync(new Date());
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        setSyncStatus('error');
      }
      loadDashboardData();
    } catch (error) {
      setSyncStatus('error');
      console.error('Sync error:', error);
    }
  };

  const enrollmentPercentage = stats.totalStudents > 0 
    ? Math.round((stats.enrolledStudents / stats.totalStudents) * 100) 
    : 0;

  // Debug: Check RLS status
  const checkRLSStatus = async () => {
    try {
      console.log('🔐 Checking RLS status...');
      
      // Try to insert a test record (will fail if RLS blocks)
      const { error } = await supabase
        .from('students')
        .insert({ 
          student_id: `TEST_${Date.now()}`,
          name: 'Test Student',
          email: 'test@test.com'
        })
        .select();
      
      console.log('RLS test insert:', error ? 'BLOCKED' : 'ALLOWED', error);
      
    } catch (error) {
      console.error('RLS check error:', error);
    }
  };

  // Add this to your component for debugging
  useEffect(() => {
    checkRLSStatus();
  }, []);

  return (
    <div>
      <Title level={2}>Dashboard</Title>
      <Text type="secondary">Welcome to AFE Babalola University Face Authentication System</Text>

      {/* DEBUG PANEL - Add this section */}
      <Card style={{ marginTop: 16, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
        <Title level={4}>
          <Space>
            <AlertCircle size={20} />
            Debug Information
          </Space>
        </Title>
        
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Text strong>Connection Status: </Text>
            {debugInfo.connectionTest?.success ? (
              <Tag icon={<CheckCircle size={14} />} color="success">Connected</Tag>
            ) : debugInfo.connectionTest?.error ? (
              <Tag icon={<XCircle size={14} />} color="error">Failed</Tag>
            ) : (
              <Tag color="default">Testing...</Tag>
            )}
          </Col>
          
          {debugInfo.studentCountError && (
            <Col span={24}>
              <Alert
                message="Students Count Error"
                description={
                  <div>
                    <div><strong>Message:</strong> {debugInfo.studentCountError.message}</div>
                    <div><strong>Code:</strong> {debugInfo.studentCountError.code}</div>
                    {debugInfo.studentCountError.details && (
                      <div><strong>Details:</strong> {JSON.stringify(debugInfo.studentCountError.details)}</div>
                    )}
                    {debugInfo.studentCountError.hint && (
                      <div><strong>Hint:</strong> {debugInfo.studentCountError.hint}</div>
                    )}
                  </div>
                }
                type="error"
                showIcon
              />
            </Col>
          )}
          
          {debugInfo.enrolledError && (
            <Col span={24}>
              <Alert
                message="Enrolled Students Error"
                description={
                  <div>
                    <div><strong>Message:</strong> {debugInfo.enrolledError.message}</div>
                    <div><strong>Code:</strong> {debugInfo.enrolledError.code}</div>
                  </div>
                }
                type="error"
                showIcon
              />
            </Col>
          )}
          
          <Col span={24}>
            <Button 
              size="small" 
              onClick={() => {
                console.log('📋 Current debug info:', debugInfo);
                console.log('📊 Current stats:', stats);
                console.log('🔄 Reloading data...');
                loadDashboardData();
              }}
            >
              Refresh Debug Info
            </Button>
            <Button 
              size="small" 
              style={{ marginLeft: 8 }}
              onClick={() => {
                console.log('🧪 Testing connection again...');
                testDatabaseConnection();
                checkRLSStatus();
              }}
            >
              Test Connection
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Quick Actions */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Students"
              value={stats.totalStudents}
              prefix={<Users size={20} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Face Enrolled"
              value={stats.enrolledStudents}
              prefix={<UserCheck size={20} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Today's Events"
              value={stats.todayEvents}
              prefix={<Calendar size={20} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Pending Sync"
              value={stats.pendingSync}
              prefix={<Database size={20} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Enrollment Progress */}
      <Card style={{ marginTop: 24 }}>
        <Title level={4}>Face Enrollment Progress</Title>
        <Progress 
          percent={enrollmentPercentage}
          status="active"
          format={() => `${stats.enrolledStudents}/${stats.totalStudents} students enrolled`}
        />
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">
            {stats.totalStudents - stats.enrolledStudents} students remaining to enroll
          </Text>
        </div>
      </Card>

      {/* Sync Status */}
      <Card style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4}>Data Sync Status</Title>
            <Text type="secondary">
              Last sync: {lastSync ? format(lastSync, 'dd/MM/yyyy HH:mm:ss') : 'Never'}
            </Text>
          </div>
          <Space>
            {syncStatus === 'syncing' && <Text>Syncing...</Text>}
            {syncStatus === 'success' && <Text type="success">Sync successful!</Text>}
            {syncStatus === 'error' && <Text type="danger">Sync failed</Text>}
            <Button
              type="primary"
              icon={<RefreshCw />}
              onClick={handleSync}
              loading={syncStatus === 'syncing'}
              disabled={stats.pendingSync === 0}
            >
              Sync Now ({stats.pendingSync})
            </Button>
          </Space>
        </div>
        
        {stats.pendingSync > 0 && (
          <Alert
            style={{ marginTop: 16 }}
            message="Offline Data Pending"
            description={`You have ${stats.pendingSync} records waiting to be synced to the server. Click "Sync Now" to upload them.`}
            type="warning"
            showIcon
            icon={<AlertCircle />}
          />
        )}
      </Card>

      {/* Quick Links */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card 
            hoverable
            onClick={() => window.location.href = '/enroll'}
            style={{ textAlign: 'center' }}
          >
            <UserCheck size={48} style={{ marginBottom: 16 }} />
            <Title level={4}>Enroll Students</Title>
            <Text>Enroll new students with face recognition</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card 
            hoverable
            onClick={() => window.location.href = '/attendance'}
            style={{ textAlign: 'center' }}
          >
            <Camera size={48} style={{ marginBottom: 16 }} />
            <Title level={4}>Take Attendance</Title>
            <Text>Start face verification for attendance</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card 
            hoverable
            onClick={() => window.location.href = '/sync'}
            style={{ textAlign: 'center' }}
          >
            <Database size={48} style={{ marginBottom: 16 }} />
            <Title level={4}>Sync Data</Title>
            <Text>Manage offline data and sync status</Text>
          </Card>
        </Col>
      </Row>

      {/* System Status */}
      <Card style={{ marginTop: 24 }}>
        <Title level={4}>System Status</Title>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <div>
              <Text strong>Face Recognition Models: </Text>
              <Text type="success">Loaded</Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text strong>Camera Access: </Text>
              <Text type="success">Available</Text>
            </div>
          </Col>
          <Col span={12}>
            <div>
              <Text strong>Database Connection: </Text>
              {debugInfo.connectionTest?.success ? (
                <Text type="success">Connected</Text>
              ) : debugInfo.connectionTest?.error ? (
                <Text type="danger">Failed - Check Console</Text>
              ) : (
                <Text>Testing...</Text>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <Text strong>Last Heartbeat: </Text>
              <Text>{format(new Date(), 'HH:mm:ss')}</Text>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Dashboard;