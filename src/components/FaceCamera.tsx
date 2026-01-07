// src/components/FaceCamera.tsx - WITH FACE DETECTION
import React, { useState, useRef, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Alert, 
  Typography, 
  Space, 
  Progress, 
  Tag
} from 'antd';
import { Camera, CheckCircle, VideoOff } from 'lucide-react';

const { Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  student?: any;
  onEnrollmentComplete?: (result: any) => void;
  onAttendanceComplete?: (result: any) => void;
  autoCapture?: boolean;
  captureInterval?: number;
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  student,
  onEnrollmentComplete,
  onAttendanceComplete,
  autoCapture = true,
  captureInterval = 2000
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState<number>(0);
  const [captureCount, setCaptureCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const captureIntervalRef = useRef<number | null>(null);

  // Improved face detection using canvas analysis
  const checkForFace = () => {
    if (!videoRef.current || !isCameraActive || isCapturing) return;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.videoWidth === 0) return;
    
    // Set canvas to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Simple face detection based on skin tone
    let skinPixels = 0;
    let totalPixels = 0;
    
    // Sample every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Skin tone detection (simple heuristic)
      const isSkinTone = (
        r > 95 && g > 40 && b > 20 &&
        r > g && r > b &&
        Math.abs(r - g) > 15 &&
        r - g > 15
      );
      
      if (isSkinTone) {
        skinPixels++;
      }
      totalPixels++;
    }
    
    const skinPercentage = (skinPixels / totalPixels) * 100;
    const hasFace = skinPercentage > 15; // If more than 15% of pixels are skin tone
    
    setFaceDetected(hasFace);
    
    // Auto-capture if face detected
    if (hasFace && mode === 'attendance' && !isCapturing) {
      const now = Date.now();
      if (now - lastCaptureTime > captureInterval) {
        console.log('Face detected, triggering capture...');
        handleCapture();
      }
    }
  };

  // Start face detection interval
  const startFaceDetection = () => {
    if (detectionIntervalRef.current !== null) {
      window.clearInterval(detectionIntervalRef.current);
    }
    
    detectionIntervalRef.current = window.setInterval(() => {
      checkForFace();
    }, 1000); // Check every second
  };

  // Start camera
  const startCamera = async () => {
    console.log('Starting camera...');
    setError(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported');
      return;
    }

    const isSecure = window.location.protocol === 'https:' || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      setError('HTTPS or localhost required');
      return;
    }

    try {
      // Try different constraints
      const constraintsOptions = [
        { video: { width: 640, height: 480 } },
        { video: { facingMode: 'user' } },
        { video: { facingMode: 'environment' } },
        { video: true }
      ];

      let stream = null;
      
      for (const constraints of constraintsOptions) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ ...constraints, audio: false });
          break;
        } catch (err) {
          console.log('Failed with constraints:', constraints);
        }
      }

      if (!stream) {
        throw new Error('Could not access camera');
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve(true);
          } else {
            resolve(true);
          }
        });
        
        setIsCameraActive(true);
        startFaceDetection();
        
        console.log('Camera started successfully');
      }
      
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera access.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found.');
      } else {
        setError('Failed to start camera: ' + err.message);
      }
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
    setFaceDetected(false);
    
    if (detectionIntervalRef.current !== null) {
      window.clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (captureIntervalRef.current !== null) {
      window.clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  };

  // Capture image
  const captureImage = async (): Promise<string | null> => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) {
      console.error('Camera not ready for capture');
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Canvas context not available');
      return null;
    }

    console.log('Capturing image...');
    console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    console.log('Image captured, size:', imageData.length, 'bytes');
    
    return imageData;
  };

  // Handle capture
  const handleCapture = async () => {
    if (!isCameraActive || isCapturing) {
      console.log('Cannot capture: camera not active or already capturing');
      return;
    }
    
    console.log('Starting capture process...');
    setIsCapturing(true);
    setLastCaptureTime(Date.now());
    setCaptureCount(prev => prev + 1);
    
    try {
      const imageData = await captureImage();
      
      if (!imageData) {
        throw new Error('Failed to capture image');
      }

      console.log('Image captured successfully, processing...');
      
      // Process capture
      processCapture(imageData);
      
    } catch (error) {
      console.error('Capture error:', error);
      setIsCapturing(false);
    }
  };

  // Process capture
  const processCapture = (imageData: string) => {
    console.log('Processing capture...');
    setProgress(0);

    const interval = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          window.clearInterval(interval);
          
          console.log('Capture processing complete');
          
          const result = {
            success: true,
            photoUrl: imageData,
            timestamp: new Date().toISOString(),
            captureCount: captureCount
          };

          if (mode === 'enrollment') {
            Object.assign(result, {
              studentId: student?.id || student?.student_id || student?.matric_number,
              studentName: student?.name,
              matricNumber: student?.matric_number,
              student: student
            });
            
            setTimeout(() => {
              setIsCapturing(false);
              onEnrollmentComplete?.(result);
            }, 500);
          } else {
            setTimeout(() => {
              setIsCapturing(false);
              onAttendanceComplete?.(result);
              console.log('Attendance capture complete, sending to parent');
            }, 500);
          }
          
          return 100;
        }
        return prev + 25; // Faster progress
      });
    }, 100);
  };

  // Manual capture button for testing
  const manualCapture = () => {
    console.log('Manual capture triggered');
    handleCapture();
  };

  // Auto-start camera on mount for attendance
  useEffect(() => {
    if (mode === 'attendance') {
      const timer = setTimeout(() => {
        startCamera();
      }, 500);

      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    }
  }, [mode]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card style={{ margin: '0 auto' }} bodyStyle={{ padding: '16px' }}>
      {/* Camera Feed */}
      <div style={{ textAlign: 'center' }}>
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
            </div>
          )}
          
          {/* Status indicators */}
          {isCameraActive && (
            <div style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{ 
                width: 12, 
                height: 12, 
                borderRadius: '50%',
                backgroundColor: faceDetected ? '#52c41a' : '#faad14',
                animation: faceDetected ? 'pulse 1s infinite' : 'none'
              }} />
              <span style={{ 
                color: 'white', 
                fontSize: '12px',
                fontWeight: 'bold',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}>
                {faceDetected ? 'FACE DETECTED ✓' : 'WAITING FOR FACE'}
              </span>
            </div>
          )}

          {/* Manual capture indicator for debugging */}
          {mode === 'attendance' && isCameraActive && (
            <div style={{
              position: 'absolute',
              top: 10,
              left: 10,
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: '12px'
            }}>
              Auto-capture: {captureCount}
            </div>
          )}
        </div>

        {/* Status */}
        <div style={{ marginTop: 12 }}>
          <Space>
            <div style={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%',
              backgroundColor: isCameraActive ? '#52c41a' : '#ff4d4f'
            }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {isCameraActive ? 'CAMERA ACTIVE' : 'CAMERA OFF'}
            </Text>
            
            {isCapturing && (
              <>
                <div style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: '50%',
                  backgroundColor: '#1890ff',
                  animation: 'pulse 1s infinite'
                }} />
                <Text type="secondary" style={{ fontSize: '12px', color: '#1890ff' }}>
                  PROCESSING...
                </Text>
              </>
            )}
          </Space>
        </div>

        {/* Manual capture button for testing */}
        <div style={{ marginTop: 16 }}>
          <Button
            type="primary"
            icon={<Camera size={16} />}
            onClick={manualCapture}
            disabled={!isCameraActive || isCapturing}
            size="small"
          >
            Test Capture
          </Button>
        </div>
      </div>

      {/* Processing */}
      {isCapturing && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Progress 
            percent={progress} 
            status="active" 
            strokeColor={{ from: '#108ee9', to: '#87d068' }}
          />
          <Text type="secondary" style={{ marginTop: 8, fontSize: '12px' }}>
            Capturing face... ({progress}%)
          </Text>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Alert
            message="Camera Error"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Button
            type="primary"
            onClick={startCamera}
            size="small"
          >
            Retry Camera
          </Button>
        </div>
      )}

      {/* Debug info */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Space>
          <Tag color={isCameraActive ? "green" : "red"}>
            {isCameraActive ? 'Camera On' : 'Camera Off'}
          </Tag>
          <Tag color={faceDetected ? "green" : "orange"}>
            {faceDetected ? 'Face Detected' : 'No Face'}
          </Tag>
          <Tag color="blue">
            Captures: {captureCount}
          </Tag>
        </Space>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Card>
  );
};

export default FaceCamera;