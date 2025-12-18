// src/App.tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Layout, Menu, Button, Spin, Alert, Typography, Space, ConfigProvider, theme } from 'antd';
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
  XCircle
} from 'lucide-react';
import EnrollmentPage from './pages/EnrollmentPage';
import AttendancePage from './pages/AttendancePage';
import Dashboard from './pages/Dashboard';
import SyncPage from './pages/SyncPage';
import { supabase } from './lib/supabase';
import './App.css';

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

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
    key: '4',
    icon: React.createElement(Users, { size: 16 }),
    label: <Link to="/students">Student Management</Link>,
  },
  {
    key: '5',
    icon: React.createElement(Calendar, { size: 16 }),
    label: <Link to="/events">Event Management</Link>,
  },
  {
    key: '6',
    icon: React.createElement(Database, { size: 16 }),
    label: <Link to="/sync">Sync Data</Link>,
  },
  {
    key: '7',
    icon: React.createElement(Settings, { size: 16 }),
    label: <Link to="/settings">Settings</Link>,
  },
];

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'testing',
    message: 'Testing database connection...'
  });

  // Test the connection
  useEffect(() => {
    async function testConnection() {
      console.log('Testing Supabase connection...');
      
      // Test 1: Check if we can access auth
      try {
        const { data: authData, error: authError } = await supabase.auth.getSession();
      console.log('Auth session:', authData); // Log to use variable
        console.log('Auth test:', authData, authError);
        
        // Test 2: Try to fetch from faculties table
        const { data: faculties, error: facultiesError } = await supabase
          .from('faculties')
          .select('*')
          .limit(1);
        
        console.log('Faculties test:', faculties, facultiesError);
        
        if (facultiesError) {
          console.error('Faculties fetch error details:', {
            message: facultiesError.message,
            code: facultiesError.code,
            details: facultiesError.details
          });
          
          // Check the specific error
          if (facultiesError.message.includes('Invalid API key')) {
            setConnectionStatus({
              status: 'error',
              message: 'Invalid API Key',
              details: 'Please check your .env file and ensure REACT_APP_SUPABASE_ANON_KEY is correct.'
            });
          } else if (facultiesError.message.includes('JWT')) {
            setConnectionStatus({
              status: 'error',
              message: 'Authentication Error',
              details: 'There might be an issue with your authentication token.'
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
    // For demo purposes, we'll use a simple login
    // In production, implement proper auth with Supabase
    setUser({ email: 'lecturer@abuad.edu.ng', name: 'Demo Lecturer' });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Show connection error screen if database connection failed
  if (connectionStatus.status === 'error') {
    return (
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
        }}
      >
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
            title={
              <Space>
                <XCircle size={20} />
                <span>{connectionStatus.message}</span>
              </Space>
            }
            description={
              <div>
                <p>Failed to connect to the database. Please check:</p>
                <ol style={{ textAlign: 'left', margin: '10px 0' }}>
                  <li>Your internet connection</li>
                  <li>Supabase project URL and API key in .env file</li>
                  <li>Supabase project is active and running</li>
                  <li>Database tables exist</li>
                </ol>
                {connectionStatus.details && (
                  <p><strong>Details:</strong> {connectionStatus.details}</p>
                )}
                <div style={{ marginTop: 20 }}>
                  <Button 
                    type="primary" 
                    onClick={() => {
                      // Test connection again
                      async function retryTest() {
                        setConnectionStatus({
                          status: 'testing',
                          message: 'Retrying connection...'
                        });
                        const { data: authData } = await supabase.auth.getSession();
                        const { data: faculties } = await supabase
                          .from('faculties')
                          .select('*')
                          .limit(1);
                        
                        if (faculties) {
                          setConnectionStatus({
                            status: 'connected',
                            message: 'Connected successfully!',
                            details: null
                          });
                        }
                      }
                      retryTest();
                    }}
                    style={{ marginRight: 10 }}
                  >
                    Retry Connection
                  </Button>
                  <Button 
                    onClick={() => {
                      console.log('Current environment:', {
                        url: process.env.REACT_APP_SUPABASE_URL,
                        keyExists: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
                        keyPreview: process.env.REACT_APP_SUPABASE_ANON_KEY 
                          ? '***' + process.env.REACT_APP_SUPABASE_ANON_KEY.slice(-4) 
                          : 'MISSING'
                      });
                      alert('Check browser console for debug info');
                    }}
                  >
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
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: 10, 
                  margin: '10px 0',
                  borderRadius: 4,
                  fontSize: '12px',
                  overflow: 'auto'
                }}>
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
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: 10, 
                  margin: '10px 0',
                  borderRadius: 4 
                }}>
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
            <Space>
              <Shield size={16} />
              <Text>Testing database connection...</Text>
            </Space>
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
          
          <Layout>
            <Header style={{ 
              background: '#fff', 
              padding: '0 16px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
            }}>
              <Title level={4} style={{ margin: 0 }}>
                AFE Babalola University - Face Authentication System
              </Title>
              
              <Space>
                {user ? (
                  <>
                    <Text type="secondary" style={{ marginRight: 8 }}>
                      Welcome, {user.name || user.email}
                    </Text>
                    <Button type="text" icon={<LogOut size={16} />} onClick={handleLogout}>
                      {!collapsed && 'Logout'}
                    </Button>
                  </>
                ) : (
                  <Button type="primary" icon={<LogIn size={16} />} onClick={handleLogin}>
                    {!collapsed && 'Login'}
                  </Button>
                )}
              </Space>
            </Header>
            
            <Content style={{ margin: '16px' }}>
              <div style={{ 
                padding: 24, 
                background: '#fff', 
                minHeight: 360,
                borderRadius: 8,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                {!user ? (
                  <div style={{ textAlign: 'center', padding: '50px' }}>
                    <Alert
                      title="Authentication Required"
                      description="Please login to access the face authentication system"
                      type="warning"
                      showIcon
                    />
                    <div style={{ marginTop: '20px' }}>
                      <Button 
                        type="primary" 
                        size="large" 
                        onClick={handleLogin} 
                        icon={<LogIn />}
                      >
                        Login as Demo Lecturer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/enroll" element={<EnrollmentPage />} />
                    <Route path="/attendance" element={<AttendancePage />} />
                    <Route path="/students" element={<div>Student Management (Coming Soon)</div>} />
                    <Route path="/events" element={<div>Event Management (Coming Soon)</div>} />
                    <Route path="/sync" element={<SyncPage />} />
                    <Route path="/settings" element={<div>Settings (Coming Soon)</div>} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                )}
              </div>
            </Content>
            
            <Footer style={{ 
              textAlign: 'center',
              padding: '16px 50px',
              backgroundColor: '#fafafa'
            }}>
              <Text>
                AFE Babalola University Face Authentication System © {new Date().getFullYear()}
              </Text>
              <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
                Developed for Daily Student Attendance with Offline Support
              </div>
              {connectionStatus.status === 'connected' && (
                <div style={{ 
                  fontSize: '10px', 
                  color: '#52c41a',
                  marginTop: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}>
                  <CheckCircle size={10} />
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