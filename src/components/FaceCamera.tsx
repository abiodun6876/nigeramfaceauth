// src/components/FaceCamera.tsx (UPDATED WITH ATTENDANCE MODE)
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Button, Alert, Progress, Card, Typography, Space, message, Badge, Descriptions } from 'antd';
import { Camera, UserCheck, UserX, CheckCircle, XCircle, AlertCircle, RefreshCw, Clock, GraduationCap, Building, BookOpen } from 'lucide-react';
import { Student } from '../types/database';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'verification' | 'attendance'; // Added 'attendance' mode
  student?: Student;
  eventId?: string;
  sessionInfo?: {
    facultyId?: string;
    departmentId?: string;
    level?: number;
    courseCode?: string;
  };
  onCapture?: (imageData: string) => void;
  onFaceDetected?: (faceData: any) => void;
  onVerificationComplete?: (result: any) => void;
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void; // New prop for attendance
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  student,
  eventId,
  sessionInfo,
  onCapture,
  onFaceDetected,
  onVerificationComplete,
  onEnrollmentComplete,
  onAttendanceComplete,
}) => {
  const webcamRef = useRef<any>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceQuality, setFaceQuality] = useState(0);
  const [enrollmentProgress, setEnrollmentProgress] = useState(0);
  const [attendanceProgress, setAttendanceProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);

  const videoConstraints = {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: "user" as const,
    frameRate: { ideal: 30, max: 60 }
  };

  // Get student count for current session
  const getSessionStudentCount = useCallback(async () => {
    if (!sessionInfo?.facultyId || !sessionInfo?.departmentId || !sessionInfo?.level) return 0;
    
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id', { count: 'exact' })
        .eq('faculty_id', sessionInfo.facultyId)
        .eq('department_id', sessionInfo.departmentId)
        .eq('level', sessionInfo.level)
        .eq('enrollment_status', 'enrolled');
      
      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting student count:', error);
      return 0;
    }
  }, [sessionInfo]);

  // FIX 1: Updated handleAttendance function
  const handleAttendance = useCallback(async (imageSrc: string) => {
    setStatusMessage('Processing face for attendance...');
    setAttendanceProgress(0);
    
    try {
      // Step 1: Face detection (simulated)
      setAttendanceProgress(20);
      setStatusMessage('Step 1/4: Detecting face...');
      await new Promise(resolve => setTimeout(resolve, 800));

      // Step 2: Face recognition (simulated - replace with actual face matching)
      setAttendanceProgress(50);
      setStatusMessage('Step 2/4: Matching face with database...');
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Step 3: Find student in database
      setAttendanceProgress(70);
      setStatusMessage('Step 3/4: Fetching student details...');
      await new Promise(resolve => setTimeout(resolve, 600));

      // Get student count for this session
      const studentCount = await getSessionStudentCount();
      
      // Mock student data - replace with actual database query
      const mockStudents = [
        {
          id: 'stud_001',
          name: 'John Doe',
          student_id: 'ABU24001',
          matric_number: 'ABU24001',
          faculty_code: 'SCI',
          department_code: 'CSC',
          program: 'Computer Science',
          level: 200,
          level_code: '200',
          current_level: { code: '200', name: 'Level 200' },
          department: { name: 'Computer Science' },
          enrollment_status: 'enrolled' as const,
          face_match_score: 92.5
        },
        {
          id: 'stud_002', 
          name: 'Jane Smith',
          student_id: 'ABU24002',
          matric_number: 'ABU24002',
          faculty_code: 'ENG',
          department_code: 'MEE',
          program: 'Mechanical Engineering',
          level: 300,
          level_code: '300',
          current_level: { code: '300', name: 'Level 300' },
          department: { name: 'Mechanical Engineering' },
          enrollment_status: 'enrolled' as const,
          face_match_score: 87.3
        },
        {
          id: 'stud_003',
          name: 'Michael Johnson',
          student_id: 'ABU24003',
          matric_number: 'ABU24003',
          faculty_code: 'SCI',
          department_code: 'CSC',
          program: 'Computer Science',
          level: 200,
          level_code: '200',
          current_level: { code: '200', name: 'Level 200' },
          department: { name: 'Computer Science' },
          enrollment_status: 'enrolled' as const,
          face_match_score: 95.1
        }
      ];

      // Filter by session info if available
      let filteredStudents = mockStudents;
      if (sessionInfo?.facultyId) {
        filteredStudents = filteredStudents.filter(s => 
          s.faculty_code === (sessionInfo.facultyId?.includes('SCI') ? 'SCI' : 'ENG')
        );
      }
      if (sessionInfo?.departmentId) {
        filteredStudents = filteredStudents.filter(s => 
          s.department_code === (sessionInfo.departmentId?.includes('CSC') ? 'CSC' : 'MEE')
        );
      }
      if (sessionInfo?.level) {
        filteredStudents = filteredStudents.filter(s => 
          s.level === sessionInfo.level
        );
      }

      // Randomly select a student for demo
      const matchedStudent = filteredStudents.length > 0 
        ? filteredStudents[Math.floor(Math.random() * filteredStudents.length)]
        : mockStudents[0];
      
      const matchScore = matchedStudent.face_match_score || (85 + Math.random() * 15);

      // Step 4: Save attendance record (simulated)
      setAttendanceProgress(90);
      setStatusMessage('Step 4/4: Saving attendance record...');
      await new Promise(resolve => setTimeout(resolve, 800));

      setAttendanceProgress(100);
      
      const result = {
        success: true,
        match: true,
        student: matchedStudent,
        confidence: matchScore / 100,
        matchScore: matchScore,
        image: imageSrc,
        timestamp: new Date().toISOString(),
        sessionInfo: {
          totalStudents: studentCount,
          courseCode: sessionInfo?.courseCode || 'N/A',
          level: sessionInfo?.level || 'N/A'
        },
        message: `Attendance marked for ${matchedStudent.name} (${matchedStudent.matric_number})`,
      };

      setLastResult(result);
      setAttendanceRecords(prev => [...prev, result]);
      
      // Play success sound
      try {
        const audio = new Audio('/success-beep.mp3'); // Add this sound file to public folder
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch (e) {}

      message.success(`✅ ${matchedStudent.name} marked present!`);

      if (onAttendanceComplete) {
        onAttendanceComplete(result);
      }

    } catch (error: any) {
      const errorResult = {
        success: false,
        match: false,
        message: `Attendance failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
      
      setLastResult(errorResult);
      message.error('Attendance marking failed. Please try again.');
      
      if (onAttendanceComplete) {
        onAttendanceComplete(errorResult);
      }
    } finally {
      setAttendanceProgress(0);
    }
  }, [sessionInfo, getSessionStudentCount, onAttendanceComplete]);

  // FIX 2: Updated handleEnrollment function
  const handleEnrollment = useCallback(async (imageSrc: string) => {
    setStatusMessage('Starting face enrollment...');
    
    const enrollmentSteps = 5;
    let currentStep = 0;

    const updateProgress = () => {
      currentStep++;
      setEnrollmentProgress((currentStep / enrollmentSteps) * 100);
    };

    updateProgress();
    setStatusMessage('Step 1/5: Face detected');

    for (let i = 0; i < 3; i++) {
      setStatusMessage(`Step ${i + 2}/5: Capturing face angle ${i + 1}/3...`);
      await new Promise(resolve => setTimeout(resolve, 800));
      updateProgress();
    }

    setStatusMessage('Step 5/5: Creating face template...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    updateProgress();

    const result = {
      success: true,
      studentId: student?.id,
      studentName: student?.name,
      embedding: Array(512).fill(0).map(() => Math.random() - 0.5),
      quality: faceQuality,
      photoUrl: imageSrc,
      timestamp: new Date().toISOString(),
      message: `Face enrollment successful for ${student?.name || 'student'}`,
    };

    setLastResult(result);
    setStatusMessage(result.message);
    message.success('Face enrollment completed successfully!');

    if (onEnrollmentComplete) {
      onEnrollmentComplete(result);
    }
  }, [faceQuality, student, onEnrollmentComplete]);

  // FIX 3: Updated handleVerification function
  const handleVerification = useCallback(async (imageSrc: string) => {
    setStatusMessage('Verifying face...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    const isMatch = Math.random() > 0.3;
    const confidence = isMatch ? 0.75 + Math.random() * 0.2 : 0.3 + Math.random() * 0.3;

    const studentName = student?.name || 'John Student';
    const studentId = student?.student_id || student?.matric_number || 'ABU/2024/001';
    const studentLevel = student?.level_code || student?.current_level?.code || '300';
    const studentDepartment = student?.department?.name || 'Computer Science';
    
    const result = {
      success: true,
      match: isMatch,
      student: isMatch ? student || {
        id: 'demo-student-id',
        student_id: studentId,
        name: studentName,
        department: { name: studentDepartment },
        level_code: studentLevel,
        current_level: { code: studentLevel, name: `Level ${studentLevel}` },
        enrollment_status: 'enrolled' as const,
      } : null,
      confidence: confidence,
      distance: 1 - confidence,
      image: imageSrc,
      timestamp: new Date().toISOString(),
      message: isMatch 
        ? `Student verified: ${studentName} (${studentId})` 
        : 'No matching student found',
    };

    setLastResult(result);
    setStatusMessage(result.message);

    if (isMatch) {
      message.success(`Attendance marked for ${studentName}`);
    } else {
      message.warning('Verification failed. No matching student found.');
    }

    if (onVerificationComplete) {
      onVerificationComplete(result);
    }
  }, [student, onVerificationComplete]);

  useEffect(() => {
    const isHTTPS = window.location.protocol === 'https:';
    if (!isHTTPS && process.env.NODE_ENV === 'production') {
      setCameraError('Camera requires HTTPS in production. Please use HTTPS.');
    }

    return () => {
      setIsCameraOn(false);
    };
  }, []);

  const startCamera = async () => {
    try {
      setStatusMessage('Requesting camera permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints,
        audio: false 
      });
      
      stream.getTracks().forEach(track => track.stop());
      
      setIsCameraOn(true);
      setCameraError('');
      setStatusMessage('Camera started. Position your face in the frame.');
      
    } catch (error: any) {
      console.error('Camera error:', error);
      setCameraError(`Camera access denied: ${error.message}`);
      setStatusMessage('Camera access denied. Please allow camera permissions.');
      
      if (error.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (error.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access.');
      } else if (error.name === 'NotReadableError') {
        setCameraError('Camera is already in use by another application.');
      }
    }
  };

  const stopCamera = () => {
    setIsCameraOn(false);
    setFaceDetected(false);
    setStatusMessage('');
  };

  // FIX 4: Updated captureFace function with attendance mode
  const captureFace = useCallback(async () => {
    if (!webcamRef.current || !isCameraOn) {
      setStatusMessage('Camera is not ready. Please start camera first.');
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage('Capturing face...');

      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        throw new Error('Failed to capture image. Try again.');
      }

      if (onCapture) {
        onCapture(imageSrc);
      }

      setStatusMessage('Detecting face...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const hasFace = Math.random() > 0.1;
      
      if (hasFace) {
        setFaceDetected(true);
        const quality = 0.7 + Math.random() * 0.25;
        setFaceQuality(quality);
        setStatusMessage(`Face detected! Quality: ${Math.round(quality * 100)}%`);

        if (onFaceDetected) {
          onFaceDetected({
            face: { descriptor: new Float32Array(512) },
            quality: quality,
            image: imageSrc,
          });
        }

        // Handle based on mode
        if (mode === 'enrollment' && student) {
          await handleEnrollment(imageSrc);
        } else if (mode === 'verification') {
          await handleVerification(imageSrc);
        } else if (mode === 'attendance') {
          await handleAttendance(imageSrc);
        }
      } else {
        setStatusMessage('No face detected. Please position your face clearly in the frame.');
        message.warning('No face detected. Please try again.');
      }

    } catch (error: any) {
      console.error('Error capturing face:', error);
      setStatusMessage(`Error: ${error.message}`);
      message.error(`Capture failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isCameraOn, mode, student, onCapture, onFaceDetected, handleEnrollment, handleVerification, handleAttendance]);

  const retryCamera = () => {
    setCameraError('');
    setStatusMessage('');
    startCamera();
  };

  // Get mode display title
  const getModeTitle = () => {
    switch (mode) {
      case 'enrollment': return 'Face Enrollment';
      case 'verification': return 'Face Verification';
      case 'attendance': return 'Attendance Scanner';
      default: return 'Face Camera';
    }
  };

  // Get mode description
  const getModeDescription = () => {
    switch (mode) {
      case 'enrollment': return 'Capture and enroll student face for future recognition';
      case 'verification': return 'Verify student identity using face recognition';
      case 'attendance': return 'Mark attendance using face recognition';
      default: return '';
    }
  };

  return (
    <Card 
      title={
        <Space>
          <Camera size={20} />
          <Text strong>{getModeTitle()}</Text>
        </Space>
      }
      style={{ maxWidth: 800, margin: '0 auto' }}
      extra={
        isCameraOn && (
          <Space>
            {mode === 'attendance' && (
              <Badge 
                count={attendanceRecords.length} 
                style={{ backgroundColor: '#52c41a' }}
                title="Students marked"
              />
            )}
            <Button 
              size="small" 
              icon={<RefreshCw size={14} />}
              onClick={retryCamera}
            >
              Retry Camera
            </Button>
          </Space>
        )
      }
    >
      <div style={{ textAlign: 'center' }}>
        {cameraError ? (
          <div style={{ padding: '20px 0' }}>
            <Alert
              message="Camera Error"
              description={cameraError}
              type="error"
              showIcon
              style={{ marginBottom: 20 }}
            />
            <Button 
              type="primary" 
              onClick={retryCamera}
              icon={<Camera />}
            >
              Retry Camera
            </Button>
          </div>
        ) : !isCameraOn ? (
          <div style={{ padding: '40px 0' }}>
            <Camera size={64} style={{ marginBottom: 20, opacity: 0.5 }} />
            <Title level={4}>Camera Ready</Title>
            <Text type="secondary">{getModeDescription()}</Text>
            
            {/* Session info for attendance mode */}
            {mode === 'attendance' && sessionInfo && (
              <Card size="small" style={{ margin: '20px 0', textAlign: 'left' }}>
                <Descriptions title="Session Details" size="small" column={1}>
                  {sessionInfo.courseCode && (
                    <Descriptions.Item label="Course">
                      <BookOpen size={14} style={{ marginRight: 8 }} />
                      {sessionInfo.courseCode}
                    </Descriptions.Item>
                  )}
                  {sessionInfo.level && (
                    <Descriptions.Item label="Level">
                      <GraduationCap size={14} style={{ marginRight: 8 }} />
                      Level {sessionInfo.level}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}
            
            <Alert
              style={{ margin: '20px 0', textAlign: 'left' }}
              message="Camera Requirements"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Ensure camera permission is allowed</li>
                  <li>Use HTTPS in production (required for camera)</li>
                  <li>Good lighting on your face</li>
                  <li>Remove glasses or hats if possible</li>
                  <li>Look directly at the camera</li>
                  {mode === 'attendance' && (
                    <li>Face must be enrolled in the system</li>
                  )}
                </ul>
              }
              type="info"
            />
            
            <div style={{ marginTop: 20 }}>
              <Button 
                type="primary" 
                size="large" 
                onClick={startCamera}
                icon={<Camera />}
                loading={isProcessing}
              >
                Start Camera
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                onUserMediaError={(error) => {
                  console.error('Webcam error:', error);
                  setCameraError('Camera stream error. Please try again.');
                }}
                style={{
                  width: '100%',
                  maxHeight: 480,
                  borderRadius: 8,
                  border: faceDetected ? '3px solid #52c41a' : '3px solid #d9d9d9',
                  backgroundColor: '#000',
                }}
                screenshotQuality={1}
              />
              
              {faceDetected && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    width: '60%',
                    height: '80%',
                    border: '2px solid #52c41a',
                    borderRadius: '50%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: 'rgba(82, 196, 26, 0.1)',
                  }}>
                    <UserCheck size={48} color="#52c41a" />
                  </div>
                </div>
              )}
            </div>

            {/* Status Indicators */}
            <Space direction="vertical" style={{ width: '100%', marginBottom: 20 }}>
              {faceDetected && (
                <Progress 
                  percent={Math.round(faceQuality * 100)} 
                  status="active"
                  format={percent => `Face Quality: ${percent}%`}
                />
              )}
              
              {mode === 'enrollment' && enrollmentProgress > 0 && (
                <Progress 
                  percent={Math.round(enrollmentProgress)}
                  status="active"
                  format={percent => `Enrollment: ${percent}%`}
                />
              )}
              
              {mode === 'attendance' && attendanceProgress > 0 && (
                <Progress 
                  percent={Math.round(attendanceProgress)}
                  status="active"
                  format={percent => `Processing: ${percent}%`}
                />
              )}
              
              {statusMessage && (
                <Alert
                  message={statusMessage}
                  type={
                    lastResult?.success ? 'success' : 
                    lastResult?.match === false ? 'warning' : 
                    'info'
                  }
                  showIcon
                  icon={
                    lastResult?.success ? <CheckCircle /> :
                    lastResult?.match === false ? <UserX /> :
                    <AlertCircle />
                  }
                />
              )}
            </Space>

            {/* Controls */}
            <Space>
              <Button 
                onClick={captureFace}
                loading={isProcessing}
                disabled={!isCameraOn || isProcessing}
                type="primary"
                size="large"
                icon={<Camera />}
              >
                {mode === 'enrollment' ? 'Capture & Enroll Face' : 
                 mode === 'verification' ? 'Capture & Verify Face' : 
                 'Scan for Attendance'}
              </Button>
              
              <Button 
                onClick={stopCamera}
                disabled={isProcessing}
                size="large"
              >
                Stop Camera
              </Button>
            </Space>

            {/* Student info for enrollment */}
            {mode === 'enrollment' && student && (
              <Card 
                type="inner" 
                style={{ marginTop: 20, textAlign: 'left' }}
                size="small"
              >
                <Text strong>Enrolling Student:</Text>
                <div style={{ marginTop: 10 }}>
                  <div><strong>Name:</strong> {student.name}</div>
                  <div><strong>Matric:</strong> {student.student_id || student.matric_number || 'N/A'}</div>
                  <div><strong>Program:</strong> {student.program_name || student.program?.name || 'N/A'}</div>
                  <div><strong>Level:</strong> {student.level_code || student.current_level?.name || 'N/A'}</div>
                </div>
              </Card>
            )}

            {/* Attendance/Verification Result */}
            {(mode === 'attendance' || mode === 'verification') && lastResult && (
              <Card 
                type="inner" 
                style={{ marginTop: 20 }}
                title={
                  <Space>
                    {lastResult.success && lastResult.match ? (
                      <>
                        <CheckCircle color="#52c41a" />
                        <Text strong type="success">
                          {mode === 'attendance' ? 'Attendance Marked' : 'Verification Successful'}
                        </Text>
                      </>
                    ) : (
                      <>
                        <XCircle color="#ff4d4f" />
                        <Text strong type="danger">
                          {mode === 'attendance' ? 'Attendance Failed' : 'Verification Failed'}
                        </Text>
                      </>
                    )}
                  </Space>
                }
              >
                {lastResult.success && lastResult.match && lastResult.student && (
                  <div>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Name">
                        <UserCheck size={14} style={{ marginRight: 8 }} />
                        {lastResult.student.name}
                      </Descriptions.Item>
                      <Descriptions.Item label="Matric Number">
                        <GraduationCap size={14} style={{ marginRight: 8 }} />
                        {lastResult.student.matric_number || lastResult.student.student_id}
                      </Descriptions.Item>
                      <Descriptions.Item label="Department">
                        <Building size={14} style={{ marginRight: 8 }} />
                        {lastResult.student.department?.name || lastResult.student.department_code}
                      </Descriptions.Item>
                      <Descriptions.Item label="Level">
                        <BookOpen size={14} style={{ marginRight: 8 }} />
                        {lastResult.student.level || lastResult.student.level_code}
                      </Descriptions.Item>
                      {mode === 'attendance' && (
                        <>
                          <Descriptions.Item label="Match Score">
                            <Text strong type="success">
                              {Math.round(lastResult.matchScore || (lastResult.confidence * 100))}%
                            </Text>
                          </Descriptions.Item>
                          <Descriptions.Item label="Time">
                            <Clock size={14} style={{ marginRight: 8 }} />
                            {new Date(lastResult.timestamp).toLocaleTimeString()}
                          </Descriptions.Item>
                        </>
                      )}
                    </Descriptions>
                  </div>
                )}
              </Card>
            )}

            {/* Attendance session summary */}
            {mode === 'attendance' && attendanceRecords.length > 0 && (
              <Card 
                type="inner" 
                style={{ marginTop: 20 }}
                title={
                  <Space>
                    <UserCheck size={16} />
                    <Text strong>Attendance Summary</Text>
                  </Space>
                }
                size="small"
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>Total Marked:</Text>
                    <Badge count={attendanceRecords.length} style={{ backgroundColor: '#52c41a' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>Last Student:</Text>
                    <Text strong>
                      {attendanceRecords[attendanceRecords.length - 1]?.student?.name || 'None'}
                    </Text>
                  </div>
                </Space>
              </Card>
            )}
          </>
        )}
      </div>
    </Card>
  );
};

export default FaceCamera;