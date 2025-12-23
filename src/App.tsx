// src/App.tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Spin, Alert, Typography, Space, ConfigProvider, theme, Card, Row, Col, Grid } from 'antd';
import { 
  User, 
  Camera, 
  Users, 
  Calendar, 
  Settings, 
  LogIn, 
  LogOut,
  Home,
  Database,
  Shield,
  CheckCircle,
  XCircle,
  ArrowLeft,
  BarChart,
  Upload,
  Download,
  UserPlus,
  QrCode,
  Book
} from 'lucide-react';
import EnrollmentPage from './pages/EnrollmentPage';
import AttendancePage from './pages/AttendancePage';
import Dashboard from './pages/Dashboard';
import ImageManagementPage from './pages/ImageManagementPage';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { supabase } from './lib/supabase';
import './App.css';

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

// Interface for connection status
interface ConnectionStatus {
  status: 'testing' | 'connected' | 'error';
  message: string;
  details?: any;
}

// Menu items configuration
const menuItems = [
  {
    key: '1',
    icon: React.createElement(Home, { size: 16 }),
    label: <Link to="/">Dashboard</Link>,
  },
  {
    key: '2',
    icon: React.createElement(User, { size: 16 }),
    label: <Link to="/enroll">Student Enrollment</Link>,
  },
  {
    key: '3',
    icon: React.createElement(Camera, { size: 16 }),
    label: <Link to="/attendance">Take Attendance</Link>,
  },

  {
    key: '6',
    icon: React.createElement(Database, { size: 16 }),
    label: <Link to="/sync">Sync Data</Link>,
  },


];

// Home page cards component
const HomeCards = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  
    const cards = [
    {
      key: 'enroll',
      title: 'Student Enrollment',
      description: 'Enroll new students with face recognition',
      icon: <UserPlus size={isMobile ? 24 : 32} />,
      path: '/enroll',
      color: '#1890ff',
    },
    {
      key: 'attendance',
      title: 'Take Attendance',
      description: 'Mark attendance using face recognition',
      icon: <Camera size={isMobile ? 24 : 32} />,
      path: '/attendance',
      color: '#52c41a',
    },
  ];

  return (
    <div style={{ padding: isMobile ? '10px' : '20px' }}>
      <Title level={3} style={{ marginBottom: 24, textAlign: isMobile ? 'center' : 'left' }}>
        Welcome To ABUAD Face Attendance System
      </Title>

      <Row gutter={[16, 16]} justify={isMobile ? 'center' : 'start'}>
        {cards.map((card) => (
          <Col xs={24} sm={12} md={8} lg={6} key={card.key}>
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
                padding: isMobile ? '16px' : '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                gap: 12 
              }}>
                <div style={{
                  width: isMobile ? 48 : 64,
                  height: isMobile ? 48 : 64,
                  borderRadius: '50%',
                  backgroundColor: `${card.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}>
                  {React.cloneElement(card.icon, { color: card.color })}
                </div>
                <Title level={5} style={{ margin: 0, color: card.color }}>
                  {card.title}
                </Title>
                <Text type="secondary" style={{ fontSize: isMobile ? '12px' : '14px' }}>
                  {card.description}
                </Text>
                <Button 
                  type="link" 
                  style={{ 
                    color: card.color, 
                    padding: 0,
                    fontSize: isMobile ? '12px' : '14px'
                  }}
                >
                  Open →
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

// Back button component
const BackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  
  // Don't show back button on home page
  if (location.pathname === '/') return null;

  return (
    <Button
      type="text"
      icon={<ArrowLeft size={isMobile ? 16 : 20} />}
      onClick={() => navigate('/')}
      style={{
        marginBottom: 16,
        padding: isMobile ? '4px 8px' : '8px 16px',
        fontSize: isMobile ? '12px' : '14px',
      }}
    >
      {isMobile ? 'Back' : 'Back to Home'}
    </Button>
  );
};

// Main App Component
function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'testing',
    message: 'Testing database connection...'
  });
  
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Test the connection
  useEffect(() => {
    async function testConnection() {
      console.log('Testing Supabase connection...');
      
      try {
        const { data: authData, error: authError } = await supabase.auth.getSession();
        console.log('Auth session:', authData);
        
        const { data: faculties, error: facultiesError } = await supabase
          .from('faculties')
          .select('*')
          .limit(1);
        
        if (facultiesError) {
          console.error('Faculties fetch error details:', facultiesError);
          
          if (facultiesError.message.includes('Invalid API key')) {
            setConnectionStatus({
              status: 'error',
              message: 'Invalid API Key',
              details: 'Please check your .env file and ensure REACT_APP_SUPABASE_ANON_KEY is correct.'
            });
          } else if (facultiesError.message.includes('relation')) {
            setConnectionStatus({
              status: 'error',
              message: 'Table Not Found',
              details: 'The "faculties" table might not exist. Check your Supabase database structure.'
            });
          } else {
            setConnectionStatus({
              status: 'error',
              message: 'Database Connection Failed',
              details: facultiesError.message
            });
          }
        } else {
          setConnectionStatus({
            status: 'connected',
            message: 'Database Connected Successfully',
            details: null
          });
          console.log('✅ Database connection test passed!');
        }
      } catch (error: any) {
        console.error('Connection test failed:', error);
        setConnectionStatus({
          status: 'error',
          message: 'Network Error',
          details: error.message
        });
      }
    }
    
    testConnection();
  }, []);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setUser({ email: 'lecturer@abuad.edu.ng', name: 'Demo Lecturer' });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Show connection error screen if database connection failed
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
          maxWidth: 600,
          margin: '0 auto'
        }}>
          <Alert
            title={<Space><XCircle size={20} /><span>{connectionStatus.message}</span></Space>}
            description={
              <div>
                <p>Failed to connect to the database. Please check:</p>
                <ol style={{ textAlign: 'left', margin: '10px 0' }}>
                  <li>Your internet connection</li>
                  <li>Supabase project URL and API key in .env file</li>
                  <li>Supabase project is active and running</li>
                  <li>Database tables exist</li>
                </ol>
                {connectionStatus.details && <p><strong>Details:</strong> {connectionStatus.details}</p>}
                <div style={{ marginTop: 20 }}>
                  <Button 
                    type="primary" 
                    onClick={() => {
                      async function retryTest() {
                        setConnectionStatus({ status: 'testing', message: 'Retrying connection...' });
                        const { data: faculties } = await supabase.from('faculties').select('*').limit(1);
                        if (faculties) {
                          setConnectionStatus({ status: 'connected', message: 'Connected successfully!', details: null });
                        }
                      }
                      retryTest();
                    }}
                    style={{ marginRight: 10 }}
                  >
                    Retry Connection
                  </Button>
                  <Button onClick={() => alert('Check browser console for debug info')}>
                    Debug Info
                  </Button>
                </div>
              </div>
            }
            type="error"
            showIcon={false}
            style={{ marginBottom: 20 }}
          />
          
          <Alert
            title="Troubleshooting Steps"
            description={
              <div style={{ textAlign: 'left' }}>
                <h4>1. Check your .env file:</h4>
                <pre style={{ background: '#f5f5f5', padding: 10, margin: '10px 0', borderRadius: 4, fontSize: '12px' }}>
{`REACT_APP_SUPABASE_URL=https://hdcneyipanqhnfjetauv.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here`}
                </pre>
                
                <h4>2. Get your anon key:</h4>
                <ul>
                  <li>Go to <a href="https://app.supabase.com" target="_blank" rel="noreferrer">Supabase Dashboard</a></li>
                  <li>Select your project</li>
                  <li>Click Settings → API</li>
                  <li>Copy the <strong>anon public</strong> key</li>
                </ul>
                
                <h4>3. Restart development server:</h4>
                <pre style={{ background: '#f5f5f5', padding: 10, margin: '10px 0', borderRadius: 4 }}>
npm start
                </pre>
              </div>
            }
            type="info"
          />
        </div>
      </ConfigProvider>
    );
  }

  // Show loading screen while testing connection
  if (loading || connectionStatus.status === 'testing') {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        padding: 20 
      }}>
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 20 }}>Initializing System...</Title>
        <Text type="secondary">{connectionStatus.message}</Text>
        {connectionStatus.status === 'testing' && (
          <div style={{ marginTop: 20 }}>
            <Space><Shield size={16} /><Text>Testing database connection...</Text></Space>
          </div>
        )}
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <Router>
        <Layout style={{ minHeight: '100vh' }}>
          {!isMobile && (
            <Sider 
              collapsible 
              collapsed={collapsed} 
              onCollapse={setCollapsed}
              breakpoint="lg"
              collapsedWidth={80}
            >
              <div style={{ 
                padding: '16px', 
                textAlign: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.1)'
              }}>
                <Title level={4} style={{ color: 'white', margin: 0 }}>
                  {collapsed ? 'ABU' : 'ABUAD'}
                </Title>
                <div style={{ fontSize: '12px', color: '#ccc', marginTop: 4 }}>
                  Face Attendance
                </div>
                {connectionStatus.status === 'connected' && (
                  <div style={{ 
                    marginTop: 8,
                    fontSize: '10px',
                    color: '#52c41a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}>
                    <CheckCircle size={10} />
                    <span>Connected</span>
                  </div>
                )}
              </div>
              
              <Menu 
                theme="dark" 
                mode="inline" 
                defaultSelectedKeys={['1']}
                items={menuItems}
              />
            </Sider>
          )}
          
          <Layout>
            <Header style={{ 
              background: '#fff', 
              padding: isMobile ? '0 10px' : '0 16px',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              height: isMobile ? 'auto' : '64px',
              minHeight: isMobile ? '56px' : '64px',
            }}>
              <Space>
                {isMobile && (
                  <Button
                    type="text"
                    icon={<Home size={16} />}
                    onClick={() => window.location.href = '/'}
                    style={{ padding: '4px 8px' }}
                  />
                )}
                <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
                  {isMobile ? 'ABUAD F.A.S' : 'AFE Babalola University - Face Authentication System'}
                </Title>
              </Space>
              
              <Space>
                {user ? (
                  <>
                    {!isMobile && (
                      <Text type="secondary" style={{ marginRight: 8, fontSize: '14px' }}>
                        Welcome, {user.name || user.email}
                      </Text>
                    )}
                    <Button 
                      type="text" 
                      icon={<LogOut size={isMobile ? 14 : 16} />}
                      onClick={handleLogout}
                      style={{ padding: isMobile ? '4px 8px' : '8px 16px' }}
                    >
                      {!collapsed && !isMobile && 'Logout'}
                    </Button>
                  </>
                ) : (
                  <Button 
                    type="primary" 
                    icon={<LogIn size={isMobile ? 14 : 16} />}
                    onClick={handleLogin}
                    style={{ padding: isMobile ? '4px 8px' : '8px 16px' }}
                  >
                    {!collapsed && !isMobile && 'Login'}
                  </Button>
                )}
              </Space>
            </Header>
            
            <Content style={{ margin: isMobile ? '10px' : '16px' }}>
              <div style={{ 
                padding: isMobile ? '16px' : '24px', 
                background: '#fff', 
                minHeight: 360,
                borderRadius: 8,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                {!user ? (
                  <div style={{ textAlign: 'center', padding: isMobile ? '20px' : '50px' }}>
                    
                    <div style={{ marginTop: '20px' }}>
                      <Button 
                        type="primary" 
                        size={isMobile ? 'middle' : 'large'}
                        onClick={handleLogin} 
                        icon={<LogIn />}
                      >
                        Get Started 
                      </Button>
                    </div>
                    {/* PWA Install Prompt shows even on login screen */}
                    <div style={{ marginTop: 30 }}>
                      <PWAInstallPrompt />
                    </div>
                  </div>
                ) : (
                  <>
                    <BackButton />
                    <Routes>
                      <Route path="/" element={<HomeCards />} />
                        <Route path="/dashboard" element={<Dashboard />} /> {/* Changed from HomeCards to Dashboard */}
                      <Route path="/images" element={<ImageManagementPage />} />
                      <Route path="/enroll" element={<EnrollmentPage />} />
                      <Route path="/attendance" element={<AttendancePage />} />
                      
                      
                      
                      
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                    {/* PWA Install Prompt shows when logged in */}
                    <PWAInstallPrompt />
                  </>
                )}
              </div>
            </Content>
            
            <Footer style={{ 
              textAlign: 'center',
              padding: isMobile ? '12px 20px' : '16px 50px',
              backgroundColor: '#fafafa',
              fontSize: isMobile ? '12px' : '14px'
            }}>
              <Text style={{ fontSize: 'inherit' }}>
                AFE Babalola University Face Authentication System © {new Date().getFullYear()}
              </Text>
              <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#999', marginTop: 4 }}>
                Developed for Daily Student Attendance with Offline Support
              </div>
              {connectionStatus.status === 'connected' && (
                <div style={{ 
                  fontSize: isMobile ? '8px' : '10px', 
                  color: '#52c41a',
                  marginTop: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}>
                  <CheckCircle size={isMobile ? 8 : 10} />
                  <span>Database Connected</span>
                </div>
              )}
            </Footer>
          </Layout>
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

export default App;