// src/components/FaceEnrollmentCamera.tsx - SIMPLIFIED MANUAL ONLY VERSION
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Typography, Progress } from 'antd';
import { VideoOff, Camera, CheckCircle } from 'lucide-react';

const { Text, Title } = Typography;

interface FaceEnrollmentCameraProps {
  staff?: {
    id: string;
    name: string;
    staff_id: string;
    department: string;
  };
  onEnrollmentComplete?: (result: any) => void;
  onFaceDetectionUpdate?: (status: any) => void;
}

const FaceEnrollmentCamera = forwardRef(({
  staff,
  onEnrollmentComplete,
  onFaceDetectionUpdate
}: FaceEnrollmentCameraProps, ref) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastResult, setLastResult] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    captureImage: async () => {
      console.log('Manual capture triggered via ref');
      return handleManualCapture();
    },
    startCamera: async () => {
      return startCamera();
    },
    stopCamera: () => {
      stopCamera();
    },
    isCameraActive: () => isCameraActive,
    isCapturing: () => isCapturing
  }));

  // Start camera
  const startCamera = async () => {
    setError(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported');
      return false;
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
        
        return new Promise<boolean>((resolve) => {
          videoRef.current!.onloadedmetadata = () => {
            setIsCameraActive(true);
            console.log('Camera loaded for enrollment');
            resolve(true);
          };
        });
      }
      
      return true;
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied');
      } else if (err.name === 'NotFoundError') {
        setError('Front camera not found');
      } else {
        setError('Camera error: ' + err.message);
      }
      return false;
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
  };

  // Handle manual capture
  const handleManualCapture = async () => {
    if (!isCameraActive) {
      console.log('Camera not active');
      return {
        success: false,
        message: 'Camera not active'
      };
    }
    
    console.log('Starting manual capture');
    setIsCapturing(true);
    
    // Capture image
    const imageData = captureImage();
    
    if (!imageData) {
      console.log('Capture failed, no image data');
      setLastResult({
        success: false,
        message: 'Capture failed'
      });
      setIsCapturing(false);
      return {
        success: false,
        message: 'Capture failed'
      };
    }

    // Show progress animation
    return new Promise((resolve) => {
      setProgress(0);
      progressIntervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
            }
            
            const result = {
              success: true,
              photoUrl: imageData,
              quality: 0.8,
              faceScore: 0.7,
              timestamp: new Date().toISOString(),
              staff: staff,
              captureCount: captureCount + 1
            };
            
            console.log('Manual capture complete');
            
            // Show success message
            setLastResult({
              success: true,
              message: 'Photo Captured!',
              temporary: true
            });
            
            // Update capture count
            setCaptureCount(prev => prev + 1);
            setIsCapturing(false);
            
            // Clear success message after 1.5 seconds
            setTimeout(() => {
              setLastResult(null);
            }, 1500);
            
            resolve(result);
            return 100;
          }
          return prev + 20;
        });
      }, 100);
    });
  };

  // Capture image helper
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

  // Initialize camera
  useEffect(() => {
    console.log('FaceEnrollmentCamera mounted, starting camera...');
    startCamera();
    
    return () => {
      console.log('FaceEnrollmentCamera unmounting, cleaning up...');
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
          backgroundColor: 'rgba(0, 150, 255, 0.1)',
          color: '#00aaff',
          padding: '4px 12px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 'bold'
        }}>
          MANUAL MODE
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
                CAPTURING PHOTO...
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
                Photo Captured!
              </Title>
              <Text style={{ 
                color: '#aaffaa', 
                fontSize: 12,
                marginTop: 4
              }}>
                Ready for enrollment
              </Text>
            </div>
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'rgba(0, 20, 40, 0.8)',
        borderTop: '1px solid rgba(0, 150, 255, 0.2)',
        textAlign: 'center'
      }}>
        <Text style={{ 
          fontSize: 11, 
          color: '#aaccff',
          fontStyle: 'italic'
        }}>
          Click "CAPTURE NOW" button in controls above
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
});

FaceEnrollmentCamera.displayName = 'FaceEnrollmentCamera';
export default FaceEnrollmentCamera;