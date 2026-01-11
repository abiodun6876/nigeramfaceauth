// src/components/FaceEnrollmentCamera.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Typography, Progress, Alert } from 'antd';
import { VideoOff, Camera, CheckCircle, XCircle } from 'lucide-react';

const { Text, Title } = Typography;

interface FaceEnrollmentCameraProps {
  staff: {
    id: string;
    name: string;
    staff_id: string;
    department: string;
  };
  onEnrollmentComplete: (result: any) => void;
  onCapture: (photoUrl: string) => Promise<void>;
}

const FaceEnrollmentCamera: React.FC<FaceEnrollmentCameraProps> = ({
  staff,
  onEnrollmentComplete,
  onCapture
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastResult, setLastResult] = useState<any>(null);
  const [autoScanActive, setAutoScanActive] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start camera - Enrollment specific
  const startCamera = async () => {
    console.log('Starting enrollment camera');
    setError(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported');
      return;
    }

    try {
      // Front camera for enrollment
      const constraints = { 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }, 
        audio: false 
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          console.log('Camera loaded successfully');
          setIsCameraActive(true);
          
          // Start auto-scan after camera is ready
          setTimeout(() => {
            startAutoScan();
          }, 1000);
        };
        
        videoRef.current.play().catch(err => {
          console.error('Video play error:', err);
          setError('Failed to start camera feed');
        });
      }
      
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please check permissions.');
      } else if (err.name === 'NotFoundError') {
        setError('Front camera not found.');
      } else {
        setError('Failed to start camera: ' + err.message);
      }
    }
  };

  // Auto-scan function (similar to reference image)
  const startAutoScan = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
    
    console.log('Starting auto-scan for enrollment');
    setAutoScanActive(true);
    
    captureIntervalRef.current = setInterval(() => {
      if (isCameraActive && !isCapturing) {
        console.log('Auto-scan trigger');
        handleCapture();
      }
    }, 3000); // Every 3 seconds as per reference
  };

  // Stop auto-scan
  const stopAutoScan = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    setAutoScanActive(false);
  };

  // Capture image
  const captureImage = async (): Promise<string | null> => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) {
      console.log('Cannot capture: camera not active');
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;

    // Set canvas to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw mirrored (for selfie view)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // Handle capture
  const handleCapture = async () => {
    if (!isCameraActive || isCapturing) return;
    
    console.log('Enrollment capture initiated');
    setIsCapturing(true);
    setLastResult(null);
    
    try {
      // Simulate scan count like reference
      setCaptureCount(prev => prev + 1);
      
      // Capture image
      const imageData = await captureImage();
      
      if (!imageData) {
        throw new Error('Failed to capture image');
      }
      
      // Show processing
      setProgress(0);
      const processInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(processInterval);
            return 100;
          }
          return prev + 20;
        });
      }, 100);
      
      // Process the capture
      setTimeout(async () => {
        try {
          console.log('Processing enrollment capture...');
          
          // Call the provided onCapture function
          await onCapture(imageData);
          
          // Create success result
          const result = {
            success: true,
            photoUrl: imageData,
            timestamp: new Date().toISOString(),
            staff: staff,
            captureCount: captureCount + 1
          };
          
          setLastResult(result);
          
          // Complete enrollment
          setTimeout(() => {
            onEnrollmentComplete(result);
            setIsCapturing(false);
            setProgress(0);
            
            // Clear success message after 2 seconds
            setTimeout(() => {
              setLastResult(null);
            }, 2000);
          }, 500);
          
        } catch (error: any) {
          console.error('Processing error:', error);
          
          const errorResult = {
            success: false,
            message: error.message || 'Processing failed',
            timestamp: new Date().toISOString()
          };
          
          setLastResult(errorResult);
          setIsCapturing(false);
          setProgress(0);
          
          // Clear error after 3 seconds
          setTimeout(() => {
            setLastResult(null);
          }, 3000);
        }
      }, 1500);
      
    } catch (error: any) {
      console.error('Capture error:', error);
      setIsCapturing(false);
      setProgress(0);
    }
  };

  // Manual capture button
  const handleManualCapture = () => {
    console.log('Manual capture triggered');
    handleCapture();
  };

  // Stop camera
  const stopCamera = () => {
    console.log('Stopping enrollment camera');
    
    // Stop auto-scan
    stopAutoScan();
    
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCameraActive(false);
  };

  // Initialize camera on mount
  useEffect(() => {
    console.log('Initializing enrollment camera for:', staff);
    
    const timer = setTimeout(() => {
      startCamera();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a1a35',
      borderRadius: 12,
      overflow: 'hidden'
    }}>
      {/* Header - Like reference image */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: 'rgba(0, 26, 53, 0.8)',
        borderBottom: '1px solid rgba(0, 150, 255, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <Title level={4} style={{ color: '#ffffff', margin: 0 }}>
            {staff.name}
          </Title>
          <Text style={{ color: '#aaccff', fontSize: 12 }}>
            ID: {staff.staff_id} | {staff.department}
          </Text>
        </div>
        
        <div style={{
          backgroundColor: autoScanActive 
            ? 'rgba(0, 255, 150, 0.1)' 
            : 'rgba(255, 170, 0, 0.1)',
          color: autoScanActive ? '#00ffaa' : '#ffaa00',
          padding: '8px 16px',
          borderRadius: 8,
          border: `1px solid ${autoScanActive ? '#00ffaa' : '#ffaa00'}`,
          fontSize: 14,
          fontWeight: 'bold'
        }}>
          AUTO-SCAN: {captureCount}
        </div>
      </div>

      {/* Main Camera Area */}
      <div style={{
        flex: 1,
        position: 'relative',
        backgroundColor: '#000000'
      }}>
        {/* Video Feed */}
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden'
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
              display: isCameraActive ? 'block' : 'none',
              transform: 'scaleX(-1)' // Mirror for selfie view
            }}
          />
          
          {/* Camera Off State */}
          {!isCameraActive && (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              backgroundColor: '#0a1a35'
            }}>
              <VideoOff size={64} color="rgba(0, 150, 255, 0.7)" />
              <Text style={{ 
                color: 'rgba(0, 150, 255, 0.7)', 
                marginTop: 16,
                fontSize: 18,
                fontWeight: 'bold'
              }}>
                {error || 'Starting Enrollment Camera...'}
              </Text>
            </div>
          )}
          
          {/* Face Position Guide - Like reference */}
          {isCameraActive && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '280px',
              height: '320px',
              border: '2px solid rgba(0, 255, 150, 0.6)',
              borderRadius: 12,
              pointerEvents: 'none',
              boxShadow: '0 0 40px rgba(0, 255, 150, 0.3)'
            }}>
              <div style={{
                position: 'absolute',
                bottom: -40,
                left: '50%',
                transform: 'translateX(-50%)',
                color: '#00ffaa',
                fontSize: 14,
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: '8px 20px',
                borderRadius: 20,
                whiteSpace: 'nowrap'
              }}>
                Position Face Here
              </div>
            </div>
          )}
          
          {/* Status Overlay */}
          {isCameraActive && (
            <div style={{
              position: 'absolute',
              top: 20,
              left: 20,
              right: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {/* System Status */}
              <div style={{
                backgroundColor: 'rgba(0, 26, 53, 0.8)',
                color: '#00aaff',
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid rgba(0, 150, 255, 0.3)',
                fontSize: 12,
                fontWeight: 'bold'
              }}>
                SYSTEM: {isCapturing ? 'PROCESSING...' : 'READY'}
              </div>
              
              {/* Enrollment Status */}
              <div style={{
                backgroundColor: 'rgba(0, 26, 53, 0.8)',
                color: isCapturing ? '#00aaff' : '#00ffaa',
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${isCapturing ? 'rgba(0, 150, 255, 0.3)' : 'rgba(0, 255, 150, 0.3)'}`,
                fontSize: 12,
                fontWeight: 'bold'
              }}>
                ENROLLMENT
              </div>
            </div>
          )}
          
          {/* Processing Bar */}
          {isCapturing && (
            <div style={{
              position: 'absolute',
              bottom: 40,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '80%',
              maxWidth: 400
            }}>
              <Progress 
                percent={progress} 
                status="active" 
                strokeColor={{ from: '#00aaff', to: '#00ffaa' }}
                strokeWidth={3}
                showInfo={false}
              />
              <Text style={{ 
                color: '#00ffaa', 
                fontSize: 14, 
                textAlign: 'center',
                display: 'block',
                marginTop: 8,
                fontWeight: 'bold'
              }}>
                PROCESSING...
              </Text>
            </div>
          )}
          
          {/* Capture Result Messages */}
          {lastResult && (
            <div style={{
              position: 'absolute',
              bottom: 100,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '90%',
              maxWidth: 400,
              zIndex: 1000
            }}>
              <div style={{
                backgroundColor: lastResult.success 
                  ? 'rgba(0, 255, 150, 0.15)' 
                  : 'rgba(255, 50, 50, 0.15)',
                color: lastResult.success ? '#00ffaa' : '#ff3333',
                padding: '16px 24px',
                borderRadius: 12,
                border: lastResult.success 
                  ? '1px solid rgba(0, 255, 150, 0.5)' 
                  : '1px solid rgba(255, 50, 50, 0.5)',
                textAlign: 'center',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 0 30px rgba(0, 0, 0, 0.4)'
              }}>
                {lastResult.success ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <CheckCircle size={24} />
                    <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
                      Face Captured Successfully!
                    </Text>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <XCircle size={24} />
                    <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
                      {lastResult.message}
                    </Text>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer with Instructions */}
      <div style={{
        padding: '16px',
        backgroundColor: 'rgba(0, 26, 53, 0.8)',
        borderTop: '1px solid rgba(0, 150, 255, 0.3)'
      }}>
        <Alert
          message="Enrollment Instructions"
          description="Position face in the frame. The camera will automatically capture and process facial data every 3 seconds."
          type="info"
          showIcon
          style={{ 
            backgroundColor: 'transparent',
            border: '1px solid rgba(0, 150, 255, 0.3)'
          }}
        />
        
        <div style={{ 
          marginTop: 16,
          display: 'flex',
          justifyContent: 'center',
          gap: 16
        }}>
          <button
            onClick={handleManualCapture}
            disabled={isCapturing || !isCameraActive}
            style={{
              backgroundColor: isCapturing 
                ? 'rgba(0, 150, 255, 0.3)' 
                : 'rgba(0, 150, 255, 0.8)',
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 'bold',
              cursor: isCapturing || !isCameraActive ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.3s'
            }}
          >
            <Camera size={18} />
            {isCapturing ? 'CAPTURING...' : 'CAPTURE NOW'}
          </button>
          
          <button
            onClick={autoScanActive ? stopAutoScan : startAutoScan}
            style={{
              backgroundColor: autoScanActive 
                ? 'rgba(255, 170, 0, 0.2)' 
                : 'rgba(0, 255, 150, 0.2)',
              color: autoScanActive ? '#ffaa00' : '#00ffaa',
              border: `1px solid ${autoScanActive ? '#ffaa00' : '#00ffaa'}`,
              padding: '12px 24px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.3s'
            }}
          >
            {autoScanActive ? 'PAUSE AUTO-SCAN' : 'RESUME AUTO-SCAN'}
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default FaceEnrollmentCamera;