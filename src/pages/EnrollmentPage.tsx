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
  Modal
} from 'antd';
import { Camera, User, Briefcase, CheckCircle, Users, ArrowLeft, Clock, AlertCircle, Download, RotateCw } from 'lucide-react';
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
  const [faceDetectionTips, setFaceDetectionTips] = useState<string>('Position face in center');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCapturedPreview, setShowCapturedPreview] = useState(false);
  const cameraRef = useRef<any>(null);

  // Nigeram specific departments with proper enum mapping
  const departments = [
    { 
      value: 'studio', 
      label: 'Studio', 
      color: '#00aaff',
      dbDepartment: 'studio',
      dbDepartmentName: 'Studio'
    },
    { 
      value: 'logistics', 
      label: 'Logistics', 
      color: '#00ffaa',
      dbDepartment: 'logistics',
      dbDepartmentName: 'Logistics'
    },
    { 
      value: 'bakery', 
      label: 'Bakery', 
      color: '#ffaa00',
      dbDepartment: 'bakery',
      dbDepartmentName: 'Bakery'
    },
    { 
      value: 'spa', 
      label: 'Spa', 
      color: '#9b59b6',
      dbDepartment: 'spa',
      dbDepartmentName: 'Spa'
    },
  ];

  // Generate staff ID function
  const generateStaffId = (): string => {
    const prefix = 'NIG';
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const currentYear = new Date().getFullYear().toString().slice(-2);
    return `${prefix}${currentYear}${randomNum}`;
  };

  // Handle regenerate staff ID
  const handleRegenerateStaffId = () => {
    const newStaffId = generateStaffId();
    setStaffId(newStaffId);
    form.setFieldValue('staff_id', newStaffId);
    message.success('New staff ID generated');
  };

  useEffect(() => {
    const newStaffId = generateStaffId();
    setStaffId(newStaffId);
    form.setFieldValue('staff_id', newStaffId);
    
    const loadModels = async () => {
      try {
        const loaded = await faceRecognition.loadModels();
        setFaceModelsLoaded(loaded);
        if (loaded) {
          message.success('Face models loaded successfully');
        } else {
          message.warning('Face models loading issue. Manual mode recommended.');
        }
      } catch (error) {
        console.error('Face models loading error:', error);
        message.warning('Face models loading slowly...');
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

        setStaffData(values);
        setCurrentStep(1);
        
      } else if (currentStep === 1) {
        await departmentForm.validateFields();
        const departmentValues = departmentForm.getFieldsValue();
        
        setStaffData((prev: any) => ({ ...prev, ...departmentValues }));
        setCurrentStep(2);
      }
    } catch (error: any) {
      const errorMessages = error.errorFields?.map((f: any) => f.errors.join(', ')).join('; ');
      message.error(errorMessages || 'Please fix form errors');
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setIsCameraActive(false);
      setCapturedImage(null);
      setShowCapturedPreview(false);
    }
    setCurrentStep(currentStep - 1);
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing) return;
    
    try {
      setIsProcessing(true);
      setFaceDetectionTips('Capturing image...');
      
      const result = await cameraRef.current.captureImage();
      
      if (result && result.photoUrl) {
        setCapturedImage(result.photoUrl);
        setShowCapturedPreview(true);
        setCaptureCount(prev => prev + 1);
        setFaceDetectionTips('Image captured successfully!');
        message.success('Image captured successfully!');
      } else {
        message.error('Failed to capture image');
      }
    } catch (error) {
      console.error('Capture error:', error);
      message.error('Failed to capture image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseCapturedImage = () => {
    if (!capturedImage) {
      message.error('No captured image available');
      return;
    }
    
    setShowCapturedPreview(false);
    processEnrollment({ photoUrl: capturedImage, success: true });
  };

  const handleRetryCapture = () => {
    setCapturedImage(null);
    setShowCapturedPreview(false);
    setFaceDetectionTips('Position face in center');
  };

  const processEnrollment = async (result: any) => {
    try {
      setLoading(true);
      setIsProcessing(true);
      console.log('🔄 Starting enrollment process...');

      let staffDepartment = staffData.department;
      
      if (!staffDepartment) {
        const deptFormValues = departmentForm.getFieldsValue();
        staffDepartment = deptFormValues.department || 'studio';
        console.log('⚠️ Department was undefined, using:', staffDepartment);
      }

      const currentStaffId = staffData.staff_id || staffId;
      const staffName = staffData.name || 'Unknown Staff';
      
      console.log('Staff Data:', { 
        id: currentStaffId, 
        name: staffName, 
        department: staffDepartment 
      });

      // 1. Prepare database record
      const currentDate = new Date();
      const departmentDetails = departments.find(dept => dept.value === staffDepartment) || departments[0];
      
      const staffRecord = {
        staff_id: currentStaffId,
        name: staffName,
        email: null,
        phone: null,
        gender: staffData.gender || 'Male',
        date_of_birth: null,
        department: departmentDetails.dbDepartment,
        department_name: departmentDetails.dbDepartmentName,
        employment_date: currentDate.toISOString().split('T')[0],
        employment_status: 'active',
        enrollment_status: 'pending',
        is_active: true,
        position: null,
        face_embedding: null,
        photo_url: null,
        face_enrolled_at: null,
        face_match_threshold: 0.75,
        last_face_scan: null,
        shift_schedule: null,
        salary_grade: null,
        supervisor_id: null,
        emergency_contact: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('📦 Record ready for DB:', staffRecord);

      // 2. Save image locally and prepare compressed version
      const compressedImage = await compressImage(result.photoUrl, 640, 0.8);
      localStorage.setItem(`face_image_${currentStaffId}`, compressedImage);
      console.log('✅ Image saved locally');

      // 3. Save to Supabase with photo URL
      try {
        console.log('💾 Saving staff record to database...');
        const updatedRecord = {
          ...staffRecord,
          photo_url: compressedImage,
          updated_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
          .from('staff')
          .upsert([updatedRecord], { onConflict: 'staff_id' })
          .select();
        
        if (error) {
          console.error('❌ DB Save Error:', error);
          throw new Error(`Database save failed: ${error.message}`);
        }
        
        console.log('✅ Staff saved to Supabase with photo:', data);
        
      } catch (dbError: any) {
        console.error('Database save failed:', dbError);
        throw new Error(`Database save failed: ${dbError.message}`);
      }

      // 4. Extract face embedding
      let faceEmbeddingExtracted = false;
      let descriptor: Float32Array | null = null;
      let faceDetectionMessage = '';
      let embeddingArray: string[] = [];
      
      console.log('🔍 Starting face embedding extraction...');
      
      try {
        descriptor = await faceRecognition.extractFaceDescriptor(compressedImage);
        
        if (descriptor && descriptor.length > 0) {
          faceEmbeddingExtracted = true;
          embeddingArray = Array.from(descriptor).map(num => num.toString());
          faceDetectionMessage = 'Face detected successfully';
          
          console.log(`✅ Face embedding extracted!`, {
            descriptorLength: descriptor.length,
            sampleValues: Array.from(descriptor.slice(0, 3)).map(v => v.toFixed(4))
          });
        } else {
          console.log('❌ No face detected');
          faceDetectionMessage = 'No face detected in image';
        }
        
      } catch (embeddingError: any) {
        console.error('❌ Face embedding extraction error:', embeddingError);
        faceDetectionMessage = `Face detection error: ${embeddingError.message}`;
      }

      // 5. Update database with face embedding if detected
      if (faceEmbeddingExtracted && descriptor && embeddingArray.length > 0) {
        console.log('💾 Saving face embedding to database...');
        
        try {
          const { error } = await supabase
            .from('staff')
            .update({
              enrollment_status: 'enrolled',
              face_embedding: embeddingArray,
              face_enrolled_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('staff_id', currentStaffId);
          
          if (error) throw error;
          
          console.log('✅ Database updated with face embedding');
          
          // Save locally
          faceRecognition.saveEmbeddingToLocal(currentStaffId, descriptor);
          
          // SUCCESS
          setEnrollmentResult({
            success: true,
            message: 'Enrollment Complete!',
            staff: { 
              name: staffName, 
              staff_id: currentStaffId 
            },
            department: staffDepartment,
            faceCaptured: true,
            faceEmbeddingSaved: true,
            departmentColor: departmentDetails.color,
            status: 'enrolled',
            photoUrl: compressedImage,
            faceDetectionMessage,
            timestamp: new Date().toISOString()
          });
          
          message.success(`✅ ${staffName} enrolled successfully!`);
          
        } catch (updateError: any) {
          console.error('❌ Could not update DB with embedding:', updateError);
          
          // Save locally as fallback
          faceRecognition.saveEmbeddingToLocal(currentStaffId, descriptor);
          
          setEnrollmentResult({
            success: true,
            message: 'Enrollment saved locally (DB update failed)',
            staff: { 
              name: staffName, 
              staff_id: currentStaffId 
            },
            department: staffDepartment,
            faceCaptured: true,
            faceEmbeddingSaved: true,
            departmentColor: departmentDetails.color,
            status: 'enrolled_local',
            photoUrl: compressedImage,
            faceDetectionMessage,
            warning: 'Database update failed, but saved locally'
          });
          
          message.warning(`⚠️ ${staffName} saved locally only. Database update failed.`);
        }
        
      } else {
        // PARTIAL SUCCESS: Saved but no face
        console.log('⚠️ Staff saved but no face embedding detected');
        
        setEnrollmentResult({
          success: false,
          message: 'Saved but no face detected',
          staff: { 
            name: staffName, 
            staff_id: currentStaffId 
          },
          department: staffDepartment,
          faceCaptured: false,
          faceEmbeddingSaved: false,
          departmentColor: departmentDetails.color,
          status: 'pending',
          photoUrl: compressedImage,
          faceDetectionMessage,
          timestamp: new Date().toISOString()
        });
        
        message.warning(`⚠️ ${staffName} saved but no face detected. Status: Pending`);
      }
      
    } catch (error: any) {
      console.error('❌ Enrollment failed:', error);
      
      setEnrollmentResult({
        success: false,
        message: 'Enrollment failed',
        error: error.message,
        status: 'failed',
        timestamp: new Date().toISOString()
      });
      
      message.error(`❌ Enrollment failed: ${error.message}`);
      
    } finally {
      setLoading(false);
      setIsProcessing(false);
      setEnrollmentComplete(true);
      setIsCameraActive(false);
      
      console.log('📊 Enrollment process completed:', {
        success: enrollmentResult?.success,
        status: enrollmentResult?.status,
        hasEmbedding: enrollmentResult?.faceEmbeddingSaved
      });
    }
  };

  const retryFaceEnrollment = async () => {
    if (!enrollmentResult?.staff?.staff_id) {
      message.error('No staff ID found for retry');
      return;
    }

    const staffId = enrollmentResult.staff.staff_id;
    const savedImage = localStorage.getItem(`face_image_${staffId}`);
    
    if (!savedImage) {
      message.error('No saved image found for this staff member');
      return;
    }

    setLoading(true);
    setIsProcessing(true);
    setFaceDetectionTips('Retrying face detection...');
    
    try {
      console.log(`🔄 Retrying face enrollment for ${staffId}`);
      
      const descriptor = await faceRecognition.extractFaceDescriptor(savedImage);
      
      if (descriptor && descriptor.length > 0) {
        const embeddingArray = Array.from(descriptor).map(num => num.toString());
        
        console.log(`✅ Face detected on retry! Saving to database...`);
        
        const { error } = await supabase
          .from('staff')
          .update({
            enrollment_status: 'enrolled',
            face_embedding: embeddingArray,
            face_enrolled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            photo_url: savedImage
          })
          .eq('staff_id', staffId);
        
        if (error) throw error;
        
        faceRecognition.saveEmbeddingToLocal(staffId, descriptor);
        
        setEnrollmentResult(prev => ({
          ...prev,
          success: true,
          message: 'Enrollment Complete! (Retried)',
          faceEmbeddingSaved: true,
          status: 'enrolled',
          faceDetectionMessage: 'Face detected on retry'
        }));
        
        message.success('✅ Face enrollment completed successfully!');
        
      } else {
        message.error('Still no face detected. Please try with better lighting.');
        setFaceDetectionTips('No face detected on retry');
      }
      
    } catch (error: any) {
      console.error('❌ Retry failed:', error);
      message.error(`Retry failed: ${error.message}`);
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  };

  const updateMissingPhotos = async () => {
    try {
      console.log('🔄 Checking for records with missing photos...');
      
      const { data: staffList, error } = await supabase
        .from('staff')
        .select('staff_id, name, photo_url')
        .is('photo_url', null)
        .limit(50);
      
      if (error) {
        console.error('❌ Error fetching staff:', error);
        return;
      }
      
      console.log(`Found ${staffList?.length || 0} records with missing photos`);
      
      let updatedCount = 0;
      
      for (const staff of staffList || []) {
        try {
          const savedImage = localStorage.getItem(`face_image_${staff.staff_id}`);
          
          if (savedImage) {
            const { error: updateError } = await supabase
              .from('staff')
              .update({
                photo_url: savedImage,
                updated_at: new Date().toISOString()
              })
              .eq('staff_id', staff.staff_id);
            
            if (!updateError) {
              updatedCount++;
              console.log(`✅ Updated photo for ${staff.name} (${staff.staff_id})`);
            }
          }
        } catch (staffError) {
          console.warn(`Could not update ${staff.staff_id}:`, staffError);
        }
      }
      
      message.success(`✅ Updated ${updatedCount} records with photos`);
      
    } catch (error) {
      console.error('❌ Update failed:', error);
      message.error('Failed to update photos');
    }
  };

  useEffect(() => {
    if (currentStep === 2 && !isCameraActive) {
      setIsCameraActive(true);
    }
  }, [currentStep, isCameraActive]);

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
            initialValues={{ gender: 'Male' }}
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
                    <Select.Option value="Male">Male</Select.Option>
                    <Select.Option value="Female">Female</Select.Option>
                    <Select.Option value="Other">Other</Select.Option>
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
                <p><strong>Status:</strong> <Tag color="success">ENROLLED ✓</Tag></p>
                <p><strong>Face Detection:</strong> 
                  <Tag color="green" style={{ marginLeft: 8 }}>
                    SUCCESS
                  </Tag>
                </p>
                <p><strong>Embedding:</strong> 
                  <Tag color="green" style={{ marginLeft: 8 }}>
                    SAVED ✓
                  </Tag>
                </p>
                <p><strong>Message:</strong> {enrollmentResult.faceDetectionMessage}</p>
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
                    setCapturedImage(null);
                    setShowCapturedPreview(false);
                    
                    form.resetFields();
                    departmentForm.resetFields();
                    setStaffData({});
                    
                    form.setFieldsValue({
                      gender: 'Male',
                      staff_id: newStaffId
                    });
                  }}
                >
                  Enroll Another Staff
                </Button>
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
              </Space>
            </>
          ) : enrollmentResult?.status === 'pending' ? (
            <>
              <AlertCircle size={64} color="#faad14" />
              <Title level={3} style={{ marginTop: 20, color: '#faad14' }}>
                Enrollment Incomplete
              </Title>
              
              <Card style={{ maxWidth: 500, margin: '20px auto', textAlign: 'left' }}>
                <Title level={4}>Partial Success</Title>
                <Alert
                  message="Saved but no face detected"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 20 }}
                />
                
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
                <p><strong>Status:</strong> <Tag color="orange">PENDING</Tag></p>
                <p><strong>Face Detection:</strong> 
                  <Tag color="orange" style={{ marginLeft: 8 }}>
                    NO FACE DETECTED
                  </Tag>
                </p>
                <p><strong>Database Status:</strong> Saved</p>
                <p><strong>Message:</strong> {enrollmentResult.faceDetectionMessage}</p>
                
                {enrollmentResult.photoUrl && (
                  <div style={{ marginTop: 20, textAlign: 'center' }}>
                    <p><strong>Captured Image:</strong></p>
                    <img 
                      src={enrollmentResult.photoUrl} 
                      alt="Staff" 
                      style={{ 
                        maxWidth: '150px', 
                        borderRadius: '8px',
                        border: '2px solid #faad14'
                      }} 
                    />
                    <p style={{ fontSize: '12px', color: '#faad14', marginTop: '8px' }}>
                      ⚠️ No face detected in this image
                    </p>
                  </div>
                )}
              </Card>
              
              <Alert
                message="Next Steps"
                description="The staff was saved but needs face embedding. You can retry face enrollment or capture a new photo."
                type="info"
                showIcon
                style={{ maxWidth: 500, margin: '20px auto' }}
              />
              
              <Space style={{ marginTop: 30 }}>
                <Button
                  type="primary"
                  size="large"
                  onClick={retryFaceEnrollment}
                  loading={loading}
                >
                  Retry Face Enrollment
                </Button>
                <Button 
                  size="large"
                  onClick={() => {
                    setEnrollmentComplete(false);
                    setIsCameraActive(true);
                    setEnrollmentResult(null);
                    setCaptureCount(0);
                    setCapturedImage(null);
                    setShowCapturedPreview(false);
                  }}
                >
                  Capture New Photo
                </Button>
                <Button 
                  size="large"
                  onClick={() => window.location.href = '/staff'}
                >
                  Go to Staff Management
                </Button>
              </Space>
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
                Enrollment Failed
              </Title>
              <Alert
                message="Error"
                description={enrollmentResult?.message || 'Unknown error occurred'}
                type="error"
                showIcon
                style={{ maxWidth: 500, margin: '20px auto' }}
              />
              
              <Space style={{ marginTop: 20 }}>
                <Button
                  type="primary"
                  size="large"
                  onClick={retryFaceEnrollment}
                  loading={loading}
                >
                  Retry Enrollment
                </Button>
                <Button
                  type="default"
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
                    setCapturedImage(null);
                    setShowCapturedPreview(false);
                    
                    form.resetFields();
                    departmentForm.resetFields();
                    setStaffData({});
                    
                    form.setFieldsValue({
                      gender: 'Male',
                      staff_id: newStaffId
                    });
                  }}
                >
                  Start Fresh
                </Button>
              </Space>
            </>
          )}
        </div>
      ) : currentStep === 2 && isCameraActive ? (
        <div style={{ 
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0a1a35 0%, #001529 100%)'
        }}>
          {/* Header */}
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
                animation: faceModelsLoaded ? 'pulse 2s infinite' : 'none'
              }} />
              <Text style={{ fontSize: 12, color: '#aaccff' }}>
                {faceModelsLoaded ? 'READY' : 'LOADING MODELS...'}
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
          
          {/* Camera Container */}
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
                  ref={cameraRef}
                  staff={{
                    id: staffData.staff_id || staffId,
                    name: staffData.name,
                    staff_id: staffData.staff_id || staffId,
                    department: staffData.department
                  }}
                  autoCapture={false} // Disabled auto-capture
                  onFaceDetectionUpdate={(status: any) => {
                    if (status?.message) {
                      setFaceDetectionTips(status.message);
                    }
                  }}
                />
              </div>
            )}
            
            {/* Face Detection Tips Overlay */}
            <div style={{
              position: 'absolute',
              bottom: 100,
              left: 0,
              right: 0,
              textAlign: 'center',
              zIndex: 50
            }}>
              <div style={{
                display: 'inline-block',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: '8px 16px',
                borderRadius: '20px',
                border: '1px solid rgba(0, 150, 255, 0.3)',
                backdropFilter: 'blur(10px)'
              }}>
                <Text style={{ 
                  fontSize: 12, 
                  color: '#00ffaa',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Camera size={12} />
                  {faceDetectionTips}
                </Text>
              </div>
            </div>
            
            {/* Processing Overlay */}
            {isProcessing && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
                    fontWeight: 'bold',
                    animation: 'pulse 1.5s infinite'
                  }}>
                    PROCESSING...
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer with Action Buttons */}
          <div style={{ 
            padding: '12px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderTop: '1px solid rgba(0, 150, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
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
                  backgroundColor: '#00ffaa',
                  animation: 'pulse 1s infinite'
                }} />
                <Text style={{ fontSize: 11, color: '#aaccff' }}>
                  CAPTURES: {captureCount}
                </Text>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: '#aaccff', opacity: 0.8 }}>
                  Face Enrollment Tips:
                </Text>
                <Text style={{ fontSize: 9, color: '#aaccff', textAlign: 'center' }}>
                  • Good lighting • Face centered • No glasses/hats
                </Text>
              </div>
              
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
            
            {/* Main Action Buttons */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center',
              gap: '12px',
              marginTop: '8px'
            }}>
              <Button
                type="primary"
                icon={<Camera size={14} />}
                onClick={handleCapture}
                loading={isProcessing}
                disabled={isProcessing}
                size="middle"
                style={{
                  backgroundColor: '#00aaff',
                  border: 'none',
                  boxShadow: '0 0 8px rgba(0, 170, 255, 0.3)',
                  fontSize: 12,
                  padding: '6px 16px',
                  minWidth: '120px'
                }}
              >
                CAPTURE NOW
              </Button>
              
              {capturedImage && (
                <Button
                  type="default"
                  icon={<Download size={14} />}
                  onClick={handleUseCapturedImage}
                  loading={loading}
                  disabled={loading}
                  size="middle"
                  style={{
                    backgroundColor: 'rgba(82, 196, 26, 0.1)',
                    border: '1px solid rgba(82, 196, 26, 0.3)',
                    color: '#52c41a',
                    fontSize: 12,
                    padding: '6px 16px',
                    minWidth: '120px'
                  }}
                >
                  USE THIS PHOTO
                </Button>
              )}
              
              {capturedImage && (
                <Button
                  icon={<RotateCw size={14} />}
                  onClick={handleRetryCapture}
                  disabled={isProcessing}
                  size="middle"
                  style={{
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    border: '1px solid rgba(255, 107, 107, 0.3)',
                    color: '#ff6b6b',
                    fontSize: 12,
                    padding: '6px 16px'
                  }}
                >
                  RETRY
                </Button>
              )}
            </div>
          </div>
          
          {/* Captured Image Preview Modal */}
          <Modal
            title="Captured Image Preview"
            open={showCapturedPreview}
            onCancel={() => setShowCapturedPreview(false)}
            footer={[
              <Button key="retry" onClick={handleRetryCapture}>
                Retry Capture
              </Button>,
              <Button 
                key="use" 
                type="primary" 
                onClick={handleUseCapturedImage}
                loading={loading}
              >
                Use This Photo
              </Button>
            ]}
          >
            {capturedImage && (
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={capturedImage} 
                  alt="Captured" 
                  style={{ 
                    maxWidth: '100%', 
                    borderRadius: '8px',
                    border: '2px solid #00aaff'
                  }} 
                />
                <p style={{ marginTop: '12px', color: '#666' }}>
                  Review the captured image. If it looks good, click "Use This Photo" to proceed with enrollment.
                </p>
              </div>
            )}
          </Modal>
        </div>
      ) : (
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16
        }}>
          <Spin size="large" />
          <Text style={{ color: '#aaccff' }}>
            Initializing face enrollment camera...
          </Text>
          <Button
            type="primary"
            size="small"
            onClick={() => setIsCameraActive(true)}
            style={{ marginTop: 8 }}
          >
            Start Camera Manually
          </Button>
        </div>
      ),
    },
  ];

  useEffect(() => {
    if (currentStep === 2 && !isCameraActive) {
      console.log('Starting camera for enrollment');
      setIsCameraActive(true);
    }
  }, [currentStep, isCameraActive]);

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a1a35',
      padding: '4px',
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
            Status: {faceModelsLoaded ? 'READY' : 'LOADING MODELS'}
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
            0% { opacity: 1; }
            50% { opacity: 0.6; }
            100% { opacity: 1; }
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

export default EnrollmentPage;