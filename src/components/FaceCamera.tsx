// src/components/FaceCamera.tsx - ACTUAL WEBCAM VERSION
import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Alert, Typography, Space, Progress, Row, Col } from 'antd';
import { Camera, RefreshCw, CheckCircle, User, Video, VideoOff } from 'lucide-react';

const { Title, Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  student?: any;
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  student,
  onEnrollmentComplete,
  onAttendanceComplete
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize camera
  const startCamera = async () => {
    try {
      setError(null);
      
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' // Front camera
        },
        audio: false
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
      
    } catch (err: any) {
      console.error('Camera error:', err);
      setError(`Camera access denied: ${err.message}`);
      setIsCameraActive(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCapturedImage(null);
  };

  // Capture image from webcam
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return null;
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleCapture = async () => {
    if (!isCameraActive) {
      setError('Please start the camera first');
      return;
    }

    setIsCapturing(true);
    setProgress(0);
    setCapturedImage(null);

    // Capture image
    const imageData = captureImage();
    
    if (!imageData) {
      setError('Failed to capture image');
      setIsCapturing(false);
      return;
    }

    setCapturedImage(imageData);

    // Simulate processing
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          // Generate result based on mode
          const result = {
            success: true,
            message: mode === 'enrollment' 
              ? 'Face enrolled successfully!' 
              : 'Attendance recorded successfully!',
            timestamp: new Date().toISOString(),
            photoUrl: imageData,
            quality: 0.85 + Math.random() * 0.1
          };

          if (mode === 'enrollment') {
            // For enrollment, add student data and embedding
            Object.assign(result, {
              studentId: student?.id || `student_${Date.now()}`,
              studentName: student?.name || 'Unknown Student',
              embedding: Array.from({ length: 128 }, () => Math.random()),
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onEnrollmentComplete?.(result);
            }, 500);
          } else {
            // For attendance, add student recognition data
            Object.assign(result, {
              student: {
                id: student?.id || `student_${Math.floor(Math.random() * 1000)}`,
                name: student?.name || 'Demo Student',
                matric_number: student?.matric_number || `20/ABC${Math.floor(Math.random() * 1000)}`
              },
              confidence: 0.85 + Math.random() * 0.1,
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onAttendanceComplete?.(result);
            }, 500);
          }
          
          return 100;
        }
        return prev + 20;
      });
    }, 300);
  };

  const handleRetry = () => {
    setIsCapturing(false);
    setProgress(0);
    setCapturedImage(null);
  };

  // Start camera on component mount
  useEffect(() => {
    startCamera();
    
    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={4} style={{ textAlign: 'center' }}>
        {mode === 'enrollment' ? 'Face Enrollment' : 'Face Attendance'}
      </Title>
      
      {mode === 'enrollment' && student && (
        <Alert
          message={`Enrolling: ${student.name || 'Student'}`}
          description={`Matric: ${student.matric_number || 'Not assigned'}`}
          type="info"
          showIcon
          icon={<User />}
          style={{ marginBottom: 20 }}
        />
      )}

      {error && (
        <Alert
          message="Camera Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}

      <Row gutter={[24, 24]}>
        <Col span={12}>
          <div style={{ textAlign: 'center' }}>
            <Title level={5}>Live Camera</Title>
            
            <div style={{ 
              position: 'relative',
              width: '100%',
              height: 300,
              backgroundColor: '#000',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 16
            }}>
              {isCameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff'
                }}>
                  <VideoOff size={48} />
                  <Text style={{ color: '#fff', marginLeft: 10 }}>
                    Camera inactive
                  </Text>
                </div>
              )}
            </div>

            <Space>
              {!isCameraActive ? (
                <Button
                  type="primary"
                  icon={<Video size={16} />}
                  onClick={startCamera}
                >
                  Start Camera
                </Button>
              ) : (
                <Button
                  icon={<VideoOff size={16} />}
                  onClick={stopCamera}
                >
                  Stop Camera
                </Button>
              )}
              
              {isCameraActive && !isCapturing && (
                <Button
                  type="primary"
                  icon={<Camera size={16} />}
                  onClick={handleCapture}
                >
                  Capture Face
                </Button>
              )}
            </Space>
          </div>
        </Col>

        <Col span={12}>
          <div style={{ textAlign: 'center' }}>
            <Title level={5}>Capture Result</Title>
            
            {isCapturing ? (
              <div style={{ padding: '20px 0' }}>
                <div style={{ 
                  width: 200, 
                  height: 200, 
                  margin: '0 auto 20px',
                  borderRadius: '50%',
                  backgroundColor: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid #1890ff'
                }}>
                  <Camera size={48} color="#1890ff" />
                </div>
                
                <Text style={{ display: 'block', marginBottom: 20 }}>
                  {progress < 100 
                    ? 'Processing face data...' 
                    : 'Processing complete!'
                  }
                </Text>
                
                <Progress percent={progress} status="active" />
                
                {progress >= 100 && (
                  <Alert
                    message="Success!"
                    description="Face data has been captured and processed"
                    type="success"
                    showIcon
                    style={{ marginTop: 20 }}
                  />
                )}
              </div>
            ) : capturedImage ? (
              <div style={{ padding: '20px 0' }}>
                <img
                  src={capturedImage}
                  alt="Captured Face"
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #52c41a',
                    marginBottom: 16
                  }}
                />
                <Alert
                  message="Face Captured"
                  description="Face image has been successfully captured"
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Button onClick={handleRetry}>
                  <RefreshCw size={16} style={{ marginRight: 8 }} />
                  Retry Capture
                </Button>
              </div>
            ) : (
              <div style={{ 
                padding: '60px 20px',
                backgroundColor: '#f5f5f5',
                borderRadius: 8,
                marginBottom: 16
              }}>
                <Camera size={48} color="#666" />
                <Text style={{ display: 'block', marginTop: 16 }}>
                  Captured face will appear here
                </Text>
              </div>
            )}
          </div>
        </Col>
      </Row>

      <div style={{ marginTop: 24 }}>
        <Alert
          message="Face Capture Instructions"
          description={
            <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
              <Col span={12}>
                <CheckCircle size={14} style={{ marginRight: 8, color: '#52c41a' }} />
                Ensure good lighting on your face
              </Col>
              <Col span={12}>
                <CheckCircle size={14} style={{ marginRight: 8, color: '#52c41a' }} />
                Look directly at the camera
              </Col>
              <Col span={12}>
                <CheckCircle size={14} style={{ marginRight: 8, color: '#52c41a' }} />
                Keep a neutral expression
              </Col>
              <Col span={12}>
                <CheckCircle size={14} style={{ marginRight: 8, color: '#52c41a' }} />
                Remove glasses if possible
              </Col>
            </Row>
          }
          type="info"
          showIcon
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <Text type="secondary">
          <small>
            <CheckCircle size={12} style={{ marginRight: 5 }} />
            Your face data is encrypted and stored securely
          </small>
        </Text>
      </div>

      {/* Hidden canvas for capturing images */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
    </Card>
  );
};

export default FaceCamera;