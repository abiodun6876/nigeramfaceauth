// src/pages/EnrollmentPage.tsx - UPDATED WITH PROTOTYPE UI
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
  Spin
} from 'antd';
import { Camera, User, Briefcase, CheckCircle, Users, ArrowLeft, Clock } from 'lucide-react';
import FaceEnrollmentCamera from '../components/FaceEnrollmentCamera';
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

  const handlePhotoCapture = async (photoUrl: string): Promise<void> => {
  console.log('Photo captured for enrollment:', photoUrl);
  // No return statement needed
};

  // Handle face capture completion
  const handleFaceCapture = async (result: any) => {
    if (!result.success || !result.photoUrl || isProcessing) return;
    
    setIsProcessing(true);
    setCaptureCount(prev => prev + 1);
    
    try {
      console.log('=== ENROLLMENT CAPTURE COMPLETE ===');
      console.log('Result:', result);
      
      // Process the enrollment
      await processEnrollment(result);
      
    } catch (error: any) {
      console.error('Enrollment processing error:', error);
      message.error(`Enrollment failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  
  const processEnrollment = async (result: any) => {
  try {
    setLoading(true);

    const currentStaffId = staffData.staff_id || staffId;
    const staffName = staffData.name || 'Unknown Staff';
    const staffDepartment = staffData.department;
    
    console.log('Processing enrollment for:', { currentStaffId, staffName, staffDepartment });

    // 1. Save image to localStorage
    const compressedImage = await compressImage(result.photoUrl, 480, 0.7);
    localStorage.setItem(`face_image_${currentStaffId}`, compressedImage);
    localStorage.setItem(`staff_meta_${currentStaffId}`, JSON.stringify({
      name: staffName,
      department: staffDepartment,
      enrolledAt: new Date().toISOString()
    }));
    
    console.log('✅ Saved to localStorage');

    // 2. Map department to enum value
    const departmentMap: Record<string, string> = {
      'studio': 'studio',
      'logistics': 'logistics', 
      'bakery': 'bakery',
      'spa': 'spa'
    };
    
    const dbDepartment = departmentMap[staffDepartment] || 'studio';

    // 3. Prepare staff record matching EXACT database schema
    const currentDate = new Date();
    const staffRecord = {
      // id: uuidv4(), // Supabase will auto-generate this
      staff_id: currentStaffId,
      name: staffName,
      email: null, // Required by schema but can be null
      phone: null,
      gender: staffData.gender || 'male', // Must match gender_enum
      date_of_birth: null,
      department: dbDepartment, // Must match staff_department_enum
      department_name: staffDepartment.charAt(0).toUpperCase() + staffDepartment.slice(1), // Human readable
      position: null,
      employment_date: currentDate.toISOString().split('T')[0], // REQUIRED field
      employment_status: 'active', // Must match employment_status_enum
      enrollment_status: 'pending', // Must match enrollment_status_enum
      face_embedding: null,
      photo_url: null,
      face_enrolled_at: null,
      face_match_threshold: 0.75,
      last_face_scan: null,
      shift_schedule: null,
      salary_grade: null,
      supervisor_id: null,
      emergency_contact: null,
      is_active: true,
      // created_at and updated_at will be auto-set by triggers
    };
    
    console.log('📝 Staff record for DB:', staffRecord);

    // 4. Try UPSERT first (handles duplicates)
    console.log('Attempting UPSERT to Supabase...');
    const { data: dbResult, error: dbError } = await supabase
      .from('staff')
      .upsert([staffRecord], { 
        onConflict: 'staff_id',
        ignoreDuplicates: false 
      })
      .select();
    
    if (dbError) {
      console.error('❌ UPSERT failed, trying INSERT...', dbError);
      
      // Try INSERT as fallback
      const { data: insertData, error: insertError } = await supabase
        .from('staff')
        .insert([staffRecord])
        .select();
      
      if (insertError) {
        console.error('❌ INSERT also failed:', insertError);
        throw insertError;
      }
      
      console.log('✅ INSERT successful:', insertData);
    } else {
      console.log('✅ UPSERT successful:', dbResult);
    }

    // 5. Try to extract face embedding
    let embeddingArray = null;
    let photoUrl = '';
    
    try {
      console.log('Extracting face embedding...');
      const descriptor = await faceRecognition.extractFaceDescriptor(compressedImage);
      
      if (descriptor && descriptor.length > 0) {
        embeddingArray = Array.from(descriptor);
        console.log('✅ Face embedding extracted');
        
        // Save embedding locally
        faceRecognition.saveEmbeddingToLocal(currentStaffId, descriptor);
        
        // Try to upload photo
        try {
          const fileName = `enrollment_${Date.now()}_${staffName.replace(/\s+/g, '_')}.jpg`;
          const { error: storageError } = await supabase.storage
            .from('staff-photos')
            .upload(fileName, dataURLtoBlob(compressedImage), {
              contentType: 'image/jpeg'
            });
          
          if (!storageError) {
            const { data: publicUrlData } = supabase.storage
              .from('staff-photos')
              .getPublicUrl(fileName);
            photoUrl = publicUrlData.publicUrl;
            console.log('✅ Photo uploaded to storage:', photoUrl);
          } else {
            console.warn('Storage upload failed:', storageError);
          }
        } catch (storageError) {
          console.warn('Storage upload error:', storageError);
        }
        
        // Update DB with embedding and photo
        const updateData = {
          enrollment_status: 'enrolled',
          face_embedding: embeddingArray,
          face_enrolled_at: new Date().toISOString(),
          photo_url: photoUrl,
          updated_at: new Date().toISOString()
        };
        
        const { error: updateError } = await supabase
          .from('staff')
          .update(updateData)
          .eq('staff_id', currentStaffId);
          
        if (updateError) {
          console.error('❌ Update embedding failed:', updateError);
        } else {
          console.log('✅ Face embedding saved to database');
        }
        
        setEnrollmentResult({
          success: true,
          message: 'Staff enrollment completed successfully!',
          staff: { name: staffName, staff_id: currentStaffId },
          department: staffDepartment,
          faceCaptured: true,
          photoUrl: photoUrl || compressedImage,
          status: 'enrolled'
        });
        
        message.success(`Enrollment complete for ${staffName}!`);
        
      } else {
        console.log('⚠️ No face detected in photo');
        setEnrollmentResult({
          success: false,
          message: 'Staff saved but face not detected in photo.',
          staff: { name: staffName, staff_id: currentStaffId },
          department: staffDepartment,
          faceCaptured: true,
          photoUrl: compressedImage,
          status: 'pending'
        });
        message.warning(`Staff ${staffName} saved, but face not detected.`);
      }
      
    } catch (embeddingError) {
      console.error('Face embedding extraction failed:', embeddingError);
      setEnrollmentResult({
        success: false,
        message: 'Staff saved but face embedding failed.',
        staff: { name: staffName, staff_id: currentStaffId },
        department: staffDepartment,
        faceCaptured: true,
        photoUrl: compressedImage,
        status: 'pending'
      });
      message.warning(`Staff ${staffName} saved, but face embedding failed.`);
    }
    
    setEnrollmentComplete(true);
    setIsCameraActive(false);
    
  } catch (error: any) {
    console.error('❌ Enrollment error:', error);
    
    // Show detailed error
    message.error(`Enrollment failed: ${error.message || 'Unknown error'}`);
    
    setEnrollmentResult({
      success: false,
      message: `Enrollment failed: ${error.message || 'Unknown error'}`,
      error: error.message,
      status: 'failed'
    });
    
    setEnrollmentComplete(true);
    setIsCameraActive(false);
    
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
      ) : currentStep === 2 && isCameraActive ? (
        // PROTOTYPE UI - Camera dominates the screen
        <div style={{ 
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0a1a35 0%, #001529 100%)'
        }}>
          {/* Minimal Header - Like prototype */}
          <div style={{ 
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderBottom: '1px solid rgba(0, 150, 255, 0.1)'
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
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12, color: '#aaccff', fontWeight: 'bold' }}>
                {staffData.name || 'STAFF NAME'}
              </Text>
              <Tag color="blue" style={{ fontSize: 11, padding: '2px 6px' }}>
                {staffId}
              </Tag>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={12} color="#aaccff" />
              <Text style={{ fontSize: 12, color: '#aaccff' }}>
                {dayjs().format('HH:mm')}
              </Text>
            </div>
          </div>
          
          {/* Camera Container - Takes majority of screen */}
          <div style={{ 
            flex: 1,
            position: 'relative',
            padding: '8px'
          }}>
            {isCameraActive && (
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: 8,
                overflow: 'hidden',
                border: '2px solid rgba(0, 150, 255, 0.2)',
                boxShadow: '0 0 30px rgba(0, 150, 255, 0.1)'
              }}>
               
            <FaceEnrollmentCamera
              staff={{
                id: staffData.staff_id || staffId,
                name: staffData.name,
                staff_id: staffData.staff_id || staffId,
                department: staffData.department
              }}
              onEnrollmentComplete={handleFaceCapture}
              
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
                zIndex: 100,
                borderRadius: 8
              }}>
                <div style={{ textAlign: 'center' }}>
                  <Spin size="large" />
                  <div style={{ 
                    marginTop: 16, 
                    color: '#00ffaa',
                    fontSize: 14,
                    fontWeight: 'bold'
                  }}>
                    PROCESSING ENROLLMENT...
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Minimal Footer - Small text like prototype */}
          <div style={{ 
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderTop: '1px solid rgba(0, 150, 255, 0.1)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%',
                  backgroundColor: '#00ffaa'
                }} />
                <Text style={{ fontSize: 11, color: '#aaccff' }}>
                  AUTO-SCAN: {captureCount}
                </Text>
              </div>
              
              <Text style={{ fontSize: 11, color: '#aaccff', fontStyle: 'italic' }}>
                Position face in the frame for automatic capture
              </Text>
              
              <Button
                size="small"
                icon={<ArrowLeft size={12} />}
                onClick={handleBack}
                style={{
                  backgroundColor: 'rgba(0, 150, 255, 0.1)',
                  border: '1px solid rgba(0, 150, 255, 0.3)',
                  color: '#00aaff',
                  fontSize: 11,
                  padding: '4px 8px'
                }}
              >
                BACK
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // When camera not active (shouldn't happen in step 2)
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Spin size="large" tip="Loading enrollment camera..." />
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
      padding: '4px', // Reduced padding
      color: '#ffffff'
    }}>
      {/* Minimal Header */}
      {currentStep < 2 && (
        <div style={{ 
          marginBottom: 8,
          padding: '8px 0'
        }}>
          <Title level={4} style={{ color: '#ffffff', margin: 0, fontSize: 16 }}>
            Staff Enrollment
          </Title>
          <Text type="secondary" style={{ color: '#aaccff', fontSize: 11 }}>
            Nigeram Ventures Biometric System
          </Text>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: 4,
        backdropFilter: 'blur(10px)'
      }}>
        {/* Steps - Only show for steps 0-1 */}
        {currentStep < 2 && (
          <div style={{ padding: '8px 12px' }}>
            <Steps 
              current={currentStep} 
              size="small"
              items={stepItems.map((item, index) => ({
                key: index,
                title: item.title,
                icon: React.cloneElement(item.icon, { size: 14 })
              }))}
              style={{ marginBottom: 12 }}
            />
          </div>
        )}

        {/* Content Area */}
        <div style={{ 
          flex: 1, 
          minHeight: 0, 
          overflow: 'auto',
          padding: currentStep < 2 ? '12px' : '0'
        }}>
          {stepItems[currentStep].content}
        </div>

        {/* Navigation Buttons - Only for steps 0-1 */}
        {!enrollmentComplete && currentStep < 2 && (
          <div style={{ 
            padding: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            backgroundColor: 'rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {currentStep > 0 && (
                <Button 
                  onClick={handleBack} 
                  size="small"
                  style={{
                    backgroundColor: 'rgba(0, 150, 255, 0.1)',
                    border: '1px solid rgba(0, 150, 255, 0.3)',
                    color: '#00aaff',
                    fontSize: 12
                  }}
                >
                  Back
                </Button>
              )}
              
              <Button 
                type="primary" 
                onClick={handleNext} 
                size="small"
                loading={loading}
                style={{
                  backgroundColor: '#00aaff',
                  border: 'none',
                  boxShadow: '0 0 8px rgba(0, 170, 255, 0.3)',
                  fontSize: 12,
                  marginLeft: currentStep === 0 ? 'auto' : undefined
                }}
              >
                {currentStep === 1 ? 'Continue to Face Enrollment' : 'Next'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Minimal Footer Status */}
      <div style={{ 
        padding: '4px 8px',
        backgroundColor: 'rgba(10, 26, 53, 0.5)',
        borderTop: '1px solid rgba(0, 150, 255, 0.1)',
        marginTop: 4,
        borderRadius: 2,
        fontSize: 10
      }}>
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: '#aaccff' }}>
            Status: {faceModelsLoaded ? 'READY' : 'LOADING'}
          </span>
          <span style={{ color: '#aaccff' }}>
            {dayjs().format('HH:mm:ss')}
          </span>
        </div>
      </div>
      
      {/* Add CSS animations */}
      <style>
        {`
          @keyframes pulse {
            0% { box-shadow: 0 0 10px rgba(0, 255, 150, 0.2); }
            50% { box-shadow: 0 0 15px rgba(0, 255, 150, 0.4); }
            100% { box-shadow: 0 0 10px rgba(0, 255, 150, 0.2); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

export default EnrollmentPage;