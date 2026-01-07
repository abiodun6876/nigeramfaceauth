// src/components/FaceCamera.tsx - UPDATED WITH AUTO-CAPTURE
import React, { useState, useRef, useEffect } from 'react';
// Add Tag to the import statement at the top of FaceCamera.tsx
import { 
  Card, 
  Button, 
  Alert, 
  Typography, 
  Space, 
  Progress, 
  Row, 
  Col, 
  Switch,
  Tag  // Add this
} from 'antd';
import { Camera, RefreshCw, CheckCircle, User, Video, VideoOff, Zap } from 'lucide-react';

const { Title, Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  student?: any;
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void;
  onCaptureStatus?: (status: any) => void;
  autoCapture?: boolean;
  captureInterval?: number;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  student,
  onEnrollmentComplete,
  onAttendanceComplete,
  onCaptureStatus,
  autoCapture = false,
  captureInterval = 2000 // 2 seconds default
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [faceDetected, setFaceDetected] = useState(false);
  const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState(autoCapture);
  const [lastCaptureTime, setLastCaptureTime] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);
const streamRef = useRef<MediaStream | null>(null);
const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  

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

  // Simple face detection (placeholder - you can integrate real face detection here)
  const checkForFace = () => {
    if (!videoRef.current || !isCameraActive || isCapturing) return false;
    

    
    const video = videoRef.current;
    const now = Date.now();
    
    // Simple check: if video is playing and has dimensions
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      setFaceDetected(true);
      
      // Auto-capture logic for attendance mode
      if (isAutoCaptureEnabled && mode === 'attendance' && !isCapturing) {
        const timeSinceLastCapture = now - lastCaptureTime;
        if (timeSinceLastCapture > captureInterval) {
          console.log('Auto-capture triggered');
          handleCapture();
          return true;
        }
      }
      return true;
    }
    
    setFaceDetected(false);
    return false;
  };

  // Test camera function
  const testCamera = async () => {
    console.log('Testing camera...');
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        setError('No camera found on your device.');
        return false;
      }

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


// Start face detection interval
const startFaceDetection = () => {
  if (detectionIntervalRef.current !== null) {
    clearInterval(detectionIntervalRef.current);
    detectionIntervalRef.current = null;
  }
  
  detectionIntervalRef.current = setInterval(() => {
    checkForFace();
  }, 500) as NodeJS.Timeout; // Check every 500ms
};

// Stop face detection
const stopFaceDetection = () => {
  if (detectionIntervalRef.current !== null) {
    clearInterval(detectionIntervalRef.current);
    detectionIntervalRef.current = null;
  }
  setFaceDetected(false);
};

  const startCamera = async () => {
    console.log('Starting camera...');
    setError(null);
    
    updateCaptureStatus({ 
      isCapturing: false, 
      message: 'Starting camera...' 
    });
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Your browser does not support camera access. Try Chrome, Firefox, or Edge.');
      updateCaptureStatus({ 
        isCapturing: false, 
        message: 'Browser does not support camera access' 
      });
      return;
    }

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
      const constraintsOptions = [
        { video: true, audio: false },
        { video: { facingMode: 'user' }, audio: false },
        { video: { facingMode: 'environment' }, audio: false },
        { video: { width: 640, height: 480 }, audio: false }
      ];

      let stream = null;
      let lastError = null;

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
        
        // Start face detection
        startFaceDetection();
        startAutoCaptureInterval();
        
        updateCaptureStatus({ 
          isCapturing: false, 
          message: isAutoCaptureEnabled ? 'Auto-scan active - Face detection running' : 'Camera is active',
          cameraActive: true,
          autoCapture: isAutoCaptureEnabled
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
    stopFaceDetection();
    
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
    
    updateCaptureStatus({ 
      isCapturing: false, 
      message: 'Camera stopped',
      cameraActive: false
    });
  };

  // Typed capture function
  const captureAndProcessImage = async (): Promise<{
    base64: string;
    blob?: Blob;
    width: number;
    height: number;
    format: string;
    size?: number;
  } | null> => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) {
      setError('Camera is not ready');
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setError('Canvas context not available');
      return null;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Capture as base64
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    
    // Also capture as blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve({
          base64: imageData,
          blob: blob || undefined,
          width: canvas.width,
          height: canvas.height,
          format: 'image/jpeg',
          size: blob ? blob.size : imageData.length
        });
      }, 'image/jpeg', 0.9);
    });
  };

  // SINGLE handleCapture function
  const handleCapture = async () => {
    if (!isCameraActive) {
      setError('Please start the camera first');
      updateCaptureStatus({ 
        isCapturing: false, 
        message: 'Start camera first' 
      });
      return;
    }

    setIsCapturing(true);
    setError(null);
    setLastCaptureTime(Date.now());
    
    updateCaptureStatus({ 
      isCapturing: true, 
      message: 'Capturing face...' 
    });

    try {
      const imageResult = await captureAndProcessImage();
      
      if (!imageResult) {
        throw new Error('Failed to capture image');
      }

      // Access base64 property safely
      setCapturedImage(imageResult.base64);
      
      // Process with the image data
      processCapture(imageResult.base64);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Capture failed: ${errorMessage}`);
      setIsCapturing(false);
      
      updateCaptureStatus({ 
        isCapturing: false, 
        message: `Capture failed: ${errorMessage}` 
      });
    }
  };

  // Updated processCapture function
  const processCapture = (imageData: string) => {
    setProgress(0);

    updateCaptureStatus({ 
      isCapturing: true, 
      message: 'Processing face capture...' 
    });

    const interval = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          // Create complete result object
          const result = {
            success: true,
            message: `${mode === 'enrollment' ? 'Enrollment' : 'Attendance'} successful!`,
            timestamp: new Date().toISOString(),
            photoUrl: imageData,
            photoData: {
              base64: imageData,
              width: canvasRef.current?.width || 640,
              height: canvasRef.current?.height || 480,
              format: 'image/jpeg'
            },
            quality: 0.9
          };

          if (mode === 'enrollment') {
            // Include all student data
            Object.assign(result, {
              studentId: student?.id || student?.student_id || student?.matric_number,
              studentName: student?.name,
              matricNumber: student?.matric_number,
              student: student,
              studentData: student,
              embedding: []
            });
            
            console.log('Enrollment result to send:', result);
            console.log('Student data available:', student);
            
            setTimeout(() => {
              setIsCapturing(false);
              onEnrollmentComplete?.(result);
              
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

  // Single useSimulation function
  const useSimulation = () => {
    setIsCapturing(true);
    setProgress(0);
    
    updateCaptureStatus({ 
      isCapturing: true, 
      message: 'Starting simulation...' 
    });

    const interval = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          const result = {
            success: true,
            message: 'Simulation mode - Face captured successfully',
            timestamp: new Date().toISOString(),
            photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${student?.matric_number || 'test'}`,
            photoData: {
              base64: `data:image/svg+xml;base64,...`,
              width: 400,
              height: 400,
              format: 'svg'
            },
            quality: 0.85
          };

          if (mode === 'enrollment') {
            // Include all student data in simulation
            Object.assign(result, {
              studentId: student?.id || student?.student_id || student?.matric_number,
              studentName: student?.name,
              matricNumber: student?.matric_number,
              student: student,
              studentData: student,
              embedding: []
            });
            
            console.log('Simulation enrollment result:', result);
            
            setTimeout(() => {
              setIsCapturing(false);
              onEnrollmentComplete?.(result);
              
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

 // ... other code

const startAutoCaptureInterval = () => {
  if (captureIntervalRef.current !== null) {
    clearInterval(captureIntervalRef.current);
    captureIntervalRef.current = null;
  }
  
  if (isAutoCaptureEnabled && mode === 'attendance') {
    captureIntervalRef.current = setInterval(() => {
      if (faceDetected && !isCapturing) {
        const now = Date.now();
        if (now - lastCaptureTime > captureInterval) {
          console.log('Auto-capture interval triggered');
          handleCapture();
        }
      }
    }, 1000) as NodeJS.Timeout; // Check every second
  }
};

// Toggle auto-capture
const toggleAutoCapture = (checked: boolean) => {
  setIsAutoCaptureEnabled(checked);
  
  if (checked) {
    startAutoCaptureInterval();
    updateCaptureStatus({ 
      isCapturing: false, 
      message: 'Auto-scan enabled',
      autoCapture: true
    });
  } else {
    if (captureIntervalRef.current !== null) {
      window.clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    updateCaptureStatus({ 
      isCapturing: false, 
      message: 'Auto-scan disabled',
      autoCapture: false
    });
  }
};

// Auto-start camera on mount
useEffect(() => {
  const timer = setTimeout(() => {
    startCamera();
  }, 1000);

  return () => {
    clearTimeout(timer);
    stopCamera();
    if (detectionIntervalRef.current !== null) {
      window.clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (captureIntervalRef.current !== null) {
      window.clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  };
}, []);

// Update auto-capture when prop changes
useEffect(() => {
  setIsAutoCaptureEnabled(autoCapture);
  if (isCameraActive) {
    startAutoCaptureInterval();
  }
}, [autoCapture, captureInterval]);

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

      {/* Auto-capture control (only for attendance mode) */}
      {mode === 'attendance' && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16,
          padding: '12px 16px',
          backgroundColor: isAutoCaptureEnabled ? '#f6ffed' : '#fafafa',
          borderRadius: 8,
          border: `1px solid ${isAutoCaptureEnabled ? '#b7eb8f' : '#d9d9d9'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color={isAutoCaptureEnabled ? '#52c41a' : '#bfbfbf'} />
            <Text strong>Auto-scan Mode</Text>
            {isAutoCaptureEnabled && (
              <Tag color="green" style={{ marginLeft: 8 }}>ACTIVE</Tag>
            )}
          </div>
          <Switch
            checked={isAutoCaptureEnabled}
            onChange={toggleAutoCapture}
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
        </div>
      )}

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
              border: isCameraActive ? '3px solid #52c41a' : '3px solid #d9d9d9',
              position: 'relative'
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
              
              {/* Face detection indicator */}
              {isCameraActive && (
                <div style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  backgroundColor: faceDetected ? 'rgba(82, 196, 26, 0.8)' : 'rgba(250, 173, 20, 0.8)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {faceDetected ? '✓ FACE DETECTED' : 'SEARCHING FOR FACE'}
                </div>
              )}
              
              {/* Auto-capture indicator */}
              {isAutoCaptureEnabled && mode === 'attendance' && (
                <div style={{
                  position: 'absolute',
                  bottom: 10,
                  right: 10,
                  backgroundColor: 'rgba(24, 144, 255, 0.8)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <Zap size={12} />
                  AUTO-SCAN
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
            
            {/* Status info */}
            <div style={{ marginTop: 12 }}>
              <Space>
                <div style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: '50%',
                  backgroundColor: isCameraActive ? '#52c41a' : '#ff4d4f'
                }} />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {isCameraActive ? 'Camera Active' : 'Camera Off'}
                </Text>
                
                {isAutoCaptureEnabled && mode === 'attendance' && (
                  <>
                    <div style={{ 
                      width: 10, 
                      height: 10, 
                      borderRadius: '50%',
                      backgroundColor: faceDetected ? '#52c41a' : '#faad14',
                      animation: faceDetected ? 'pulse 1s infinite' : 'none'
                    }} />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {faceDetected ? 'Ready to scan' : 'Scanning for faces...'}
                    </Text>
                  </>
                )}
              </Space>
            </div>
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
                    ? isAutoCaptureEnabled && mode === 'attendance'
                      ? 'Position face in camera for auto-scan'
                      : 'Click "Capture Face" to take photo'
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
              ? isAutoCaptureEnabled && mode === 'attendance'
                ? 'Auto-scan active. Camera will automatically capture when face is detected.'
                : 'Camera is active. Make sure face is clearly visible.'
              : 'Camera access required for face capture.'}
          </small>
        </Text>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Card>
  );
};

export default FaceCamera;