// src/components/FaceEnrollmentCamera.tsx - UPDATED TO MATCH PROTOTYPE
import React, { useState, useRef, useEffect } from 'react';
import { Typography, Progress } from 'antd';
import { VideoOff, Camera, CheckCircle, XCircle, PauseCircle, PlayCircle } from 'lucide-react';

const { Text, Title } = Typography;

interface FaceEnrollmentCameraProps {
  staff: {
    id: string;
    name: string;
    staff_id: string;
    department: string;
  };
  onEnrollmentComplete: (result: any) => void;
  onCapture?: (photoUrl: string) => Promise<void>;
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
  const [autoScanActive, setAutoScanActive] = useState(true);
  const [lastResult, setLastResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
            if (autoScanActive) {
              startAutoScan();
            }
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

  // Auto-scan function
  const startAutoScan = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
    
    console.log('Starting auto-scan for enrollment');
    setAutoScanActive(true);
    
    captureIntervalRef.current = setInterval(() => {
      if (isCameraActive && !isCapturing && !isProcessing) {
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
    if (!isCameraActive || isCapturing || isProcessing) return;
    
    console.log('Enrollment capture initiated');
    setIsCapturing(true);
    setLastResult(null);
    
    try {
      // Increment scan count
      setCaptureCount(prev => prev + 1);
      
      // Capture image
      const imageData = await captureImage();
      
      if (!imageData) {
        throw new Error('Failed to capture image');
      }
      
      // Show processing animation
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
      
      // Process the capture after a short delay
      setTimeout(() => {
        try {
          console.log('Processing enrollment capture...');
          
          // Call the provided onCapture function if it exists
          if (onCapture) {
            onCapture(imageData);
          }
          
          // Create success result
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
          
          // Auto-complete after 2 seconds
          setTimeout(() => {
            onEnrollmentComplete(result);
            setIsCapturing(false);
            setProgress(0);
          }, 2000);
          
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
        }
      }, 1000);
      
    } catch (error: any) {
      console.error('Capture error:', error);
      setLastResult({
        success: false,
        message: 'Capture failed. Please try again.'
      });
      setIsCapturing(false);
      setProgress(0);
    }
  };

  // Manual capture button
  const handleManualCapture = () => {
    console.log('Manual capture triggered');
    handleCapture();
  };

  // Toggle auto-scan
  const toggleAutoScan = () => {
    if (autoScanActive) {
      stopAutoScan();
    } else {
      startAutoScan();
    }
  };

  // Stop camera
  const stopCamera = () => {
    console.log('Stopping enrollment camera');
    
    // Stop auto-scan
    stopAutoScan();
    
    // Clear timeouts
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
    }
    
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
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
      {/* Top Status Bar - Like prototype */}
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
            backgroundColor: '#00ffaa',
            boxShadow: '0 0 8px #00ffaa'
          }} />
          <Text style={{ fontSize: 12, color: '#aaccff', fontWeight: 'bold' }}>
            READY
          </Text>
        </div>
        
        <div style={{ 
          backgroundColor: 'rgba(0, 255, 150, 0.1)',
          color: '#00ffaa',
          padding: '4px 12px',
          borderRadius: 12,
          border: '1px solid rgba(0, 255, 150, 0.3)',
          fontSize: 12,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          AUTO-SCAN: {captureCount}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 12, color: '#aaccff' }}>
            {staff.name || 'STAFF NAME'}
          </Text>
          <div style={{
            backgroundColor: 'rgba(0, 150, 255, 0.2)',
            color: '#00aaff',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 'bold'
          }}>
            {staff.staff_id}
          </div>
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
              <VideoOff size={48} color="rgba(0, 150, 255, 0.7)" />
              <Text style={{ 
                color: 'rgba(0, 150, 255, 0.7)', 
                marginTop: 16,
                fontSize: 16,
                fontWeight: 'bold'
              }}>
                {error || 'Starting Camera...'}
              </Text>
            </div>
          )}
          
          {/* Face Position Guide - Centered like prototype */}
          {isCameraActive && !isCapturing && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '250px',
              height: '300px',
              border: '2px solid rgba(0, 255, 150, 0.6)',
              borderRadius: 12,
              pointerEvents: 'none',
              boxShadow: '0 0 40px rgba(0, 255, 150, 0.3)',
              zIndex: 5
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
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(10px)'
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
              zIndex: 10,
              backdropFilter: 'blur(5px)'
            }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 255, 150, 0.1)',
                border: '2px solid #00ffaa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                animation: 'pulse 1.5s infinite'
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: '#00ffaa',
                  boxShadow: '0 0 20px #00ffaa'
                }} />
              </div>
              
              <Progress 
                percent={progress} 
                status="active" 
                strokeColor={{
                  '0%': '#00aaff',
                  '100%': '#00ffaa',
                }}
                strokeWidth={3}
                showInfo={false}
                style={{ width: '80%', maxWidth: 300 }}
              />
              
              <Text style={{ 
                color: '#00ffaa', 
                fontSize: 16, 
                fontWeight: 'bold',
                marginTop: 16,
                textShadow: '0 0 10px rgba(0, 255, 150, 0.5)'
              }}>
                PROCESSING...
              </Text>
            </div>
          )}
          
          {/* Success/Error Message Overlay */}
          {lastResult && (
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
              pointerEvents: 'none'
            }}>
              <div style={{
                backgroundColor: lastResult.success 
                  ? 'rgba(0, 255, 150, 0.15)' 
                  : 'rgba(255, 50, 50, 0.15)',
                color: lastResult.success ? '#00ffaa' : '#ff3333',
                padding: '24px 32px',
                borderRadius: 16,
                border: lastResult.success 
                  ? '2px solid rgba(0, 255, 150, 0.5)' 
                  : '2px solid rgba(255, 50, 50, 0.5)',
                textAlign: 'center',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)',
                maxWidth: '80%'
              }}>
                {lastResult.success ? (
                  <>
                    <CheckCircle size={48} style={{ marginBottom: 16 }} />
                    <Title level={4} style={{ 
                      color: '#00ffaa', 
                      margin: 0,
                      fontSize: 20,
                      textShadow: '0 0 10px rgba(0, 255, 150, 0.5)'
                    }}>
                      Face Captured<br />Successfully!
                    </Title>
                  </>
                ) : (
                  <>
                    <XCircle size={48} style={{ marginBottom: 16 }} />
                    <Title level={4} style={{ 
                      color: '#ff3333', 
                      margin: 0,
                      fontSize: 20
                    }}>
                      {lastResult.message}
                    </Title>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Panel - Like prototype */}
      <div style={{
        padding: '16px',
        backgroundColor: 'rgba(0, 20, 40, 0.8)',
        borderTop: '1px solid rgba(0, 150, 255, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        {/* Action Buttons */}
        <div style={{
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
              padding: '14px 32px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 'bold',
              cursor: isCapturing || !isCameraActive ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 0.3s',
              minWidth: 180,
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(0, 150, 255, 0.3)'
            }}
          >
            <Camera size={20} />
            {isCapturing ? 'CAPTURING...' : 'CAPTURE NOW'}
          </button>
          
          <button
            onClick={toggleAutoScan}
            disabled={isCapturing}
            style={{
              backgroundColor: autoScanActive 
                ? 'rgba(255, 170, 0, 0.2)' 
                : 'rgba(0, 255, 150, 0.2)',
              color: autoScanActive ? '#ffaa00' : '#00ffaa',
              border: `2px solid ${autoScanActive ? '#ffaa00' : '#00ffaa'}`,
              padding: '14px 32px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 'bold',
              cursor: isCapturing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 0.3s',
              minWidth: 180,
              justifyContent: 'center',
              boxShadow: autoScanActive 
                ? '0 0 15px rgba(255, 170, 0, 0.3)' 
                : '0 0 15px rgba(0, 255, 150, 0.3)'
            }}
          >
            {autoScanActive ? (
              <>
                <PauseCircle size={20} />
                PAUSE AUTO-SCAN
              </>
            ) : (
              <>
                <PlayCircle size={20} />
                RESUME AUTO-SCAN
              </>
            )}
          </button>
        </div>

        {/* Status Info */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 24
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: 11, 
              color: '#aaccff',
              marginBottom: 2
            }}>
              AUTO-SCAN: {captureCount}
            </div>
            <div style={{ 
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: autoScanActive ? '#00ffaa' : '#ffaa00',
              margin: '0 auto',
              boxShadow: `0 0 8px ${autoScanActive ? '#00ffaa' : '#ffaa00'}`
            }} />
          </div>
          
          <div style={{ 
            fontSize: 11, 
            color: '#aaccff',
            fontStyle: 'italic',
            textAlign: 'center',
            maxWidth: 300
          }}>
            Position face in the frame for automatic capture
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* CSS Animations */}
      <style>
        {`
          @keyframes pulse {
            0% { 
              transform: scale(0.95);
              box-shadow: 0 0 0 0 rgba(0, 255, 150, 0.7);
            }
            70% { 
              transform: scale(1);
              box-shadow: 0 0 0 20px rgba(0, 255, 150, 0);
            }
            100% { 
              transform: scale(0.95);
              box-shadow: 0 0 0 0 rgba(0, 255, 150, 0);
            }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

export default FaceEnrollmentCamera;