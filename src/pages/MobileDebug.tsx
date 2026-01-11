// src/pages/MobileDebug.tsx
import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Alert } from 'antd';
import { Smartphone, Camera, Wifi, Shield } from 'lucide-react';

const { Title, Text } = Typography;

const MobileDebugPage: React.FC = () => {
  const [browserInfo, setBrowserInfo] = useState<any>({});
  const [cameraStatus, setCameraStatus] = useState<string>('Checking...');
  const [modelsStatus, setModelsStatus] = useState<string>('Checking...');

  useEffect(() => {
    checkBrowserCapabilities();
    checkCamera();
  }, []);

  const checkBrowserCapabilities = () => {
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent),
      isAndroid: /Android/i.test(navigator.userAgent),
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      isSecure: window.location.protocol === 'https:',
      hostname: window.location.hostname
    };
    
    setBrowserInfo(info);
    console.log('Browser Info:', info);
  };

  const checkCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStatus('Not supported');
        return;
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        setCameraStatus('No camera found');
      } else {
        setCameraStatus(`Found ${videoDevices.length} camera(s)`);
      }
    } catch (error) {
      setCameraStatus('Error checking camera');
    }
  };

  const testCamera = async () => {
    try {
      setCameraStatus('Testing...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      
      // Stop the stream immediately
      stream.getTracks().forEach(track => track.stop());
      
      setCameraStatus('Working!');
      
    } catch (error: any) {
      setCameraStatus(`Failed: ${error.message}`);
    }
  };

  const testModels = async () => {
    try {
      setModelsStatus('Loading...');
      // You'll need to import your faceRecognition here
      // const result = await faceRecognition.loadModels();
      setModelsStatus('Loaded successfully');
    } catch (error: any) {
      setModelsStatus(`Failed: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        <Smartphone style={{ marginRight: 8 }} />
        Mobile Device Check
      </Title>

      <Alert
        message="Important for Mobile"
        description="Face recognition requires HTTPS and camera permissions. Make sure you've granted camera access."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card title="Browser Information">
          <pre style={{ 
            backgroundColor: '#f5f5f5', 
            padding: 12, 
            borderRadius: 6,
            fontSize: 12,
            overflowX: 'auto'
          }}>
            {JSON.stringify(browserInfo, null, 2)}
          </pre>
          
          {!browserInfo.isSecure && (
            <Alert
              message="Warning: Not Secure"
              description="Face recognition requires HTTPS. You're on HTTP."
              type="warning"
              style={{ marginTop: 16 }}
            />
          )}
        </Card>

        <Card 
          title={
            <Space>
              <Camera size={16} />
              Camera Status
            </Space>
          }
        >
          <Text>{cameraStatus}</Text>
          <div style={{ marginTop: 16 }}>
            <Button onClick={testCamera}>
              Test Camera
            </Button>
          </div>
        </Card>

        <Card title="Requirements Checklist">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text>HTTPS Connection</Text>
              <Text type={browserInfo.isSecure ? "success" : "danger"}>
                {browserInfo.isSecure ? "✓" : "✗"}
              </Text>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text>Camera API Available</Text>
              <Text type={browserInfo.hasGetUserMedia ? "success" : "danger"}>
                {browserInfo.hasGetUserMedia ? "✓" : "✗"}
              </Text>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text>Mobile Device</Text>
              <Text type={browserInfo.isMobile ? "success" : "warning"}>
                {browserInfo.isMobile ? "✓" : "Desktop"}
              </Text>
            </div>
          </Space>
        </Card>

        <Card title="Troubleshooting">
          <Space direction="vertical">
            <Text strong>If camera doesn't work:</Text>
            <Text>1. Check browser permissions (camera access)</Text>
            <Text>2. Make sure you're on HTTPS</Text>
            <Text>3. Try Chrome or Safari (best support)</Text>
            <Text>4. Clear browser cache and retry</Text>
            
            <Text strong style={{ marginTop: 16 }}>If face recognition doesn't work:</Text>
            <Text>1. Check console for errors</Text>
            <Text>2. Ensure good lighting on face</Text>
            <Text>3. Hold device steady</Text>
            <Text>4. Make sure face is clearly visible</Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default MobileDebugPage;