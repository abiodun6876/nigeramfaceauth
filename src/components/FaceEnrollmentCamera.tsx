// src/components/FaceEnrollmentCamera.tsx - FIXED VERSION
import React, { useState, useRef, useEffect } from 'react';
import { Typography, Progress, message } from 'antd';
import { VideoOff, Camera, CheckCircle, Pause, Play } from 'lucide-react';

const { Text, Title } = Typography;

// In your FaceEnrollmentCamera.tsx component file
interface FaceEnrollmentCameraProps {
  staff: {
    id: string;
    name: string;
    staff_id: string;
    department: string;
  };
  onEnrollmentComplete: (result: any) => void;
  autoCapture?: boolean;           // Add this
  captureInterval?: number;        // Add this
  onFaceDetectionUpdate?: (status: any) => void;  // Add this
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
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
          console.log('Camera loaded, starting auto-scan');
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
    
    console.log('Starting auto-scan interval');
    captureIntervalRef.current = setInterval(() => {
      if (isCameraActive && !isCapturing) {
        console.log('Auto-scan triggering capture');
        handleCapture();
      }
    }, 3000); // Every 3 seconds
  };

  // Stop auto-scan
  const stopAutoScan = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    setAutoScanActive(false);
    console.log('Auto-scan stopped');
  };

  // Capture image
  const captureImage = (): string | null => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) {
      console.log('Cannot capture: camera not ready');
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.log('Cannot get canvas context');
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Mirror for selfie view
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    console.log('Image captured successfully');
    return imageData;
  };

  // Handle capture
  const handleCapture = () => {
    if (!isCameraActive || isCapturing) {
      console.log('Cannot capture: camera not active or already capturing');
      return;
    }
    
    console.log('Starting capture...');
    setIsCapturing(true);
    setCaptureCount(prev => prev + 1);
    
    // Clear any existing progress interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    // Capture image
    const imageData = captureImage();
    
    if (!imageData) {
      console.log('Capture failed, no image data');
      setLastResult({
        success: false,
        message: 'Capture failed'
      });
      setIsCapturing(false);
      return;
    }
    
    // Show progress animation
    setProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
          
          // Success result
          const result = {
            success: true,
            photoUrl: imageData,
            timestamp: new Date().toISOString(),
            staff: staff,
            captureCount: captureCount + 1
          };
          
          console.log('Capture complete, calling onEnrollmentComplete');
          
          // Show success message
          setLastResult({
            success: true,
            message: 'Face Captured Successfully!',
            temporary: true
          });
          
          // Call the parent callback after a short delay
          setTimeout(() => {
            console.log('Calling onEnrollmentComplete with result:', result);
            onEnrollmentComplete(result);
            setIsCapturing(false);
            
            // Clear success message after 1.5 seconds
            setTimeout(() => {
              setLastResult(null);
            }, 1500);
          }, 1000);
          
          return 100;
        }
        return prev + 20; // Faster progress (5 steps to 100)
      });
    }, 100);
  };

  // Manual capture button
  const handleManualCapture = () => {
    console.log('Manual capture triggered');
    if (!isCameraActive) {
      message.error('Camera not ready');
      return;
    }
    handleCapture();
  };

  // Toggle auto-scan
  const toggleAutoScan = () => {
    console.log('Toggling auto-scan, current state:', autoScanActive);
    if (autoScanActive) {
      stopAutoScan();
    } else {
      startAutoScan();
    }
  };

  // Initialize camera
  useEffect(() => {
    console.log('FaceEnrollmentCamera mounted, starting camera...');
    startCamera();
    
    return () => {
      console.log('FaceEnrollmentCamera unmounting, cleaning up...');
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
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
            backgroundColor: isCameraActive ? '#00ffaa' : '#ffaa00'
          }} />
          <Text style={{ fontSize: 12, color: '#aaccff' }}>
            {isCameraActive ? 'READY' : 'LOADING'}
          </Text>
        </div>
        
        <div style={{ 
          backgroundColor: autoScanActive 
            ? 'rgba(0, 255, 150, 0.1)' 
            : 'rgba(255, 170, 0, 0.1)',
          color: autoScanActive ? '#00ffaa' : '#ffaa00',
          padding: '4px 12px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 'bold'
        }}>
          {autoScanActive ? `AUTO-SCAN: ${captureCount}` : 'MANUAL MODE'}
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
                PROCESSING CAPTURE...
              </Text>
            </div>
          </div>
        )}
        
        {/* Success Message */}
        {lastResult && lastResult.success && lastResult.temporary && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            animation: 'fadeIn 0.5s'
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
            onClick={handleManualCapture}
            disabled={isCapturing || !isCameraActive}
            style={{
              backgroundColor: isCapturing || !isCameraActive 
                ? 'rgba(100, 100, 100, 0.5)' 
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
              minWidth: 150,
              justifyContent: 'center',
              transition: 'all 0.3s'
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
              justifyContent: 'center',
              transition: 'all 0.3s'
            }}
          >
            {autoScanActive ? <Pause size={18} /> : <Play size={18} />}
            {autoScanActive ? 'PAUSE AUTO' : 'START AUTO'}
          </button>
        </div>
        
        <Text style={{ 
          fontSize: 11, 
          color: '#aaccff',
          textAlign: 'center',
          fontStyle: 'italic'
        }}>
          {autoScanActive 
            ? 'Auto-scan active: Capturing every 3 seconds' 
            : 'Click "Capture Now" to manually capture'}
        </Text>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Add CSS animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
};

export default FaceEnrollmentCamera;