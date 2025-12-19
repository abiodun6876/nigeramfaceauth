// src/pages/EnrollmentPage.tsx - UPDATED FOR YOUR DATABASE SCHEMA
import React, { useState } from 'react';
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
  Spin,
  Tag
} from 'antd';
import { Camera, User, BookOpen, CheckCircle, Mail, Phone, GraduationCap } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;

const EnrollmentPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [studentData, setStudentData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const generateMatricNumber = () => {
    const currentYear = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ABU/${currentYear}/${randomNum}`;
  };

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['name', 'matric_number']);
        const values = form.getFieldsValue();
        
        if (!values.matric_number) {
          values.matric_number = generateMatricNumber();
          form.setFieldValue('matric_number', values.matric_number);
        }

        setStudentData(values);
        setCurrentStep(1);
      } else if (currentStep === 1) {
        setCurrentStep(2);
      }
    } catch (error: any) {
      console.error('Form validation failed:', error);
      if (error.errorFields) {
        const errorMessages = error.errorFields.map((field: any) => field.errors[0]).join(', ');
        message.error(`Please fix: ${errorMessages}`);
      } else {
        message.error('Please fill all required fields');
      }
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleEnrollmentComplete = async (result: any) => {
    console.log('Face capture result:', result);
    
    if (result.success) {
      try {
        setLoading(true);
        const formValues = form.getFieldsValue();
        
        // Check if student with this matric number or student_id already exists
        const { data: existingStudent, error: checkError } = await supabase
          .from('students')
          .select('*')
          .or(`matric_number.eq.${formValues.matric_number},student_id.eq.${formValues.matric_number}`)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.log('Check query result:', checkError);
        }

        if (existingStudent) {
          message.error('A student with this matric number already exists!');
          setLoading(false);
          return;
        }

        // Prepare student data according to your database schema
        // Based on your data: student_id is the main identifier, matric_number is separate
        const studentRecord: Record<string, any> = {
          student_id: formValues.matric_number, // This should be unique
          name: formValues.name,
          matric_number: formValues.matric_number, // Store separately too
          email: formValues.email || null,
          phone: formValues.phone || null,
          gender: formValues.gender || null,
          enrollment_status: 'enrolled',
          face_match_threshold: 0.7,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Add face enrollment data if available
        if (result.success) {
          studentRecord.face_embedding = result.embedding || [];
          studentRecord.photo_url = result.photoUrl || null;
          studentRecord.face_enrolled_at = new Date().toISOString();
        }

        console.log('Saving student data:', studentRecord);

        // Save to database
        const { data: student, error: studentError } = await supabase
          .from('students')
          .insert([studentRecord])
          .select()
          .single();

        if (studentError) {
          console.error('Database error:', studentError);
          
          // Try without the embedding if it fails
          if (studentError.message.includes('embedding')) {
            const simpleRecord = { ...studentRecord };
            delete simpleRecord.face_embedding;
            
            const { data: student2, error: studentError2 } = await supabase
              .from('students')
              .insert([simpleRecord])
              .select()
              .single();
              
            if (studentError2) {
              throw new Error(`Failed to save student: ${studentError2.message}`);
            }
            
            // Save face data to separate table
            if (student2 && result.embedding) {
              await saveFaceData(student2.id, result);
            }
            
            setEnrollmentResult({ success: true, student: student2 });
            setEnrollmentComplete(true);
            message.success('Student enrolled successfully!');
            return;
          }
          
          throw new Error(`Database error: ${studentError.message}`);
        }

        console.log('Student saved successfully:', student);

        // Save face data to separate table if needed
        if (student && result.embedding) {
          await saveFaceData(student.id, result);
        }

        setEnrollmentResult({ success: true, student });
        setEnrollmentComplete(true);
        message.success('Student enrolled successfully!');

      } catch (error: any) {
        console.error('Enrollment error:', error);
        message.error(`Failed to save student: ${error.message || 'Unknown error'}`);
        
        setEnrollmentResult({
          success: false,
          message: error.message || 'Failed to save student data'
        });
      } finally {
        setLoading(false);
      }
    } else {
      message.error(`Face capture failed: ${result.message}`);
      setEnrollmentResult(result);
    }
  };

  const saveFaceData = async (studentId: string, result: any) => {
    try {
      // First check if face_enrollments table exists
      const { data: tableExists } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'face_enrollments')
        .single();

      if (!tableExists) {
        console.log('face_enrollments table does not exist, skipping...');
        return;
      }

      const faceData: Record<string, any> = {
        student_id: studentId,
        enrolled_at: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add optional fields if they exist
      if (result.embedding && result.embedding.length > 0) {
        faceData.embedding = result.embedding;
      }
      if (result.photoUrl) {
        faceData.photo_url = result.photoUrl;
      }
      if (result.quality) {
        faceData.quality_score = result.quality;
      }

      console.log('Saving face data:', faceData);

      const { error: faceError } = await supabase
        .from('face_enrollments')
        .insert([faceData]);

      if (faceError) {
        console.error('Face enrollment save error:', faceError);
        // Don't throw - this is optional
      }
    } catch (error) {
      console.error('Error saving face data:', error);
    }
  };

  // Add academic fields form
  const [academicForm] = Form.useForm();

  const handleAcademicSubmit = async () => {
    try {
      const values = await academicForm.validateFields();
      console.log('Academic values:', values);
      // Store academic data in studentData
      setStudentData((prev: any) => ({ ...prev, ...values }));
      message.success('Academic information saved');
      handleNext();
    } catch (error) {
      console.error('Academic form error:', error);
    }
  };

  const stepItems = [
    {
      title: 'Basic Information',
      icon: <User />,
      content: (
        <div>
          <Alert
            message="Student Information"
            description="Fill in the student's basic details. Matric number will be used as Student ID."
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          <Form
            form={form}
            layout="vertical"
            style={{ maxWidth: 600, margin: '0 auto' }}
            initialValues={{
              gender: 'male'
            }}
          >
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Full Name *"
                  name="name"
                  rules={[
                    { required: true, message: 'Please enter student name' },
                    { min: 3, message: 'Name must be at least 3 characters' }
                  ]}
                >
                  <Input 
                    placeholder="Enter student full name" 
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Matriculation Number *"
                  name="matric_number"
                  tooltip="This will also be used as Student ID"
                  rules={[
                    { required: true, message: 'Please enter matric number' },
                    { 
                      pattern: /^[A-Za-z0-9\/\-]+$/, 
                      message: 'Only letters, numbers, slashes and hyphens allowed' 
                    }
                  ]}
                >
                  <Input 
                    placeholder="e.g., ABU/2024/001" 
                    prefix={<GraduationCap size={16} />}
                    size="large"
                    style={{ textTransform: 'uppercase' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24} md={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { type: 'email', message: 'Please enter valid email' }
                  ]}
                >
                  <Input 
                    placeholder="student@abuad.edu.ng" 
                    prefix={<Mail size={16} />}
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col span={24} md={12}>
                <Form.Item
                  label="Phone Number"
                  name="phone"
                >
                  <Input 
                    placeholder="+2348000000000" 
                    prefix={<Phone size={16} />}
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item label="Gender" name="gender">
                  <Select placeholder="Select gender" size="large">
                    <Select.Option value="male">Male</Select.Option>
                    <Select.Option value="female">Female</Select.Option>
                    <Select.Option value="other">Other</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      ),
    },
    {
      title: 'Academic Details',
      icon: <BookOpen />,
      content: (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Alert
            message="Academic Information"
            description="Fill in the student's academic details (optional)"
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          <Form
            form={academicForm}
            layout="vertical"
            initialValues={{
              level: 100,
              semester: 1
            }}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Form.Item
                  label="Level"
                  name="level"
                >
                  <Select placeholder="Select level" size="large">
                    <Select.Option value={100}>100 Level</Select.Option>
                    <Select.Option value={200}>200 Level</Select.Option>
                    <Select.Option value={300}>300 Level</Select.Option>
                    <Select.Option value={400}>400 Level</Select.Option>
                    <Select.Option value={500}>500 Level</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Semester"
                  name="semester"
                >
                  <Select placeholder="Select semester" size="large">
                    <Select.Option value={1}>First Semester</Select.Option>
                    <Select.Option value={2}>Second Semester</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Academic Session"
                  name="academic_session"
                >
                  <Input 
                    placeholder="e.g., 2024/2025" 
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Program"
                  name="program"
                >
                  <Input 
                    placeholder="e.g., Computer Science" 
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ marginTop: 30, textAlign: 'center' }}>
              <Text type="secondary">
                Note: Faculty and department information can be added later from the student management page.
              </Text>
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
                <Title level={4}>Student Summary</Title>
                <p><strong>Name:</strong> {enrollmentResult.student?.name}</p>
                <p><strong>Student ID:</strong> 
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {enrollmentResult.student?.student_id}
                  </Tag>
                </p>
                <p><strong>Matric Number:</strong> 
                  <Tag color="green" style={{ marginLeft: 8 }}>
                    {enrollmentResult.student?.matric_number}
                  </Tag>
                </p>
                {enrollmentResult.student?.email && (
                  <p><strong>Email:</strong> {enrollmentResult.student.email}</p>
                )}
                <p><strong>Status:</strong> <Tag color="success">Enrolled</Tag></p>
                <p><strong>Face Enrolled:</strong> {enrollmentResult?.faceCaptured ? 'Yes' : 'No'}</p>
                <p><strong>Enrollment Date:</strong> {new Date().toLocaleDateString()}</p>
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
                Enrollment Failed
              </Title>
              <Alert
                message="Error"
                description={enrollmentResult?.message || 'Unknown error occurred'}
                type="error"
                showIcon
                style={{ maxWidth: 500, margin: '20px auto' }}
              />
            </>
          )}
          
          <Space style={{ marginTop: 30 }}>
            <Button
              type="primary"
              size="large"
              onClick={() => {
                setCurrentStep(0);
                setEnrollmentComplete(false);
                setEnrollmentResult(null);
                form.resetFields();
                academicForm.resetFields();
                setStudentData({});
                setIsCameraActive(false);
              }}
            >
              {enrollmentResult?.success ? 'Enroll Another Student' : 'Try Again'}
            </Button>
            {enrollmentResult?.success && (
              <>
                <Button 
                  size="large"
                  onClick={() => window.location.href = '/students'}
                >
                  View All Students
                </Button>
                <Button 
                  size="large"
                  type="default"
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
          
          {studentData.name && (
            <Card style={{ marginBottom: 20, maxWidth: 600, margin: '0 auto 20px' }}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Text strong>Student: </Text>
                  <br />
                  <Text>{studentData.name}</Text>
                </Col>
                <Col span={8}>
                  <Text strong>Student ID: </Text>
                  <br />
                  <Tag color="blue">{studentData.matric_number}</Tag>
                </Col>
                <Col span={8}>
                  <Text strong>Status: </Text>
                  <br />
                  <Tag color="orange">Pending Face Enrollment</Tag>
                </Col>
              </Row>
            </Card>
          )}
          
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {isCameraActive ? (
              <FaceCamera
                mode="enrollment"
                student={studentData}
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
                  <Text type="secondary" style={{ display: 'block', marginBottom: 10 }}>
                    Don't have a camera or having issues?
                  </Text>
                  <Button 
                    type="default"
                    onClick={() => {
                      // Simulate face enrollment for testing
                      handleEnrollmentComplete({
                        success: true,
                        message: 'Face enrollment simulated for testing',
                        embedding: [],
                        photoUrl: null
                      });
                    }}
                  >
                    Simulate Enrollment (Testing)
                  </Button>
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
      <Title level={2}>Student Face Enrollment</Title>
      <Text type="secondary">
        AFE Babalola University - Biometric Face Enrollment System
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
                onClick={currentStep === 1 ? handleAcademicSubmit : handleNext} 
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