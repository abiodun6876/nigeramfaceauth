// src/components/FaceCamera.tsx (FINAL FIXED VERSION)
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Button, Alert, Progress, Card, Typography, Space, message } from 'antd';
import { Camera, UserCheck, UserX, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Student } from '../types/database';

const { Title, Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'verification';
  student?: Student;
  eventId?: string;
  onCapture?: (imageData: string) => void;
  onFaceDetected?: (faceData: any) => void;
  onVerificationComplete?: (result: any) => void;
  onEnrollmentComplete?: (result: any) => void;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  student,
  eventId,
  onCapture,
  onFaceDetected,
  onVerificationComplete,
  onEnrollmentComplete,
}) => {
  // FIX: Correct Webcam ref type
 const webcamRef = useRef<any>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceQuality, setFaceQuality] = useState(0);
  const [enrollmentProgress, setEnrollmentProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);
  const [cameraError, setCameraError] = useState<string>('');

  // Video constraints for better camera quality
  const videoConstraints = {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: "user" as const,
    frameRate: { ideal: 30, max: 60 }
  };

  // FIX 1: Declare handleEnrollment first (with useCallback)
  const handleEnrollment = useCallback(async (imageSrc: string) => {
    setStatusMessage('Starting face enrollment...');
    
    const enrollmentSteps = 5;
    let currentStep = 0;

    const updateProgress = () => {
      currentStep++;
      setEnrollmentProgress((currentStep / enrollmentSteps) * 100);
    };

    // Step 1: Face detected
    updateProgress();
    setStatusMessage('Step 1/5: Face detected');

    // Simulate multiple angle captures
    for (let i = 0; i < 3; i++) {
      setStatusMessage(`Step ${i + 2}/5: Capturing face angle ${i + 1}/3...`);
      await new Promise(resolve => setTimeout(resolve, 800));
      updateProgress();
    }

    // Final processing
    setStatusMessage('Step 5/5: Creating face template...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    updateProgress();

    const result = {
      success: true,
      studentId: student?.id,
      studentName: student?.name,
      embedding: Array(512).fill(0).map(() => Math.random() - 0.5), // Simulated embedding
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

  // FIX 2: Declare handleVerification second (with useCallback)
  const handleVerification = useCallback(async (imageSrc: string) => {
    setStatusMessage('Verifying face...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate verification with different results
    const isMatch = Math.random() > 0.3; // 70% match rate for demo
    const confidence = isMatch ? 0.75 + Math.random() * 0.2 : 0.3 + Math.random() * 0.3;

    // Handle student type safely
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
    // Check if we're on HTTPS
    const isHTTPS = window.location.protocol === 'https:';
    if (!isHTTPS && process.env.NODE_ENV === 'production') {
      setCameraError('Camera requires HTTPS in production. Please use HTTPS.');
    }

    return () => {
      // Cleanup
      setIsCameraOn(false);
    };
  }, []);

  const startCamera = async () => {
    try {
      setStatusMessage('Requesting camera permission...');
      
      // Request camera permission first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints,
        audio: false 
      });
      
      // Stop the stream immediately to avoid memory leaks
      stream.getTracks().forEach(track => track.stop());
      
      // FIX 3: Removed setHasCameraPermission - use setIsCameraOn directly
      setIsCameraOn(true);
      setCameraError('');
      setStatusMessage('Camera started. Position your face in the frame.');
      
    } catch (error: any) {
      console.error('Camera error:', error);
      setCameraError(`Camera access denied: ${error.message}`);
      setStatusMessage('Camera access denied. Please allow camera permissions.');
      
      // Show specific error messages
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

  // FIX 4: Now captureFace can reference handleEnrollment and handleVerification
  const captureFace = useCallback(async () => {
    if (!webcamRef.current || !isCameraOn) {
      setStatusMessage('Camera is not ready. Please start camera first.');
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage('Capturing face...');

      // TypeScript now knows getScreenshot exists
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        throw new Error('Failed to capture image. Try again.');
      }

      // Show the captured image
      if (onCapture) {
        onCapture(imageSrc);
      }

      // Simulate face detection (replace with actual face-api.js in production)
      setStatusMessage('Detecting face...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const hasFace = Math.random() > 0.1; // 90% success rate for demo
      
      if (hasFace) {
        setFaceDetected(true);
        const quality = 0.7 + Math.random() * 0.25; // 70-95% quality
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
  }, [isCameraOn, mode, student, onCapture, onFaceDetected, handleEnrollment, handleVerification]);

  const retryCamera = () => {
    setCameraError('');
    setStatusMessage('');
    startCamera();
  };

  return (
    <Card 
      title={
        <Space>
          <Camera size={20} />
          <Text strong>{mode === 'enrollment' ? 'Face Enrollment' : 'Face Verification'}</Text>
        </Space>
      }
      style={{ maxWidth: 800, margin: '0 auto' }}
      extra={
        isCameraOn && (
          <Button 
            size="small" 
            icon={<RefreshCw size={14} />}
            onClick={retryCamera}
          >
            Retry Camera
          </Button>
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
            <Text type="secondary">
              Click "Start Camera" to begin {mode === 'enrollment' ? 'face enrollment' : 'face verification'}
            </Text>
            
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
              
              {/* Face overlay */}
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
                {mode === 'enrollment' ? 'Capture & Enroll Face' : 'Capture & Verify Face'}
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

            {/* Verification Result */}
            {lastResult && mode === 'verification' && (
              <Card 
                type="inner" 
                style={{ marginTop: 20 }}
                title={
                  <Space>
                    {lastResult.match ? (
                      <>
                        <CheckCircle color="#52c41a" />
                        <Text strong type="success">Verification Successful</Text>
                      </>
                    ) : (
                      <>
                        <XCircle color="#ff4d4f" />
                        <Text strong type="danger">Verification Failed</Text>
                      </>
                    )}
                  </Space>
                }
              >
                {lastResult.match && lastResult.student && (
                  <div>
                    <Text strong>Student Details:</Text>
                    <div style={{ marginTop: 10 }}>
                      <div><strong>Name:</strong> {lastResult.student.name}</div>
                      <div><strong>ID:</strong> {lastResult.student.student_id || lastResult.student.matric_number}</div>
                      <div><strong>Department:</strong> {lastResult.student.department?.name || 'N/A'}</div>
                      <div><strong>Level:</strong> {lastResult.student.level_code || lastResult.student.current_level?.name || 'N/A'}</div>
                      <div><strong>Confidence:</strong> {Math.round(lastResult.confidence * 100)}%</div>
                      <div><strong>Time:</strong> {new Date(lastResult.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </Card>
  );
};

export default FaceCamera;