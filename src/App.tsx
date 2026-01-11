// src/App.tsx - WITH BACK BUTTONS
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Spin, Alert, Typography, Space, ConfigProvider, theme, Card, Row, Col, Button } from 'antd';
import { 
  UserPlus,
  Camera,
  Book,
  Home,
  ArrowLeft
} from 'lucide-react';
import EnrollmentPage from './pages/EnrollmentPage';
import AttendancePage from './pages/AttendancePage';
import AttendanceManagementPage from './pages/AttendanceManagementPage';
import { supabase } from './lib/supabase';
import './App.css';

const { Title, Text } = Typography;

interface ConnectionStatus {
  status: 'testing' | 'connected' | 'error';
  message: string;
  details?: any;
}

// Wrapper component to add back button to pages
const PageWrapper = ({ children, showBackButton = true }: { children: React.ReactNode, showBackButton?: boolean }) => {
  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f0f2f5'
    }}>
      {/* Header with back button */}
      {showBackButton && (
        <div style={{ 
          padding: '12px 16px',
          backgroundColor: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <Button
            type="text"
            icon={<ArrowLeft size={18} />}
            onClick={() => window.location.href = '/'}
            style={{ 
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Text style={{ fontSize: 14 }}>Back</Text>
          </Button>
        </div>
      )}
      
      {/* Page content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
};

const HomeCards = () => {
  const cards = [
    {
      key: 'enroll',
      title: 'Staff Enrollment',
      description: 'Enroll new staff with face recognition',
      icon: <UserPlus size={32} />,
      path: '/enroll',
      color: '#1890ff',
    },
    {
      key: 'attendance',
      title: 'Take Attendance',
      description: 'Mark attendance using face recognition',
      icon: <Camera size={32} />,
      path: '/attendance',
      color: '#52c41a',
    },
    {
      key: 'attendance-management',
      title: 'Manage Attendance',
      description: 'View, search and filter all records',
      icon: <Book size={32} />,
      path: '/attendance-management',
      color: '#722ed1',
    },
  ];

  const navigate = (path: string) => {
    window.location.href = path;
  };

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: '#f0f2f5'
    }}>
      <div style={{ 
        textAlign: 'center', 
        marginBottom: 40 
      }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          Nigeram Face Attendance System
        </Title>
        <Text type="secondary">
          Select an option to begin
        </Text>
      </div>

      <Row gutter={[24, 24]} justify="center" style={{ maxWidth: 800 }}>
        {cards.map((card) => (
          <Col xs={24} sm={12} md={8} key={card.key}>
            <Card
              hoverable
              onClick={() => navigate(card.path)}
              style={{
                height: '100%',
                border: `1px solid ${card.color}20`,
                borderRadius: 12,
                transition: 'all 0.3s',
              }}
              bodyStyle={{
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                gap: 16 
              }}>
                <div style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: `${card.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {React.cloneElement(card.icon, { color: card.color })}
                </div>
                <Title level={4} style={{ margin: 0, color: card.color }}>
                  {card.title}
                </Title>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  {card.description}
                </Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ 
        marginTop: 40,
        textAlign: 'center' 
      }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Nigeram Staff • Face Authentication System
        </Text>
      </div>
    </div>
  );
};

function App() {
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'testing',
    message: 'Initializing...'
  });

  useEffect(() => {
  async function testConnection() {
    try {
      // Test connection by checking if we can query any table
      const { error } = await supabase
        .from('attendance_settings')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        console.error('Connection test failed:', error);
        setConnectionStatus({
          status: 'error',
          message: 'Database Connection Failed',
          details: error.message
        });
      } else {
        console.log('Database connected successfully!');
        setConnectionStatus({
          status: 'connected',
          message: 'Connected to Nigeram Database',
          details: null
        });
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setConnectionStatus({
        status: 'error',
        message: 'Network Error',
        details: error.message
      });
    } finally {
      setLoading(false);
    }
  }
  
  testConnection();
}, []);

  if (connectionStatus.status === 'error') {
    return (
      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          padding: 20,
          maxWidth: 500,
          margin: '0 auto'
        }}>
          <Alert
            message="Connection Error"
            description={
              <div>
                <p>Failed to connect to database.</p>
                <div style={{ marginTop: 20 }}>
                  <button 
                    onClick={() => window.location.reload()}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#1890ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            }
            type="error"
            showIcon
          />
        </div>
      </ConfigProvider>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
      }}>
        <Spin size="large" />
        <Text type="secondary" style={{ marginTop: 20 }}>
          {connectionStatus.message}
        </Text>
      </div>
    );
  }

  

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
        },
      }}
    >
      <Router>
        <div style={{ minHeight: '100vh' }}>
          <Routes>
            <Route path="/" element={<HomeCards />} />
            <Route path="/enroll" element={
              <PageWrapper>
                <EnrollmentPage />
              </PageWrapper>
            } />
            <Route path="/attendance" element={
              <PageWrapper>
                <AttendancePage />
              </PageWrapper>
            } />
            <Route path="/attendance-management" element={
              <PageWrapper>
                <AttendanceManagementPage />
              </PageWrapper>
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </ConfigProvider>
  );
}

export default App;