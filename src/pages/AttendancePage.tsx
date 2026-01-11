// src/pages/AttendancePage.tsx - NIGERAM STAFF VERSION
import React, { useState, useEffect, useRef } from 'react';
import {
  Select,
  Button,
  Typography,
  Space,
  Badge
} from 'antd';
import { 
  Camera, 
  CheckCircle, 
  XCircle,
  Clock,
  ArrowLeft
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import faceRecognition from '../utils/faceRecognition';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const AttendancePage: React.FC = () => {
  const [departments] = useState<any[]>([
    { id: 'studio', code: 'STU', name: 'Studio' },
    { id: 'logistics', code: 'LOG', name: 'Logistics' },
    { id: 'bakery', code: 'BAK', name: 'Bakery' },
    { id: 'spa', code: 'SPA', name: 'Spa' },
  ]);
  
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedDepartmentData, setSelectedDepartmentData] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [successfulScans, setSuccessfulScans] = useState(0);
  const [alreadyMarkedScans, setAlreadyMarkedScans] = useState(0);
  const [mobileInstructions, setMobileInstructions] = useState(false);
  
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markedStaffRef = useRef<Set<string>>(new Set());

  // Test camera access
  const testCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('✅ Camera access granted');
      stream.getTracks().forEach(track => track.stop());
    } catch (error: any) {
      console.error('❌ Camera error:', error.name, error.message);
    }
  };

  // Check if staff already marked attendance today
  const checkExistingAttendance = async (staffId: string): Promise<boolean> => {
    if (!selectedDepartmentData) return false;
    
    try {
      const attendanceDate = dayjs().format('YYYY-MM-DD');
      
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('id')
        .eq('staff_id', staffId)
        .eq('department', selectedDepartmentData.id)
        .eq('attendance_date', attendanceDate)
        .maybeSingle();
      
      if (error) throw error;
      
      return !!data;
    } catch (error) {
      console.error('Error checking existing attendance:', error);
      return false;
    }
  };

  // Record Attendance for Staff
  const recordAttendance = async (staffData: any, confidence: number) => {
    try {
      const attendanceDate = dayjs().format('YYYY-MM-DD');
      
      // Check if already marked in database
      const alreadyMarked = await checkExistingAttendance(staffData.staff_id);
      if (alreadyMarked) {
        return { success: false, alreadyMarked: true };
      }
      
      // Check if already marked in this session
      const staffKey = `${staffData.staff_id}-${selectedDepartmentData.id}-${attendanceDate}`;
      if (markedStaffRef.current.has(staffKey)) {
        return { success: false, alreadyMarked: true };
      }

      const attendanceData = {
        staff_id: staffData.staff_id,
        staff_name: staffData.name,
        department: selectedDepartmentData.id,
        attendance_date: attendanceDate,
        check_in_time: new Date().toISOString(),
        status: 'present',
        verification_method: 'face_recognition',
        confidence_score: confidence,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('staff_attendance')
        .insert([attendanceData]);
      
      if (error) throw error;
      
      markedStaffRef.current.add(staffKey);
      
      return { success: true, alreadyMarked: false };
      
    } catch (error: any) {
      console.error('Record attendance error:', error);
      throw error;
    }
  };

  // Handle face detection
  const handleFaceDetection = async (result: any) => {
    if (!result.success || !result.photoUrl || isProcessing || !selectedDepartmentData) return;
    
    setIsProcessing(true);
    setScanCount(prev => prev + 1);
    
    try {
      const matches = await faceRecognition.matchFaceForAttendance(result.photoUrl);
      
      if (matches.length === 0 || matches[0].confidence < 0.60) {
        setLastScanResult({ 
          success: false,
          type: 'no_match'
        });
        return;
      }
      
      const bestMatch = matches[0];
      
      // Get staff data
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('staff_id', bestMatch.staffId)
        .eq('employment_status', 'active')
        .maybeSingle();
      
      if (!staffData) {
        setLastScanResult({ 
          success: false,
          type: 'not_enrolled'
        });
        return;
      }
      
      // Record attendance
      const attendanceResult = await recordAttendance(staffData, bestMatch.confidence);
      
      if (attendanceResult.alreadyMarked) {
        setLastScanResult({
          success: false,
          type: 'already_marked',
          staff: {
            name: staffData.name,
            staff_id: staffData.staff_id
          }
        });
        setAlreadyMarkedScans(prev => prev + 1);
      } else if (attendanceResult.success) {
        setLastScanResult({
          success: true,
          staff: {
            name: staffData.name,
            staff_id: staffData.staff_id
          }
        });
        setSuccessfulScans(prev => prev + 1);
        
        // Auto-reset after 1.5 seconds
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
        scanTimeoutRef.current = setTimeout(() => {
          setLastScanResult(null);
        }, 1500);
      }
      
    } catch (error: any) {
      console.error('Face recognition error:', error);
      setLastScanResult({ 
        success: false,
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Start scanning
  const startScanning = async () => {
    if (!faceModelsLoaded) {
      try {
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
      } catch (error) {
        console.log('Face models loading...');
      }
    }
    setIsCameraActive(true);
    setLastScanResult(null);
    markedStaffRef.current.clear();
  };

  // Back to department selection
  const handleBack = () => {
    setIsCameraActive(false);
    setSelectedDepartment('');
    setSelectedDepartmentData(null);
  };

  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
      } catch (error) {
        console.log('Face models loading...');
      }
    };
    loadModels();

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const hasSeenInstructions = localStorage.getItem('hasSeenMobileInstructions');
    
    if (isMobile && !hasSeenInstructions) {
      const timer = setTimeout(() => {
        setMobileInstructions(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      const dept = departments.find(d => d.id === selectedDepartment);
      setSelectedDepartmentData(dept);
      markedStaffRef.current.clear();
    }
  }, [selectedDepartment, departments]);

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a1a35',
      color: '#ffffff'
    }}>
      {/* Mobile Instructions Overlay */}
      {mobileInstructions && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            backgroundColor: '#0a1a35',
            padding: 24,
            borderRadius: 12,
            maxWidth: 400,
            textAlign: 'center',
            border: '2px solid #00aaff',
            boxShadow: '0 0 30px rgba(0, 170, 255, 0.3)'
          }}>
            <Title level={3} style={{ color: '#00ffaa', marginBottom: 16 }}>
              📱 Mobile Instructions
            </Title>
            <Text style={{ color: '#aaccff', display: 'block', marginBottom: 16 }}>
              For face recognition to work on mobile:
            </Text>
            <Space direction="vertical" style={{ textAlign: 'left', marginBottom: 24, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ 
                  width: 24, 
                  height: 24, 
                  backgroundColor: 'rgba(0, 255, 150, 0.2)', 
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12
                }}>
                  <Text style={{ color: '#00ffaa', fontWeight: 'bold' }}>1</Text>
                </div>
                <Text style={{ color: '#fff' }}>Grant camera permission when asked</Text>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ 
                  width: 24, 
                  height: 24, 
                  backgroundColor: 'rgba(0, 255, 150, 0.2)', 
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12
                }}>
                  <Text style={{ color: '#00ffaa', fontWeight: 'bold' }}>2</Text>
                </div>
                <Text style={{ color: '#fff' }}>Ensure good lighting on your face</Text>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ 
                  width: 24, 
                  height: 24, 
                  backgroundColor: 'rgba(0, 255, 150, 0.2)', 
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12
                }}>
                  <Text style={{ color: '#00ffaa', fontWeight: 'bold' }}>3</Text>
                </div>
                <Text style={{ color: '#fff' }}>Hold phone steady at eye level</Text>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ 
                  width: 24, 
                  height: 24, 
                  backgroundColor: 'rgba(0, 255, 150, 0.2)', 
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12
                }}>
                  <Text style={{ color: '#00ffaa', fontWeight: 'bold' }}>4</Text>
                </div>
                <Text style={{ color: '#fff' }}>Keep face within the frame</Text>
              </div>
            </Space>
            <Button 
              type="primary" 
              size="large"
              onClick={() => {
                setMobileInstructions(false);
                localStorage.setItem('hasSeenMobileInstructions', 'true');
              }}
              style={{ 
                width: '100%',
                backgroundColor: '#00aaff',
                border: 'none',
                height: 48,
                fontSize: 16,
                fontWeight: 'bold'
              }}
            >
              Got it, let's start!
            </Button>
          </div>
        </div>
      )}

      {/* Debug Button */}
      <Button
        type="text"
        size="small"
        onClick={() => {
          console.group('🔍 Face Recognition Debug');
          console.log('Face models loaded:', faceModelsLoaded);
          console.log('Camera active:', isCameraActive);
          console.log('Processing:', isProcessing);
          testCameraAccess();
          console.groupEnd();
        }}
        style={{
          position: 'absolute',
          bottom: 100,
          right: 20,
          zIndex: 1000,
          opacity: 0.5,
          color: '#aaccff'
        }}
      >
        Debug
      </Button>

      {/* Main Content */}
      <div style={{ 
        flex: 1,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Department Selection */}
        {!selectedDepartment && (
          <div style={{ 
            textAlign: 'center', 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              width: 80,
              height: 80,
              backgroundColor: 'rgba(0, 150, 255, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              border: '2px solid rgba(0, 150, 255, 0.5)',
              boxShadow: '0 0 20px rgba(0, 150, 255, 0.3)'
            }}>
              <Camera size={36} color="#00aaff" />
            </div>
            
            <Text style={{ 
              fontSize: 20, 
              marginBottom: 24, 
              fontWeight: 600,
              color: '#ffffff'
            }}>
              SELECT DEPARTMENT
            </Text>
            
            <Select
              style={{ 
                width: '100%', 
                maxWidth: 400,
                marginBottom: 24
              }}
              placeholder="Choose department..."
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              size="large"
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => {
                const label = option?.label?.toString().toLowerCase() || '';
                return label.includes(input.toLowerCase());
              }}
              options={departments.map(dept => ({
                value: dept.id,
                label: `${dept.code} - ${dept.name}`,
              }))}
            />
          </div>
        )}

        {/* Department Selected - Ready to Scan */}
        {selectedDepartment && !isCameraActive && selectedDepartmentData && (
          <div style={{ 
            textAlign: 'center', 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              width: 100,
              height: 100,
              backgroundColor: 'rgba(0, 255, 150, 0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              border: '2px solid rgba(0, 255, 150, 0.5)',
              boxShadow: '0 0 30px rgba(0, 255, 150, 0.2)',
              animation: 'pulse 2s infinite'
            }}>
              <Camera size={44} color="#00ffaa" />
            </div>
            
            <Text style={{ 
              fontSize: 24, 
              marginBottom: 8, 
              color: '#00ffaa',
              fontWeight: 700,
              textShadow: '0 0 10px rgba(0, 255, 150, 0.5)'
            }}>
              {selectedDepartmentData.name.toUpperCase()}
            </Text>
            
            <Text style={{ 
              fontSize: 16, 
              marginBottom: 32,
              color: '#aaccff'
            }}>
              Staff Attendance
            </Text>
            
            <Button
              type="primary"
              icon={<Camera size={20} />}
              onClick={startScanning}
              size="large"
              style={{
                height: 60,
                fontSize: 18,
                padding: '0 48px',
                borderRadius: 12,
                backgroundColor: '#00aaff',
                border: 'none',
                marginTop: 16,
                boxShadow: '0 0 20px rgba(0, 170, 255, 0.4)'
              }}
            >
              START SCANNING
            </Button>
          </div>
        )}

        {/* Active Scanning */}
        {isCameraActive && selectedDepartmentData && (
          <div style={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            {/* Department and Back Button - Top Left */}
            <div style={{
              position: 'absolute',
              top: 20,
              left: 20,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <Button
                icon={<ArrowLeft size={20} />}
                onClick={handleBack}
                style={{
                  backgroundColor: 'rgba(0, 150, 255, 0.2)',
                  border: '1px solid rgba(0, 150, 255, 0.5)',
                  color: '#00aaff',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}
              />
              
              <div style={{
                backgroundColor: 'rgba(0, 150, 255, 0.2)',
                color: '#00aaff',
                padding: '8px 16px',
                borderRadius: 20,
                border: '1px solid rgba(0, 150, 255, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backdropFilter: 'blur(10px)'
              }}>
                <Badge status="processing" color="#00ffaa" />
                <Text style={{ fontSize: 14, fontWeight: 600 }}>
                  {selectedDepartmentData.name}
                </Text>
              </div>
            </div>

            {/* Success Count Badge - Top Right */}
            <div style={{
              position: 'absolute',
              top: 20,
              right: 20,
              zIndex: 100
            }}>
              <div style={{
                width: 50,
                height: 50,
                backgroundColor: 'rgba(0, 255, 150, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #00ffaa',
                boxShadow: '0 0 15px rgba(0, 255, 150, 0.3)',
                backdropFilter: 'blur(10px)'
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: 'bold',
                  color: '#00ffaa'
                }}>
                  {successfulScans}
                </Text>
              </div>
            </div>

            {/* Camera Feed */}
            <div style={{ 
              flex: 1,
              minHeight: 0,
              position: 'relative',
              marginTop: 0
            }}>
              <div style={{ 
                height: '100%',
                borderRadius: 16,
                overflow: 'hidden',
                border: '2px solid rgba(0, 150, 255, 0.3)',
                boxShadow: '0 0 30px rgba(0, 150, 255, 0.2)'
              }}>
                <FaceCamera
                  mode="attendance"
                  onAttendanceComplete={handleFaceDetection}
                  autoCapture={true}
                  captureInterval={3000}
                />
              </div>

              {isProcessing && (
                <div style={{
                  position: 'absolute',
                  bottom: 20,
                  left: 0,
                  right: 0,
                  textAlign: 'center'
                }}>
                  <div style={{
                    display: 'inline-block',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: '#00ffaa',
                    padding: '8px 20px',
                    borderRadius: 20,
                    fontSize: 14,
                    fontWeight: 600,
                    backdropFilter: 'blur(10px)'
                  }}>
                    SCANNING...
                  </div>
                </div>
              )}
            </div>

            {/* Last Scan Result */}
            {lastScanResult && (
              <div style={{
                position: 'absolute',
                bottom: 80,
                left: 0,
                right: 0,
                textAlign: 'center',
                zIndex: 100
              }}>
                <div style={{
                  display: 'inline-block',
                  backgroundColor: lastScanResult.success 
                    ? 'rgba(0, 255, 150, 0.15)' 
                    : lastScanResult.type === 'already_marked'
                    ? 'rgba(255, 200, 0, 0.15)'
                    : 'rgba(255, 50, 50, 0.15)',
                  color: lastScanResult.success 
                    ? '#00ffaa' 
                    : lastScanResult.type === 'already_marked'
                    ? '#ffcc00'
                    : '#ff3333',
                  padding: '12px 24px',
                  borderRadius: 12,
                  border: lastScanResult.success 
                    ? '1px solid rgba(0, 255, 150, 0.5)' 
                    : lastScanResult.type === 'already_marked'
                    ? '1px solid rgba(255, 200, 0, 0.5)'
                    : '1px solid rgba(255, 50, 50, 0.5)',
                  fontSize: 16,
                  fontWeight: 600,
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)'
                }}>
                  {lastScanResult.success ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={20} />
                      <span>{lastScanResult.staff?.name}</span>
                    </div>
                  ) : lastScanResult.type === 'already_marked' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <XCircle size={20} />
                      <span>ALREADY MARKED</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <XCircle size={20} />
                      <span>SCAN FAILED</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div style={{ 
        padding: '8px 16px',
        backgroundColor: 'rgba(10, 26, 53, 0.8)',
        borderTop: '1px solid rgba(0, 150, 255, 0.2)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: faceModelsLoaded ? '#00ffaa' : '#ffaa00',
              boxShadow: faceModelsLoaded ? '0 0 8px #00ffaa' : '0 0 8px #ffaa00'
            }} />
            <Text style={{ fontSize: 11, color: '#aaccff' }}>
              {faceModelsLoaded ? 'READY' : 'LOADING'}
            </Text>
          </Space>
          <Text style={{ fontSize: 11, color: '#aaccff' }}>
            <Clock size={10} style={{ marginRight: 4 }} />
            {dayjs().format('HH:mm')}
          </Text>
        </div>
      </div>

      <style>
        {`
          @keyframes pulse {
            0% { box-shadow: 0 0 20px rgba(0, 255, 150, 0.2); }
            50% { box-shadow: 0 0 30px rgba(0, 255, 150, 0.4); }
            100% { box-shadow: 0 0 20px rgba(0, 255, 150, 0.2); }
          }
        `}
      </style>
    </div>
  );
};

export default AttendancePage;