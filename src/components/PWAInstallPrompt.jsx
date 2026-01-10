// src/components/PWAInstallPrompt.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Typography, Space } from 'antd';
import { Download, Smartphone, X } from 'lucide-react';

const { Title, Text } = Typography;

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Check if already installed
      if (window.matchMedia('(display-mode: standalone)').matches || 
          window.navigator.standalone === true) {
        setIsInstalled(true);
      } else {
        // Show custom prompt after 30 seconds of engagement
        setTimeout(() => setIsVisible(true), 30000);
      }
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the PWA installation');
        setIsInstalled(true);
      }
      
      setDeferredPrompt(null);
      setIsVisible(false);
    } catch (error) {
      console.error('Installation failed:', error);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Store dismissal in localStorage to avoid showing too frequently
    localStorage.setItem('pwaPromptDismissed', new Date().toISOString());
  };

  // Don't show if installed or recently dismissed
  if (isInstalled || !isVisible) return null;

  return (
    <Modal
      open={isVisible}
      onCancel={handleDismiss}
      footer={null}
      closable={false}
      centered
      width={350}
      style={{ borderRadius: 12 }}
    >
      <div style={{ textAlign: 'center', padding: '20px 10px' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: '#1890ff20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto'
          }}>
            <Smartphone size={40} color="#1890ff" />
          </div>
          
          <Title level={4} style={{ margin: 0 }}>
            Install Nigeram Staff Face Auth
          </Title>
          
          <Text type="secondary">
            Install the app for faster access, offline capability, and better experience. Works like a native app!
          </Text>
          
          <Alert 
            message="Benefits"
            description="• Works offline • Quick home screen access • Push notifications • Better performance"
            type="info"
            showIcon
          />
          
          <Space style={{ width: '100%', justifyContent: 'center' }}>
            <Button 
              type="primary" 
              icon={<Download size={16} />}
              onClick={handleInstall}
              size="large"
            >
              Install Now
            </Button>
            <Button 
              onClick={handleDismiss}
              icon={<X size={16} />}
              size="large"
            >
              Later
            </Button>
          </Space>
          
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Tap "Add to Home Screen" when prompted by your browser
          </Text>
        </Space>
      </div>
    </Modal>
  );
};

export default PWAInstallPrompt;