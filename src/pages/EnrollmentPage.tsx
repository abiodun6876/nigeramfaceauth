// src/pages/EnrollmentPage.tsx - FIXED VERSION
import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Select, 
  Button, 
  Typography, 
  Space,
  Alert,
  message,
  Row,
  Col,
  Steps,
  Tag,
  Spin,
  Badge
} from 'antd';
import { Camera, User, Briefcase, CheckCircle, Users, ArrowLeft, Clock, XCircle } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import { compressImage } from '../utils/imageUtils';
import faceRecognition from '../utils/faceRecognition';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const EnrollmentPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [staffData, setStaffData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [departmentForm] = Form.useForm();
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [staffId, setStaffId] = useState<string>('');
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastCaptureResult, setLastCaptureResult] = useState<any>(null);
  
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Nigeram specific departments
  const departments = [
    { value: 'studio', label: 'Studio', color: '#00aaff' },
    { value: 'logistics', label: 'Logistics', color: '#00ffaa' },
    { value: 'bakery', label: 'Bakery', color: '#ffaa00' },
    { value: 'spa', label: 'Spa', color: '#9b59b6' },
  ];

  // Generate staff ID
  const generateStaffId = () => {
    const prefix = 'NIG';
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const currentYear = new Date().getFullYear().toString().slice(-2);
    return `${prefix}${currentYear}${randomNum}`;
  };

  // Generate employee ID when component mounts
  useEffect(() => {
    const newStaffId = generateStaffId();
    setStaffId(newStaffId);
    form.setFieldValue('staff_id', newStaffId);
    
    // Load face models
    const loadModels = async () => {
      try {
        await faceRecognition.loadModels();
        setFaceModelsLoaded(true);
      } catch (error) {
        console.log('Face models loading...');
      }
    };
    loadModels();

    return () => {
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
      }
    };
  }, [form]);

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields();
        const values = form.getFieldsValue();
        
        if (!values.staff_id?.trim()) {
          const newStaffId = generateStaffId();
          values.staff_id = newStaffId;
          setStaffId(newStaffId);
          form.setFieldValue('staff_id', newStaffId);
        }

        console.log('Proceeding with values:', values);
        setStaffData(values);
        setCurrentStep(1);
      } else if (currentStep === 1) {
        await departmentForm.validateFields();
        const departmentValues = await departmentForm.getFieldsValue();
        setStaffData((prev: any) => ({ ...prev, ...departmentValues }));
        
        // Move to camera step and auto-start camera
        setCurrentStep(2);
        
        // Short delay to ensure UI updates
        setTimeout(() => {
          setIsCameraActive(true);
        }, 100);
      }
    } catch (error: any) {
      console.error('Error in handleNext:', error);
      const errorMessages = error.errorFields?.map((f: any) => f.errors.join(', ')).join('; ');
      message.error(errorMessages || 'Please fix form errors');
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setIsCameraActive(false);
    }
    setCurrentStep(currentStep - 1);
  };

  const handleRegenerateStaffId = () => {
    const newStaffId = generateStaffId();
    setStaffId(newStaffId);
    form.setFieldValue('staff_id', newStaffId);
    message.success('New staff ID generated');
  };

  const dataURLtoBlob = (dataURL: string): Blob => {
    try {
      const arr = dataURL.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      const u8arr = new Uint8Array(bstr.length);
      
      for (let i = 0; i < bstr.length; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      
      return new Blob([u8arr], { type: mime });
    } catch (error) {
      console.error('Error converting dataURL to blob:', error);
      throw error;
    }
  };

  // Handle face capture from camera - SIMPLIFIED like AttendancePage
  const handleFaceCapture = async (result: any) => {
    if (!result.success || !result.photoUrl || isProcessing) return;
    
    setIsProcessing(true);
    setCaptureCount(prev => prev + 1);
    
    try {
      console.log('=== FACE CAPTURE TRIGGERED ===');
      console.log('Staff Data:', staffData);
      
      // Set temporary success message
      setLastCaptureResult({
        success: true,
        message: 'Processing face data...',
        temporary: true
      });
      
      // Process the enrollment
      await processEnrollment(result);
      
    } catch (error: any) {
      console.error('Face capture error:', error);
      setLastCaptureResult({
        success: false,
        message: `Capture failed: ${error.message}`,
        temporary: false
      });
      message.error(`Capture failed: ${error.message}`);
      
      // Clear error after 2 seconds
      setTimeout(() => {
        setLastCaptureResult(null);
      }, 2000);
    } finally {
      setIsProcessing(false);
      // Clear temporary message after 1.5 seconds
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
      }
      captureTimeoutRef.current = setTimeout(() => {
        setLastCaptureResult(prev => prev?.temporary ? null : prev);
      }, 1500);
    }
  };

  // Process enrollment
  const processEnrollment = async (result: any) => {
    try {
      setLoading(true);

      const currentStaffId = staffData.staff_id || staffId;
      const staffName = staffData.name || 'Unknown Staff';
      const staffDepartment = staffData.department;
      const staffGender = staffData.gender || 'male';
      
      console.log('Processing enrollment for:', {
        staffId: currentStaffId,
        staffName,
        staffDepartment,
        staffGender
      });

      if (!currentStaffId || !staffName || !staffDepartment) {
        throw new Error('Missing staff information');
      }

      // Compress the image
      const compressedImage = await compressImage(result.photoUrl, 640, 0.8);
      
      // Generate filename
      const fileName = `enrollment_${Date.now()}_${staffName.replace(/\s+/g, '_')}.jpg`;
      
      let photoUrl = '';
      let photoData = compressedImage;
      
      // Upload to Supabase Storage if possible
      try {
        const { error: storageError } = await supabase.storage
          .from('staff-photos')
          .upload(fileName, dataURLtoBlob(compressedImage), {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (!storageError) {
          const { data: publicUrlData } = supabase.storage
            .from('staff-photos')
            .getPublicUrl(fileName);
          
          photoUrl = publicUrlData.publicUrl;
          console.log('✅ Photo uploaded to storage:', photoUrl);
        }
      } catch (storageError) {
        console.warn('Storage upload skipped:', storageError);
      }
      
      const currentDate = new Date();
      
      // Extract face embedding
      console.log('Extracting face embedding...');
      let embeddingArray = null;
      let embeddingError = null;

      try {
        const descriptor = await faceRecognition.extractFaceDescriptor(compressedImage);
        
        if (descriptor) {
          embeddingArray = Array.from(descriptor);
          console.log('✅ Face embedding extracted, length:', embeddingArray.length);
          
          // Save to local storage
          faceRecognition.saveEmbeddingToLocal(currentStaffId, descriptor);
        } else {
          embeddingError = new Error('No face detected in image');
        }
      } catch (err: any) {
        console.error('❌ Could not extract face embedding:', err);
        embeddingError = err;
      }

      // If embedding failed, save as pending
      if (!embeddingArray) {
        throw new Error(`Face embedding extraction failed: ${embeddingError?.message || 'No face detected'}.`);
      }

      // Prepare staff data
      const staffRecord = {
        staff_id: currentStaffId,
        name: staffName,
        gender: staffGender,
        department: staffDepartment,
        employment_date: currentDate.toISOString().split('T')[0],
        employment_status: 'active',
        enrollment_status: 'enrolled',
        photo_url: photoUrl || null,
        face_embedding: embeddingArray,
        face_enrolled_at: currentDate.toISOString(),
        is_active: true,
        created_at: currentDate.toISOString(),
        updated_at: currentDate.toISOString()
      };
      
      // Save to database
      const { data: existingStaff } = await supabase
        .from('staff')
        .select('staff_id, id')
        .eq('staff_id', currentStaffId)
        .maybeSingle();
      
      let dbResult;
      
      if (!existingStaff) {
        // Insert new staff
        const { data: insertData, error: insertError } = await supabase
          .from('staff')
          .insert([staffRecord])
          .select();
        
        if (insertError) throw insertError;
        dbResult = insertData;
      } else {
        // Update existing staff
        const { data: updateData, error: updateError } = await supabase
          .from('staff')
          .update(staffRecord)
          .eq('staff_id', currentStaffId)
          .select();
        
        if (updateError) throw updateError;
        dbResult = updateData;
      }
      
      // Save to local storage as backup
      try {
        const key = `face_image_${currentStaffId}`;
        localStorage.setItem(key, photoData);
        console.log('✅ Image saved to localStorage');
      } catch (localError) {
        console.warn('⚠️ Local storage save failed:', localError);
      }
      
      // Get department color
      const deptInfo = departments.find(d => d.value === staffDepartment);
      
      // Set enrollment result
      setEnrollmentResult({
        success: true,
        message: 'Staff enrollment completed successfully!',
        staff: {
          name: staffName,
          staff_id: currentStaffId,
        },
        department: staffDepartment,
        departmentColor: deptInfo?.color,
        faceCaptured: true,
        localStorageSaved: true,
        photoUrl: photoUrl || photoData,
        databaseSaved: true,
        faceEmbeddingSaved: true,
        embeddingLength: embeddingArray.length
      });
      
      setEnrollmentComplete(true);
      setIsCameraActive(false);
      message.success(`Enrollment complete for ${staffName}!`);
      
    } catch (error: any) {
      console.error('❌ Enrollment error:', error);
      
      // Fallback save
      try {
        const fallbackData = {
          staff_id: staffData.staff_id || staffId,
          name: staffData.name,
          department: staffData.department,
          gender: staffData.gender || 'male',
          employment_status: 'pending',
          enrollment_status: 'pending',
          is_active: true
        };
        
        await supabase
          .from('staff')
          .upsert([fallbackData], { onConflict: 'staff_id' });
          
        console.log('✅ Fallback save successful');
        
        setEnrollmentResult({
          success: false,
          message: 'Enrollment failed: Could not extract face embedding. Staff saved as "pending".',
          staff: {
            name: staffData.name,
            staff_id: staffData.staff_id || staffId,
          },
          department: staffData.department,
          faceCaptured: true,
          databaseSaved: true,
          faceEmbeddingSaved: false,
          status: 'pending'
        });
        
        setEnrollmentComplete(true);
        setIsCameraActive(false);
        message.warning('Enrollment incomplete. Face embedding extraction failed.');
        
      } catch (fallbackError) {
        console.error('❌ Fallback save failed:', fallbackError);
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  const stepItems = [
    {
      title: 'Basic Information',
      icon: <User />,
      content: (
        <div>
          <Alert
            message="Staff Information"
            description="Fill in the staff's basic details. Staff ID will be auto-generated."
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          <Form
            form={form}
            layout="vertical"
            style={{ maxWidth: 600, margin: '0 auto' }}
            initialValues={{ gender: 'male' }}
          >
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Full Name *"
                  name="name"
                  rules={[
                    { required: true, message: 'Please enter staff name', whitespace: true },
                    { min: 3, message: 'Name must be at least 3 characters' }
                  ]}
                  validateTrigger={['onChange', 'onBlur']}
                >
                  <Input placeholder="Enter staff full name" size="large" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item label="Staff ID *" name="staff_id">
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Input
                      value={staffId}
                      readOnly
                      size="large"
                      style={{ 
                        flex: 1,
                        textTransform: 'uppercase',
                        backgroundColor: '#fafafa',
                        cursor: 'not-allowed'
                      }}
                      prefix={<Users size={16} />}
                    />
                    <Button type="default" size="large" onClick={handleRegenerateStaffId}>
                      Regenerate
                    </Button>
                  </div>
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    Staff ID is auto-generated. Click "Regenerate" for a new ID.
                  </Text>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item label="Gender" name="gender">
                  <Select placeholder="Select gender" size="large">
                    <Select.Option value="male">Male</Select.Option>
                    <Select.Option value="female">Female</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      ),
    },
    {
      title: 'Department',
      icon: <Briefcase />,
      content: (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Alert
            message="Department Assignment"
            description="Select the staff's department for attendance tracking"
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          <Form form={departmentForm} layout="vertical">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item 
                  label="Department *" 
                  name="department"
                  rules={[{ required: true, message: 'Please select department' }]}
                >
                  <Select 
                    placeholder="Select department" 
                    size="large"
                    options={departments.map(dept => ({
                      value: dept.value,
                      label: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: dept.color
                          }} />
                          <span>{dept.label}</span>
                        </div>
                      ),
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ marginTop: 30 }}>
              <Alert
                type="info"
                message="Nigeram Departments"
                description={
                  <div style={{ marginTop: '8px' }}>
                    <Row gutter={[8, 8]}>
                      {departments.map(dept => (
                        <Col span={12} key={dept.value}>
                          <Tag color={dept.color} style={{ width: '100%', textAlign: 'center' }}>
                            {dept.label}
                          </Tag>
                        </Col>
                      ))}
                    </Row>
                  </div>
                }
              />
            </div>
          </Form>
        </div>
      ),
    },
    {
      title: 'Face Enrollment',
      icon: <Camera />,
      content: enrollmentComplete ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          {enrollmentResult?.success ? (
            <>
              <CheckCircle size={64} color="#52c41a" />
              <Title level={3} style={{ marginTop: 20 }}>
                Enrollment Complete!
              </Title>
              
              <Card style={{ maxWidth: 500, margin: '20px auto', textAlign: 'left' }}>
                <Title level={4}>Staff Summary</Title>
                <p><strong>Name:</strong> {enrollmentResult.staff?.name}</p>
                <p><strong>Staff ID:</strong> 
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {enrollmentResult.staff?.staff_id}
                  </Tag>
                </p>
                <p><strong>Department:</strong> 
                  <Tag 
                    color="blue" 
                    style={{ 
                      marginLeft: 8,
                      backgroundColor: enrollmentResult.departmentColor || '#1890ff',
                      color: 'white'
                    }}
                  >
                    {enrollmentResult.department?.toUpperCase()}
                  </Tag>
                </p>
                <p><strong>Status:</strong> <Tag color="success">Enrolled</Tag></p>
                <p><strong>Face Data:</strong> 
                  <Tag color={enrollmentResult?.faceCaptured ? "green" : "orange"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.faceCaptured ? 'Photo Captured' : 'No Photo'}
                  </Tag>
                </p>
                <p><strong>Face Embedding:</strong> 
                  <Tag color={enrollmentResult?.faceEmbeddingSaved ? "green" : "orange"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.faceEmbeddingSaved ? `Extracted ✓` : 'Not Extracted'}
                  </Tag>
                </p>
                <p><strong>Enrollment Date:</strong> {new Date().toLocaleDateString()}</p>
                
                {enrollmentResult.photoUrl && (
                  <div style={{ marginTop: 20, textAlign: 'center' }}>
                    <p><strong>Captured Photo:</strong></p>
                    <img 
                      src={enrollmentResult.photoUrl} 
                      alt="Staff" 
                      style={{ 
                        maxWidth: '150px', 
                        borderRadius: '8px',
                        border: '2px solid #52c41a'
                      }} 
                    />
                  </div>
                )}
              </Card>
            </>
          ) : (
            <>
              <div style={{ color: '#ff4d4f', marginBottom: 20 }}>
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="30" stroke="#ff4d4f" strokeWidth="2"/>
                  <path d="M22 22L42 42M42 22L22 42" stroke="#ff4d4f" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              </div>
              <Title level={3} style={{ marginTop: 20 }}>
                {enrollmentResult?.status === 'pending' ? 'Enrollment Incomplete' : 'Enrollment Failed'}
              </Title>
              <Alert
                message={enrollmentResult?.status === 'pending' ? 'Partial Success' : 'Error'}
                description={enrollmentResult?.message || 'Unknown error occurred'}
                type={enrollmentResult?.status === 'pending' ? 'warning' : 'error'}
                showIcon
                style={{ maxWidth: 500, margin: '20px auto' }}
              />
              {enrollmentResult?.status === 'pending' && (
                <Alert
                  message="Next Steps"
                  description="The staff was saved but needs face embedding. You can retry face enrollment from the staff management page."
                  type="info"
                  showIcon
                  style={{ maxWidth: 500, margin: '20px auto' }}
                />
              )}
            </>
          )}
          
          <Space style={{ marginTop: 30 }}>
            <Button
              type="primary"
              size="large"
              onClick={() => {
                const newStaffId = generateStaffId();
                setStaffId(newStaffId);
                form.setFieldValue('staff_id', newStaffId);
                
                setCurrentStep(0);
                setEnrollmentComplete(false);
                setEnrollmentResult(null);
                setIsCameraActive(false);
                setCaptureCount(0);
                setLastCaptureResult(null);
                
                form.resetFields();
                departmentForm.resetFields();
                setStaffData({});
                
                form.setFieldsValue({
                  gender: 'male',
                  staff_id: newStaffId
                });
              }}
            >
              {enrollmentResult?.success ? 'Enroll Another Staff' : 'Try Again'}
            </Button>
            {enrollmentResult?.success && (
              <>
                <Button 
                  size="large"
                  onClick={() => window.location.href = '/'}
                >
                  Back to Home
                </Button>
                <Button 
                  size="large"
                  type="primary"
                  onClick={() => window.location.href = '/attendance'}
                >
                  Take Attendance
                </Button>
              </>
            )}
          </Space>
        </div>
      ) : (
        <div style={{ 
          height: 'calc(100vh - 250px)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{ 
            padding: '16px',
            backgroundColor: '#0a1a35',
            color: '#ffffff',
            borderRadius: 12,
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong style={{ color: '#00aaff', fontSize: 16 }}>
                  {staffData.name || 'Staff Name'}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Tag color="blue">{staffId}</Tag>
                  {staffData.department && (
                    <Tag 
                      color="blue" 
                      style={{ 
                        backgroundColor: departments.find(d => d.value === staffData.department)?.color || '#1890ff',
                        color: 'white'
                      }}
                    >
                      {staffData.department?.toUpperCase()}
                    </Tag>
                  )}
                </div>
              </div>
              
              <Button
                icon={<ArrowLeft size={16} />}
                onClick={handleBack}
                style={{
                  backgroundColor: 'rgba(0, 150, 255, 0.2)',
                  border: '1px solid rgba(0, 150, 255, 0.5)',
                  color: '#00aaff'
                }}
              >
                Back
              </Button>
            </div>
          </div>
          
          {/* Camera Section - UPDATED to match AttendancePage */}
          <div style={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#0a1a35',
            borderRadius: 12,
            overflow: 'hidden'
          }}>
            {/* Status Bar */}
            <div style={{ 
              padding: '12px 16px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%',
                  backgroundColor: faceModelsLoaded ? '#00ffaa' : '#ffaa00',
                  boxShadow: faceModelsLoaded ? '0 0 8px #00ffaa' : '0 0 8px #ffaa00'
                }} />
                <Text style={{ fontSize: 12, color: '#aaccff' }}>
                  {faceModelsLoaded ? 'READY' : 'LOADING'}
                </Text>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Badge 
                  count={captureCount} 
                  style={{ 
                    backgroundColor: '#00aaff',
                    color: '#ffffff'
                  }} 
                />
                <Text style={{ fontSize: 12, color: '#aaccff' }}>
                  <Clock size={10} style={{ marginRight: 4 }} />
                  {dayjs().format('HH:mm')}
                </Text>
              </div>
            </div>
            
            {/* Camera Feed - Full screen like AttendancePage */}
            <div style={{ 
              flex: 1,
              minHeight: 0,
              position: 'relative'
            }}>
              {isCameraActive && (
                <div style={{ 
                  height: '100%',
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: '2px solid rgba(0, 150, 255, 0.3)',
                  boxShadow: '0 0 30px rgba(0, 150, 255, 0.2)'
                }}>
                  <FaceCamera
                    mode="enrollment"
                    staff={{
                      id: staffData.staff_id || staffId,
                      name: staffData.name,
                      staff_id: staffData.staff_id || staffId,
                      department: staffData.department
                    }}
                    onEnrollmentComplete={handleFaceCapture}
                    autoCapture={true}
                    captureInterval={3000}
                  />
                </div>
              )}
              
              {/* Processing Overlay */}
              {isProcessing && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 100
                }}>
                  <Spin size="large" tip="Processing face data..." />
                </div>
              )}
              
              {/* Last Capture Result - Like AttendancePage */}
              {lastCaptureResult && (
                <div style={{
                  position: 'absolute',
                  bottom: 80,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  zIndex: 100
                }}>
                  <div style={{
                    display: 'inline-block',
                    backgroundColor: lastCaptureResult.success 
                      ? 'rgba(0, 255, 150, 0.15)' 
                      : 'rgba(255, 50, 50, 0.15)',
                    color: lastCaptureResult.success ? '#00ffaa' : '#ff3333',
                    padding: '12px 24px',
                    borderRadius: 12,
                    border: lastCaptureResult.success 
                      ? '1px solid rgba(0, 255, 150, 0.5)' 
                      : '1px solid rgba(255, 50, 50, 0.5)',
                    fontSize: 16,
                    fontWeight: 600,
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)'
                  }}>
                    {lastCaptureResult.success ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle size={20} />
                        <span>{lastCaptureResult.message}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <XCircle size={20} />
                        <span>{lastCaptureResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Scan Status Overlay */}
              {isProcessing && (
                <div style={{
                  position: 'absolute',
                  bottom: 20,
                  left: 0,
                  right: 0,
                  textAlign: 'center'
                }}>
                  <div style={{
                    display: 'inline-block',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: '#00ffaa',
                    padding: '8px 20px',
                    borderRadius: 20,
                    fontSize: 14,
                    fontWeight: 600,
                    backdropFilter: 'blur(10px)'
                  }}>
                    SCANNING...
                  </div>
                </div>
              )}
            </div>
            
            {/* Instructions */}
            <div style={{ 
              padding: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderTop: '1px solid rgba(0, 150, 255, 0.2)'
            }}>
              <Alert
                message="Instructions"
                description="Position face in the frame. The camera will automatically capture and process facial data every 3 seconds."
                type="info"
                showIcon
                style={{ 
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(0, 150, 255, 0.3)'
                }}
              />
            </div>
          </div>
        </div>
      ),
    },
  ];

  // Force camera to start when on step 2
  useEffect(() => {
    if (currentStep === 2 && !isCameraActive) {
      console.log('Auto-starting camera for enrollment');
      setIsCameraActive(true);
    }
  }, [currentStep, isCameraActive]);

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a1a35',
      padding: '12px',
      color: '#ffffff'
    }}>
      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <Title level={2} style={{ color: '#ffffff', marginBottom: 4 }}>
            Staff Face Enrollment
          </Title>
          <Text type="secondary" style={{ color: '#aaccff' }}>
            Nigeram Ventures - Biometric Staff Enrollment System
          </Text>
        </div>

        <Card style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <Steps 
            current={currentStep} 
            style={{ marginBottom: 24 }}
            items={stepItems.map((item, index) => ({
              key: index,
              title: window.innerWidth < 768 ? '' : item.title,
              icon: item.icon,
            }))}
          />

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {stepItems[currentStep].content}
          </div>

          {!enrollmentComplete && currentStep < 2 && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Space>
                {currentStep > 0 && (
                  <Button 
                    onClick={handleBack} 
                    size="large"
                    style={{
                      backgroundColor: 'rgba(0, 150, 255, 0.1)',
                      border: '1px solid rgba(0, 150, 255, 0.3)',
                      color: '#00aaff'
                    }}
                  >
                    Back
                  </Button>
                )}
                <Button 
                  type="primary" 
                  onClick={handleNext} 
                  size="large"
                  loading={loading}
                  style={{
                    backgroundColor: '#00aaff',
                    border: 'none',
                    boxShadow: '0 0 15px rgba(0, 170, 255, 0.3)'
                  }}
                >
                  {currentStep === 1 ? 'Proceed to Face Enrollment' : 'Next'}
                </Button>
              </Space>
            </div>
          )}
        </Card>
      </div>

      {/* Footer Status */}
      <div style={{ 
        padding: '8px 16px',
        backgroundColor: 'rgba(10, 26, 53, 0.8)',
        borderTop: '1px solid rgba(0, 150, 255, 0.2)',
        backdropFilter: 'blur(10px)',
        marginTop: 8,
        borderRadius: 8
      }}>
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: faceModelsLoaded ? '#00ffaa' : '#ffaa00',
              boxShadow: faceModelsLoaded ? '0 0 8px #00ffaa' : '0 0 8px #ffaa00'
            }} />
            <Text style={{ fontSize: 11, color: '#aaccff' }}>
              {faceModelsLoaded ? 'READY' : 'LOADING MODELS'}
            </Text>
          </Space>
          <Text style={{ fontSize: 11, color: '#aaccff' }}>
            <Clock size={10} style={{ marginRight: 4 }} />
            {dayjs().format('HH:mm')}
          </Text>
        </div>
      </div>
      
      {/* Add CSS animations */}
      <style>
        {`
          @keyframes pulse {
            0% { box-shadow: 0 0 20px rgba(0, 255, 150, 0.2); }
            50% { box-shadow: 0 0 30px rgba(0, 255, 150, 0.4); }
            100% { box-shadow: 0 0 20px rgba(0, 255, 150, 0.2); }
          }
        `}
      </style>
    </div>
  );
};

export default EnrollmentPage;