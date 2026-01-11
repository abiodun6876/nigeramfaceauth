// src/components/FaceEnrollmentCamera.tsx - FIXED VERSION
import React, { useState, useRef, useEffect } from 'react';
import { Typography, Progress } from 'antd';
import { VideoOff, Camera, CheckCircle, Pause, Play } from 'lucide-react';

const { Text, Title } = Typography;

interface FaceEnrollmentCameraProps {
  staff: {
    id: string;
    name: string;
    staff_id: string;
    department: string;
  };
  onEnrollmentComplete: (result: any) => void;
}

const FaceEnrollmentCamera: React.FC<FaceEnrollmentCameraProps> = ({
  staff,
  onEnrollmentComplete
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [autoScanActive, setAutoScanActive] = useState(true);
  const [lastResult, setLastResult] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start camera
  const startCamera = async () => {
    setError(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported');
      return;
    }

    try {
      const constraints = { 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }, 
        audio: false 
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          setIsCameraActive(true);
          if (autoScanActive) {
            startAutoScan();
          }
        };
      }
      
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied');
      } else if (err.name === 'NotFoundError') {
        setError('Front camera not found');
      } else {
        setError('Camera error: ' + err.message);
      }
    }
  };

  // Auto-scan
  const startAutoScan = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
    
    setAutoScanActive(true);
    
    captureIntervalRef.current = setInterval(() => {
      if (isCameraActive && !isCapturing) {
        handleCapture();
      }
    }, 3000);
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
  const captureImage = (): string | null => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Mirror for selfie view
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  // Handle capture
  const handleCapture = () => {
    if (!isCameraActive || isCapturing) return;
    
    setIsCapturing(true);
    setCaptureCount(prev => prev + 1);
    
    // Capture image
    const imageData = captureImage();
    
    if (!imageData) {
      setLastResult({
        success: false,
        message: 'Capture failed'
      });
      setIsCapturing(false);
      return;
    }
    
    // Show progress
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          // Success result
          const result = {
            success: true,
            photoUrl: imageData,
            timestamp: new Date().toISOString(),
            staff: staff,
            captureCount: captureCount + 1
          };
          
          // Show success message
          setLastResult({
            success: true,
            message: 'Face Captured Successfully!',
            temporary: true
          });
          
          // Complete enrollment after 1.5 seconds
          setTimeout(() => {
            setIsCapturing(false);
            onEnrollmentComplete(result);
          }, 1500);
          
          return 100;
        }
        return prev + 25;
      });
    }, 100);
  };

  // Toggle auto-scan
  const toggleAutoScan = () => {
    if (autoScanActive) {
      stopAutoScan();
    } else {
      startAutoScan();
    }
  };

  // Initialize camera
  useEffect(() => {
    startCamera();
    
    return () => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#0a1a35',
      borderRadius: 8,
      overflow: 'hidden'
    }}>
      {/* Top Bar */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'rgba(0, 20, 40, 0.8)',
        borderBottom: '1px solid rgba(0, 150, 255, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#00ffaa'
          }} />
          <Text style={{ fontSize: 12, color: '#aaccff' }}>
            READY
          </Text>
        </div>
        
        <div style={{ 
          backgroundColor: 'rgba(0, 255, 150, 0.1)',
          color: '#00ffaa',
          padding: '4px 12px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 'bold'
        }}>
          AUTO-SCAN: {captureCount}
        </div>
      </div>

      {/* Camera Area */}
      <div style={{
        flex: 1,
        position: 'relative',
        backgroundColor: '#000000'
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
            transform: 'scaleX(-1)'
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
            <VideoOff size={48} color="rgba(0, 150, 255, 0.7)" />
            <Text style={{ 
              color: 'rgba(0, 150, 255, 0.7)', 
              marginTop: 16
            }}>
              {error || 'Starting Camera...'}
            </Text>
          </div>
        )}
        
        {/* Face Guide */}
        {isCameraActive && !isCapturing && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '200px',
            height: '250px',
            border: '2px solid rgba(0, 255, 150, 0.5)',
            borderRadius: 12,
            pointerEvents: 'none'
          }}>
            <div style={{
              position: 'absolute',
              bottom: -30,
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#00ffaa',
              fontSize: 12,
              fontWeight: 'bold',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: '4px 12px',
              borderRadius: 8
            }}>
              POSITION FACE HERE
            </div>
          </div>
        )}
        
        {/* Processing Overlay */}
        {isCapturing && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}>
            <div style={{ width: '80%', maxWidth: 300 }}>
              <Progress 
                percent={progress} 
                status="active" 
                strokeColor={{ from: '#00aaff', to: '#00ffaa' }}
                showInfo={false}
              />
              <Text style={{ 
                color: '#00ffaa', 
                textAlign: 'center',
                marginTop: 8,
                fontWeight: 'bold'
              }}>
                PROCESSING...
              </Text>
            </div>
          </div>
        )}
        
        {/* Success Message */}
        {lastResult && lastResult.success && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20
          }}>
            <div style={{
              backgroundColor: 'rgba(0, 255, 150, 0.15)',
              color: '#00ffaa',
              padding: '20px',
              borderRadius: 12,
              border: '1px solid rgba(0, 255, 150, 0.5)',
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
              maxWidth: '80%'
            }}>
              <CheckCircle size={40} style={{ marginBottom: 12 }} />
              <Title level={4} style={{ 
                color: '#00ffaa', 
                margin: 0,
                fontSize: 18
              }}>
                Face Captured<br />Successfully!
              </Title>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        padding: '16px',
        backgroundColor: 'rgba(0, 20, 40, 0.8)',
        borderTop: '1px solid rgba(0, 150, 255, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          marginBottom: 12
        }}>
          <button
            onClick={handleCapture}
            disabled={isCapturing || !isCameraActive}
            style={{
              backgroundColor: 'rgba(0, 150, 255, 0.8)',
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
              minWidth: 150,
              justifyContent: 'center'
            }}
          >
            <Camera size={18} />
            {isCapturing ? 'CAPTURING...' : 'CAPTURE NOW'}
          </button>
          
          <button
            onClick={toggleAutoScan}
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
              minWidth: 150,
              justifyContent: 'center'
            }}
          >
            {autoScanActive ? <Pause size={18} /> : <Play size={18} />}
            {autoScanActive ? 'PAUSE AUTO-SCAN' : 'RESUME AUTO-SCAN'}
          </button>
        </div>
        
        <Text style={{ 
          fontSize: 11, 
          color: '#aaccff',
          textAlign: 'center',
          fontStyle: 'italic'
        }}>
          Position face in the frame for automatic capture
        </Text>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default FaceEnrollmentCamera;