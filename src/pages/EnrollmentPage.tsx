// src/pages/EnrollmentPage.tsx - NIGERAM CUSTOMIZED VERSION
import React, { useState, useEffect } from 'react';
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
import { Camera, User, Briefcase, CheckCircle, Users, Calendar } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import { compressImage } from '../utils/imageUtils';
import faceRecognition from '../utils/faceRecognition';

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
  
  // Nigeram specific departments
  const departments = [
    { value: 'studio', label: 'Studio', color: '#00aaff' },
    { value: 'logistics', label: 'Logistics', color: '#00ffaa' },
    { value: 'bakery', label: 'Bakery', color: '#ffaa00' },
    { value: 'spa', label: 'Spa', color: '#9b59b6' },
  ];

  // Generate staff ID
  const generateStaffId = () => {
    const prefix = 'NIG'; // Nigeram prefix
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const currentYear = new Date().getFullYear().toString().slice(-2);
    return `${prefix}${currentYear}${randomNum}`;
  };

  // Generate employee ID when component mounts
  useEffect(() => {
    const newStaffId = generateStaffId();
    setStaffId(newStaffId);
    form.setFieldValue('staff_id', newStaffId);
  }, [form]);

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields();
        const values = form.getFieldsValue();
        
        // Ensure staff ID is set
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
        // Validate department form
        await departmentForm.validateFields();
        const departmentValues = await departmentForm.getFieldsValue();
        setStaffData((prev: any) => ({ ...prev, ...departmentValues }));
        setCurrentStep(2);
      }
    } catch (error: any) {
      console.error('Error in handleNext:', error);
      const errorMessages = error.errorFields?.map((f: any) => f.errors.join(', ')).join('; ');
      message.error(errorMessages || 'Please fix form errors');
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleRegenerateStaffId = () => {
    const newStaffId = generateStaffId();
    setStaffId(newStaffId);
    form.setFieldValue('staff_id', newStaffId);
    message.success('New staff ID generated');
  };

  // Helper function to convert data URL to blob
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

  // Enrollment handler
  const handleEnrollmentComplete = async (result: any) => {
    console.log('=== ENROLLMENT COMPLETE TRIGGERED ===');
    console.log('Full result from FaceCamera:', result);
    
    try {
      if (!result.success || !result.photoData) {
        console.error('Result missing success or photoData:', result);
        message.error('Failed to capture image');
        return;
      }

      setLoading(true);

      // Extract staff information
     // Line 137 - FIXED VERSION:
       const currentStaffId = result.staffId || result.staff_id || staffData.staff_id || staffId;
      const staffName = result.staffName || staffData.name || 'Unknown Staff';
      const staffDepartment = result.department || staffData.department;
      const staffGender = result.gender || staffData.gender || 'male';
      
      console.log('Extracted staff info:', {
        staffId,
        staffName,
        staffDepartment,
        staffGender
      });

      // Validate required fields
      if (!staffId || !staffName || !staffDepartment) {
        console.error('Missing required staff information:', { staffId, staffName, staffDepartment });
        message.error('Missing staff information. Please complete all form steps.');
        setLoading(false);
        return;
      }

      // Compress the image
      const compressedImage = await compressImage(result.photoData.base64, 640, 0.8);
      
      // Generate a unique filename
      const fileName = `enrollment_${Date.now()}_${staffName.replace(/\s+/g, '_')}.jpg`;
      
      console.log('Processing enrollment for:', staffName, 'with ID:', staffId);
      
      try {
        let photoUrl = '';
        let photoData = compressedImage;
        
        // Try to upload to Supabase Storage
        try {
          console.log('Attempting to upload to Supabase Storage...');
          const { error: storageError } = await supabase.storage
            .from('staff-photos')
            .upload(fileName, dataURLtoBlob(compressedImage), {
              contentType: 'image/jpeg',
              upsert: true
            });
          
          if (!storageError) {
            // Get public URL
            const { data: publicUrlData } = supabase.storage
              .from('staff-photos')
              .getPublicUrl(fileName);
            
            photoUrl = publicUrlData.publicUrl;
            console.log('✅ Photo uploaded to storage:', photoUrl);
          } else {
            console.warn('❌ Storage upload failed:', storageError);
          }
        } catch (storageError) {
          console.warn('❌ Storage bucket may not exist:', storageError);
        }
        
        // Get current date for employment
        const currentDate = new Date();
        
        // Extract face embedding
        console.log('=== Extracting face embedding ===');
        let embeddingArray = null;
        let embeddingError = null;

        try {
          const descriptor = await faceRecognition.extractFaceDescriptor(compressedImage);
          
          if (descriptor) {
            embeddingArray = Array.from(descriptor);
            console.log('✅ Face embedding extracted, length:', embeddingArray.length);
            
            // Save to local storage
            faceRecognition.saveEmbeddingToLocal(staffId, descriptor);
          } else {
            console.log('⚠️ No face detected - embedding not extracted');
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

        // Save staff with embedding
        console.log('=== Saving staff with embedding ===');

        // Prepare staff data WITH embedding
        const staffRecord = {
           staff_id: currentStaffId,  // Changed here
          name: staffName,
          gender: staffGender,
          department: staffDepartment,
          employment_date: currentDate.toISOString().split('T')[0],
          employment_status: 'active',
          enrollment_date: currentDate.toISOString().split('T')[0],
          photo_url: photoUrl || null,
          photo_data: photoData.replace(/^data:image\/\w+;base64,/, ''),
          face_embedding: embeddingArray,
          face_enrolled_at: currentDate.toISOString(),
          last_updated: currentDate.toISOString(),
          created_at: currentDate.toISOString()
        };
        
        console.log('📊 Staff data for database (with embedding):', {
          ...staffRecord,
          face_embedding_length: staffRecord.face_embedding?.length,
        });
        
        // Check if staff already exists
        const { data: existingStaff, error: checkError } = await supabase
          .from('staff')
          .select('staff_id, id')
          .eq('staff_id', staffId)
          .maybeSingle();
        
        let dbResult;
        
        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking staff existence:', checkError);
          throw checkError;
        }
        
        if (!existingStaff) {
          // Staff doesn't exist, INSERT with embedding
          console.log('Inserting new staff with embedding...');
          const { data: insertData, error: insertError } = await supabase
            .from('staff')
            .insert([staffRecord])
            .select();
          
          if (insertError) {
            console.error('Insert error:', insertError);
            throw insertError;
          }
          dbResult = insertData;
          console.log('✅ New staff inserted with embedding:', dbResult);
        } else {
          // Staff exists, UPDATE with all fields including embedding
          console.log('Updating existing staff with embedding...');
          const { data: updateData, error: updateError } = await supabase
            .from('staff')
            .update({
              ...staffRecord,
              id: existingStaff.id
            })
            .eq('staff_id', staffId)
            .select();
          
          if (updateError) {
            console.error('Update error:', updateError);
            throw updateError;
          }
          dbResult = updateData;
          console.log('✅ Staff updated with embedding:', dbResult);
        }
        
        // Store in staff_photos table if it exists
        try {
          const { error: tableCheckError } = await supabase
            .from('staff_photos')
            .select('count')
            .limit(1);
          
          if (!tableCheckError) {
            console.log('Saving to staff_photos table...');
            const { data: photoResult, error: photoError } = await supabase
              .from('staff_photos')
              .upsert([{
                staff_id: staffId,
                photo_url: photoUrl,
                photo_data: photoData.replace(/^data:image\/\w+;base64,/, ''),
                is_primary: true,
                embedding_extracted: true,
                embedding_length: embeddingArray?.length
              }], {
                onConflict: 'staff_id,is_primary'
              })
              .select();
            
            if (photoError) {
              console.error('⚠️ Photo metadata save warning:', photoError);
            } else {
              console.log('✅ Photo saved to staff_photos:', photoResult);
            }
          } else {
            console.log('⚠️ staff_photos table does not exist or error:', tableCheckError);
          }
        } catch (photoError) {
          console.warn('⚠️ Could not save to staff_photos:', photoError);
        }

        // Save to local storage as backup
        try {
          const key = `face_image_${staffId}`;
          localStorage.setItem(key, photoData);
          console.log('✅ Image saved to localStorage:', key);
        } catch (localError) {
          console.warn('⚠️ Local storage save failed:', localError);
        }
        
        // Verify the enrollment
        console.log('=== Verifying enrollment ===');
        
        const { data: verifyData, error: verifyError } = await supabase
          .from('staff')
          .select('staff_id, name, face_embedding')
          .eq('staff_id', staffId)
          .single();
        
        if (verifyError) {
          console.error('Verification error:', verifyError);
          throw new Error(`Enrollment verification failed: ${verifyError.message}`);
        }
        
        console.log('✅ Enrollment verified:', {
          staffId: verifyData.staff_id,
          name: verifyData.name,
          embeddingSaved: verifyData.face_embedding !== null,
        });
        
        // Get department color for display
        const deptInfo = departments.find(d => d.value === staffDepartment);
        
        // Set enrollment result
        setEnrollmentResult({
          success: true,
          message: 'Staff enrollment completed successfully!',
          staff: {
            name: staffName,
            staff_id: staffId,
          },
          department: staffDepartment,
          departmentColor: deptInfo?.color,
          faceCaptured: true,
          localStorageSaved: true,
          photoUrl: photoUrl || photoData,
          databaseSaved: true,
          faceEmbeddingSaved: true,
          embeddingLength: embeddingArray.length,
          verification: {
            embeddingPresent: verifyData.face_embedding !== null,
          }
        });
        
        setEnrollmentComplete(true);
        message.success(`Enrollment complete for ${staffName}!`);
        
      } catch (error: any) {
        console.error('❌ Upload/processing error:', error);
        
        // Fallback: Save as pending if embedding fails
        console.log('Attempting fallback save as pending...');
        const fallbackData = {
          staff_id: staffId,
          name: staffName,
          department: staffDepartment,
          gender: staffGender,
          employment_status: 'pending',
          enrollment_date: new Date().toISOString().split('T')[0],
          last_updated: new Date().toISOString(),
          face_embedding: null
        };
        
        const { error: fallbackError } = await supabase
          .from('staff')
          .upsert([fallbackData], {
            onConflict: 'staff_id'
          });
        
        if (fallbackError) {
          console.error('❌ Fallback save also failed:', fallbackError);
          throw fallbackError;
        }
        
        console.log('✅ Fallback save successful (status: pending)');
        
        setEnrollmentResult({
          success: false,
          message: 'Enrollment failed: Could not extract face embedding. Staff saved as "pending".',
          staff: {
            name: staffName,
            staff_id: staffId,
          },
          department: staffDepartment,
          faceCaptured: true,
          databaseSaved: true,
          faceEmbeddingSaved: false,
          status: 'pending'
        });
        
        setEnrollmentComplete(true);
        message.warning(`Enrollment incomplete for ${staffName}. Face embedding extraction failed. Staff saved as "pending".`);
      }
      
    } catch (error: any) {
      console.error('❌ Critical enrollment error:', error);
      setEnrollmentResult({
        success: false,
        message: `Failed to complete enrollment: ${error.message}`,
        error: error
      });
      setEnrollmentComplete(true);
      message.error(`Failed to complete enrollment: ${error.message}`);
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
                    { 
                      required: true, 
                      message: 'Please enter staff name',
                      whitespace: true
                    },
                    { 
                      min: 3, 
                      message: 'Name must be at least 3 characters' 
                    }
                  ]}
                  validateTrigger={['onChange', 'onBlur']}
                >
                  <Input 
                    placeholder="Enter staff full name" 
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Staff ID *"
                  name="staff_id"
                  tooltip="This will be used for attendance tracking"
                >
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
                    <Button
                      type="default"
                      size="large"
                      onClick={handleRegenerateStaffId}
                    >
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
          
          <Form
            form={departmentForm}
            layout="vertical"
          >
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item 
                  label="Department *" 
                  name="department"
                  rules={[{ required: true, message: 'Please select department' }]}
                  help="Required for attendance tracking and reporting"
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
                    {enrollmentResult?.faceEmbeddingSaved ? `Extracted ✓ (${enrollmentResult?.embeddingLength} values)` : 'Not Extracted'}
                  </Tag>
                </p>
                <p><strong>Verification:</strong> 
                  <Tag color={enrollmentResult?.verification?.embeddingPresent ? "green" : "red"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.verification?.embeddingPresent ? 'Verified ✓' : 'Not Verified'}
                  </Tag>
                </p>
                <p><strong>Local Storage:</strong> 
                  <Tag color={enrollmentResult?.localStorageSaved ? "green" : "gray"} style={{ marginLeft: 8 }}>
                    {enrollmentResult?.localStorageSaved ? 'Backup Saved' : 'No Backup'}
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
                // Generate new staff ID for next staff
                const newStaffId = generateStaffId();
                setStaffId(newStaffId);
                form.setFieldValue('staff_id', newStaffId);
                
                setCurrentStep(0);
                setEnrollmentComplete(false);
                setEnrollmentResult(null);
                form.resetFields();
                departmentForm.resetFields();
                setStaffData({});
                setIsCameraActive(false);
                
                // Reset to initial values
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
                  onClick={() => window.location.href = '/staff'}
                >
                  View All Staff
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
        <div style={{ textAlign: 'center' }}>
          <Alert
            message="Face Enrollment"
            description="Capture facial data for biometric authentication. Ensure good lighting and face the camera directly."
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          {staffData.name && (
            <Card style={{ marginBottom: 20, maxWidth: 600, margin: '0 auto 20px' }}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Text strong>Staff: </Text>
                  <br />
                  <Text>{staffData.name}</Text>
                </Col>
                <Col span={8}>
                  <Text strong>Staff ID: </Text>
                  <br />
                  <Tag color="blue">{staffId}</Tag>
                </Col>
                <Col span={8}>
                  <Text strong>Status: </Text>
                  <br />
                  <Tag color="orange">Pending Face Enrollment</Tag>
                </Col>
              </Row>
              {staffData.department && (
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <Text strong>Department: </Text>
                    <br />
                    <Tag 
                      color="blue" 
                      style={{ 
                        marginTop: '8px',
                        backgroundColor: departments.find(d => d.value === staffData.department)?.color || '#1890ff',
                        color: 'white'
                      }}
                    >
                      {staffData.department?.toUpperCase()}
                    </Tag>
                  </Col>
                </Row>
              )}
            </Card>
          )}
          
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {isCameraActive ? (
              <FaceCamera
                mode="enrollment"
                staff={{
                  id: staffData.staff_id || staffId,
                  name: staffData.name,
                  staff_id: staffData.staff_id || staffId,
                  department: staffData.department
                }}
                onEnrollmentComplete={handleEnrollmentComplete}
              />
            ) : (
              <Card>
                <Camera size={48} style={{ marginBottom: 20, color: '#1890ff' }} />
                <Title level={4}>Ready for Face Capture</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
                  Ensure good lighting and face the camera directly. Click below to start.
                </Text>
                <Button
                  type="primary"
                  size="large"
                  icon={<Camera size={20} />}
                  onClick={() => setIsCameraActive(true)}
                  loading={loading}
                  style={{ marginBottom: 10 }}
                >
                  Start Face Enrollment
                </Button>
                
                <div style={{ marginTop: 20 }}>
                  <Alert
                    type="warning"
                    message="Important for Attendance"
                    description="Face data and embedding are required for biometric attendance marking. Please ensure good lighting and a clear face view."
                    style={{ marginBottom: 20 }}
                  />
                  
                  <div style={{ marginTop: 20 }}>
                    <Button onClick={handleBack}>
                      Back to Previous Step
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Staff Face Enrollment</Title>
      <Text type="secondary">
        Nigeram Ventures - Biometric Staff Enrollment System
      </Text>

      <Card style={{ marginTop: 20 }}>
        <Steps 
          current={currentStep} 
          style={{ marginBottom: 40 }}
          items={stepItems.map((item, index) => ({
            key: index,
            title: window.innerWidth < 768 ? '' : item.title,
            icon: item.icon,
          }))}
        />

        <div style={{ minHeight: 400 }}>
          {stepItems[currentStep].content}
        </div>

        {!enrollmentComplete && currentStep < 2 && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Space>
              {currentStep > 0 && (
                <Button onClick={handleBack} size="large">
                  Back
                </Button>
              )}
              <Button 
                type="primary" 
                onClick={handleNext} 
                size="large"
                loading={loading}
              >
                {currentStep === 1 ? 'Proceed to Face Enrollment' : 'Next'}
              </Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
};

export default EnrollmentPage;