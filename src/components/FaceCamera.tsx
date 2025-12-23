// src/components/FaceCamera.tsx - UPDATED VERSION
import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Alert, Typography, Space, Progress, Row, Col } from 'antd';
import { Camera, RefreshCw, CheckCircle, User, Video, VideoOff } from 'lucide-react';

const { Title, Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  student?: any;
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void;
  onCaptureStatus?: (status: any) => void; // NEW: Added this prop
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  student,
  onEnrollmentComplete,
  onAttendanceComplete,
  onCaptureStatus // NEW: Accept the prop
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Send status updates to parent
  const updateCaptureStatus = (statusUpdate: any) => {
    if (onCaptureStatus) {
      onCaptureStatus(statusUpdate);
    }
  };

  // Collect debug info
  useEffect(() => {
    const info = {
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      href: window.location.href,
      mediaDevices: !!navigator.mediaDevices,
      getUserMedia: !!navigator.mediaDevices?.getUserMedia,
      isLocalhost: ['localhost', '127.0.0.1'].includes(window.location.hostname),
      isHttps: window.location.protocol === 'https:',
      userAgent: navigator.userAgent
    };
    setDebugInfo(info);
    console.log('Debug Info:', info);
  }, []);

  // Test camera function - simpler approach
  const testCamera = async () => {
    console.log('Testing camera...');
    
    try {
      // First, list available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log('Available devices:', devices);
      
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('Video devices:', videoDevices);
      
      if (videoDevices.length === 0) {
        setError('No camera found on your device.');
        return false;
      }

      // Try to get camera stream
      const constraints = {
        video: {
          deviceId: videoDevices[0].deviceId ? { exact: videoDevices[0].deviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      console.log('Trying constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got stream:', stream);
      
      return stream;
    } catch (err: any) {
      console.error('Camera test failed:', err);
      setError(`Camera test failed: ${err.name} - ${err.message}`);
      return null;
    }
  };

  const startCamera = async () => {
    console.log('Starting camera...');
    setError(null);
    
    // Send status update
    updateCaptureStatus({ 
      isCapturing: false, 
      message: 'Starting camera...' 
    });
    
    // Check basic requirements
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Your browser does not support camera access. Try Chrome, Firefox, or Edge.');
      updateCaptureStatus({ 
        isCapturing: false, 
        message: 'Browser does not support camera access' 
      });
      return;
    }

    // Check if we're on a secure context
    const isSecure = window.location.protocol === 'https:' || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      setError(`Camera requires HTTPS or localhost. You are on: ${window.location.protocol}//${window.location.hostname}`);
      updateCaptureStatus({ 
        isCapturing: false, 
        message: 'HTTPS or localhost required' 
      });
      return;
    }

    try {
      // Try multiple constraint options
      const constraintsOptions = [
        { video: true, audio: false }, // Simple
        { video: { facingMode: 'user' }, audio: false }, // Front camera
        { video: { facingMode: 'environment' }, audio: false }, // Back camera
        { video: { width: 640, height: 480 }, audio: false } // Specific size
      ];

      let stream = null;
      let lastError = null;

      // Try each constraint until one works
      for (const constraints of constraintsOptions) {
        try {
          console.log('Trying constraints:', constraints);
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('Success with constraints:', constraints);
          break;
        } catch (err) {
          lastError = err;
          console.log('Failed with constraints:', constraints, err);
        }
      }

      if (!stream && lastError) {
        throw lastError;
      }

      if (!stream) {
        throw new Error('Could not access camera with any constraints');
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to load
        await new Promise((resolve) => {
          if (videoRef.current) {
            const onLoaded = () => {
              videoRef.current?.removeEventListener('loadedmetadata', onLoaded);
              resolve(true);
            };
            videoRef.current.addEventListener('loadedmetadata', onLoaded);
          } else {
            resolve(true);
          }
        });
        
        setIsCameraActive(true);
        console.log('Camera is now active');
        
        // Send status update
        updateCaptureStatus({ 
          isCapturing: false, 
          message: 'Camera is active. Make sure face is clearly visible.',
          cameraActive: true
        });
      }
      
    } catch (err: any) {
      console.error('Failed to start camera:', err);
      let errorMessage = 'Failed to access camera: ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera access was denied. Please:';
        errorMessage += '\n1. Click the camera icon in your address bar';
        errorMessage += '\n2. Select "Allow" for camera access';
        errorMessage += '\n3. Refresh the page and try again';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a webcam.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.';
      } else {
        errorMessage += err.message || 'Unknown error';
      }
      
      setError(errorMessage);
      setIsCameraActive(false);
      
      // Send status update
      updateCaptureStatus({ 
        isCapturing: false, 
        message: 'Camera failed to start',
        error: err.message
      });
    }
  };

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
    
    // Send status update
    updateCaptureStatus({ 
      isCapturing: false, 
      message: 'Camera stopped',
      cameraActive: false
    });
  };

  // Simple capture function
  const captureImage = () => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) {
      setError('Camera is not ready');
      updateCaptureStatus({ 
        isCapturing: false, 
        message: 'Camera not ready for capture' 
      });
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setError('Canvas context not available');
      updateCaptureStatus({ 
        isCapturing: false, 
        message: 'Canvas context error' 
      });
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleCapture = () => {
    if (!isCameraActive) {
      setError('Please start the camera first');
      updateCaptureStatus({ 
        isCapturing: false, 
        message: 'Start camera first' 
      });
      return;
    }

    // Send status update
    updateCaptureStatus({ 
      isCapturing: true, 
      message: 'Capturing face...' 
    });
    
    const image = captureImage();
    if (!image) {
      setError('Failed to capture image');
      updateCaptureStatus({ 
        isCapturing: false, 
        message: 'Capture failed' 
      });
      return;
    }

    setCapturedImage(image);
    processCapture(image);
  };

  const processCapture = (imageData: string) => {
    setIsCapturing(true);
    setProgress(0);

    // Send status update
    updateCaptureStatus({ 
      isCapturing: true, 
      message: 'Processing face capture...' 
    });

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          const result = {
            success: true,
            message: `${mode === 'enrollment' ? 'Enrollment' : 'Attendance'} successful!`,
            timestamp: new Date().toISOString(),
            photoUrl: imageData,
            quality: 0.9
          };

          if (mode === 'enrollment') {
            Object.assign(result, {
              studentId: student?.id,
              studentName: student?.name,
              embedding: []
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onEnrollmentComplete?.(result);
              
              // Send status update
              updateCaptureStatus({ 
                isCapturing: false, 
                message: 'Enrollment complete!',
                success: true
              });
            }, 1000);
          } else {
            Object.assign(result, {
              student: {
                id: student?.id,
                name: student?.name,
                matric_number: student?.matric_number
              },
              confidence: 0.95
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onAttendanceComplete?.(result);
              
              // Send status update
              updateCaptureStatus({ 
                isCapturing: false, 
                message: 'Attendance recorded!',
                success: true
              });
            }, 1000);
          }
          
          return 100;
        }
        return prev + 20;
      });
    }, 200);
  };

  // Fallback simulation
  const useSimulation = () => {
    setIsCapturing(true);
    setProgress(0);
    
    // Send status update
    updateCaptureStatus({ 
      isCapturing: true, 
      message: 'Starting simulation...' 
    });

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          const result = {
            success: true,
            message: 'Simulation mode - Face captured successfully',
            timestamp: new Date().toISOString(),
            photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${student?.matric_number || 'test'}`,
            quality: 0.85
          };

          if (mode === 'enrollment') {
            Object.assign(result, {
              studentId: student?.id,
              studentName: student?.name,
              embedding: []
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onEnrollmentComplete?.(result);
              
              // Send status update
              updateCaptureStatus({ 
                isCapturing: false, 
                message: 'Simulation: Enrollment complete',
                success: true
              });
            }, 500);
          } else {
            Object.assign(result, {
              student: {
                id: student?.id,
                name: student?.name,
                matric_number: student?.matric_number
              },
              confidence: 0.85
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onAttendanceComplete?.(result);
              
              // Send status update
              updateCaptureStatus({ 
                isCapturing: false, 
                message: 'Simulation: Attendance recorded',
                success: true
              });
            }, 500);
          }
          
          return 100;
        }
        return prev + 25;
      });
    }, 250);
  };

  // Auto-start camera on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      startCamera();
    }, 1000);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, []);

  return (
    <Card style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={4} style={{ textAlign: 'center', marginBottom: 20 }}>
        {mode === 'enrollment' ? 'Face Enrollment' : 'Face Attendance'}
      </Title>
      
      {student && (
        <Alert
          message={`${mode === 'enrollment' ? 'Enrolling' : 'Checking'}: ${student.name}`}
          description={`Matric: ${student.matric_number}`}
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}

      {/* Debug Info */}
      <Alert
        message="Environment Check"
        description={
          <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            <div>URL: {debugInfo.href}</div>
            <div>Protocol: {debugInfo.protocol} ({debugInfo.isHttps ? 'HTTPS ✓' : 'Not HTTPS ✗'})</div>
            <div>Hostname: {debugInfo.hostname} ({debugInfo.isLocalhost ? 'Localhost ✓' : 'Not localhost ✗'})</div>
            <div>MediaDevices: {debugInfo.mediaDevices ? 'Supported ✓' : 'Not supported ✗'}</div>
            <div>getUserMedia: {debugInfo.getUserMedia ? 'Available ✓' : 'Not available ✗'}</div>
            <div>Browser: {debugInfo.userAgent?.split(' ').slice(-2).join(' ')}</div>
          </div>
        }
        type={debugInfo.isHttps || debugInfo.isLocalhost ? "success" : "warning"}
        style={{ marginBottom: 20 }}
      />

      {error && (
        <Alert
          message="Error"
          description={
            <div>
              <p style={{ whiteSpace: 'pre-line' }}>{error}</p>
              <Button 
                type="link" 
                onClick={() => {
                  setError(null);
                  startCamera();
                }}
                style={{ padding: 0 }}
              >
                Click to retry camera access
              </Button>
            </div>
          }
          type="error"
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <div style={{ textAlign: 'center' }}>
            <Title level={5}>Camera Feed</Title>
            
            <div style={{ 
              width: '100%',
              height: 300,
              backgroundColor: '#000',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 16,
              border: isCameraActive ? '3px solid #52c41a' : '3px solid #d9d9d9'
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: isCameraActive ? 'block' : 'none'
                }}
              />
              {!isCameraActive && (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff'
                }}>
                  <VideoOff size={48} />
                  <Text style={{ color: '#fff', marginTop: 10 }}>
                    Camera Preview
                  </Text>
                  <Text type="secondary" style={{ color: '#aaa', fontSize: 12 }}>
                    {isCapturing ? 'Processing...' : 'Start camera to see preview'}
                  </Text>
                </div>
              )}
            </div>

            <Space wrap style={{ marginBottom: 10 }}>
              <Button
                type={isCameraActive ? "default" : "primary"}
                icon={isCameraActive ? <VideoOff size={16} /> : <Video size={16} />}
                onClick={isCameraActive ? stopCamera : startCamera}
                loading={isCapturing}
                disabled={isCapturing}
              >
                {isCameraActive ? 'Stop Camera' : 'Start Camera'}
              </Button>
              
              <Button
                type="primary"
                icon={<Camera size={16} />}
                onClick={handleCapture}
                disabled={!isCameraActive || isCapturing}
              >
                Capture Face
              </Button>
              
              <Button
                type="dashed"
                icon={<Camera size={16} />}
                onClick={useSimulation}
                disabled={isCapturing}
              >
                Use Simulation
              </Button>
              
              <Button
                icon={<RefreshCw size={16} />}
                onClick={() => {
                  stopCamera();
                  setTimeout(startCamera, 500);
                }}
              >
                Refresh
              </Button>
            </Space>
          </div>
        </Col>

        <Col xs={24} md={12}>
          <div style={{ textAlign: 'center' }}>
            <Title level={5}>Result</Title>
            
            {isCapturing ? (
              <div style={{ padding: '40px 20px' }}>
                <div style={{ 
                  width: 200, 
                  height: 200, 
                  margin: '0 auto 20px',
                  borderRadius: '50%',
                  backgroundColor: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px dashed #1890ff'
                }}>
                  {progress < 100 ? (
                    <Camera size={48} color="#1890ff" />
                  ) : (
                    <CheckCircle size={48} color="#52c41a" />
                  )}
                </div>
                
                <Text style={{ display: 'block', marginBottom: 20 }}>
                  {progress < 100 ? 'Processing...' : 'Complete!'}
                </Text>
                
                <Progress percent={progress} status={progress < 100 ? "active" : "success"} />
              </div>
            ) : capturedImage ? (
              <div style={{ padding: '20px 0' }}>
                <img
                  src={capturedImage}
                  alt="Captured"
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
                  message="Captured Successfully"
                  type="success"
                  showIcon
                />
              </div>
            ) : (
              <div style={{ 
                height: 340,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fafafa',
                borderRadius: 8,
                border: '1px dashed #d9d9d9'
              }}>
                <Camera size={48} color="#bfbfbf" />
                <Text type="secondary" style={{ marginTop: 16 }}>
                  {isCameraActive 
                    ? 'Click "Capture Face" to take photo' 
                    : 'Start camera to begin'}
                </Text>
              </div>
            )}
          </div>
        </Col>
      </Row>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Text type="secondary">
          <small>
            {isCameraActive 
              ? 'Camera is active. Make sure face is clearly visible.' 
              : 'Camera access required for face capture.'}
          </small>
        </Text>
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Card>
  );
};

export default FaceCamera;