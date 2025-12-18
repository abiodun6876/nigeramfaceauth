// src/pages/EnrollmentPage.tsx - MOBILE RESPONSIVE VERSION
import React, { useState, useEffect, useCallback } from 'react';
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
  DatePicker,
  Spin
} from 'antd';
import { Camera, User, BookOpen, CheckCircle, Mail, Phone, GraduationCap, Building, Calendar, Book, Layers, Clock } from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import { Student, Faculty, Department, Level, Program, AcademicSession, Semester } from '../types/database';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface EnrollmentFormData {
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  faculty_id?: string;
  department_id?: string;
  program_id?: string;
  current_level_id?: string;
  current_semester_id?: string;
  academic_session_id?: string;
  admission_year: string;
  matric_number?: string;
  year_of_entry: string;
}

const EnrollmentPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [studentData, setStudentData] = useState<Partial<EnrollmentFormData>>({});
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [form] = Form.useForm();
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);

  const fetchAcademicData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching academic data...');
      
      const [
        facultiesRes,
        levelsRes,
        sessionsRes,
        programsRes,
        semestersRes
      ] = await Promise.all([
        supabase.from('faculties').select('*').eq('is_active', true).order('name'),
        supabase.from('levels').select('*').eq('is_active', true).order('level_order'),
        supabase.from('academic_sessions').select('*').eq('is_active', true).order('start_date', { ascending: false }),
        supabase.from('programs').select('*').eq('is_active', true).order('name'),
        supabase.from('semesters').select('*').eq('is_active', true).order('semester_number')
      ]);

      if (!facultiesRes.error) setFaculties(facultiesRes.data || []);
      if (!levelsRes.error) setLevels(levelsRes.data || []);
      if (!sessionsRes.error) setSessions(sessionsRes.data || []);
      if (!programsRes.error) setPrograms(programsRes.data || []);
      if (!semestersRes.error) {
        setSemesters(semestersRes.data || []);
      }

      if (programsRes.data?.length === 0) {
        await createDefaultPrograms();
        const { data: newPrograms } = await supabase
          .from('programs')
          .select('*')
          .eq('is_active', true)
          .order('name');
        setPrograms(newPrograms || []);
      }

    } catch (error) {
      console.error('Error fetching academic data:', error);
      message.error('Failed to load academic data');
    } finally {
      setLoading(false);
    }
  }, []);

  const createDefaultPrograms = useCallback(async () => {
    try {
      console.log('Creating default programs...');
      const defaultPrograms = [
        {
          code: 'BSC-CS',
          name: 'Bachelor of Science in Computer Science',
          short_name: 'B.Sc CS',
          program_type: 'UNDERGRADUATE',
          duration_years: 4,
          is_active: true
        },
        {
          code: 'BSC-EE',
          name: 'Bachelor of Science in Electrical Engineering',
          short_name: 'B.Sc EE',
          program_type: 'UNDERGRADUATE',
          duration_years: 5,
          is_active: true
        },
        {
          code: 'BSC-ME',
          name: 'Bachelor of Science in Mechanical Engineering',
          short_name: 'B.Sc ME',
          program_type: 'UNDERGRADUATE',
          duration_years: 5,
          is_active: true
        },
        {
          code: 'BSC-CE',
          name: 'Bachelor of Science in Civil Engineering',
          short_name: 'B.Sc CE',
          program_type: 'UNDERGRADUATE',
          duration_years: 5,
          is_active: true
        },
        {
          code: 'MSC-CS',
          name: 'Master of Science in Computer Science',
          short_name: 'M.Sc CS',
          program_type: 'POSTGRADUATE',
          duration_years: 2,
          is_active: true
        },
        {
          code: 'MBA',
          name: 'Master of Business Administration',
          short_name: 'MBA',
          program_type: 'POSTGRADUATE',
          duration_years: 2,
          is_active: true
        }
      ];

      await supabase.from('programs').insert(defaultPrograms);

    } catch (error) {
      console.error('Error in createDefaultPrograms:', error);
    }
  }, []);

  useEffect(() => {
    fetchAcademicData();
  }, [fetchAcademicData]);

  const fetchDepartments = async (facultyId: string) => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('faculty_id', facultyId)
        .eq('is_active', true)
        .order('name');

      if (!error) {
        setDepartments(data || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleFacultyChange = (value: string) => {
    setSelectedFaculty(value);
    fetchDepartments(value);
    form.setFieldValue('department_id', undefined);
    form.setFieldValue('program_id', undefined);
  };

  const handleSessionChange = (value: string) => {
    form.setFieldValue('current_semester_id', undefined);
  };

  const generateMatricNumber = () => {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ABU${currentYear}${randomNum}`;
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      try {
        await form.validateFields();
        const values = form.getFieldsValue();
        
        if (!values.matric_number) {
          values.matric_number = generateMatricNumber();
          form.setFieldValue('matric_number', values.matric_number);
        }

        setStudentData(values);
        setCurrentStep(1);
      } catch (error) {
        console.error('Form validation failed:', error);
      }
    } else {
      try {
        await form.validateFields([
          'faculty_id', 
          'department_id', 
          'program_id', 
          'current_level_id', 
          'academic_session_id',
          'current_semester_id',
          'admission_year'
        ]);
        setCurrentStep(2);
      } catch (error) {
        console.error('Form validation failed:', error);
        message.error('Please fill all required academic fields');
      }
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleEnrollmentComplete = async (result: any) => {
    if (result.success) {
      try {
        const formValues = form.getFieldsValue();
        
        const selectedProgram = programs.find(p => p.id === formValues.program_id);
        const selectedLevel = levels.find(l => l.id === formValues.current_level_id);
        const selectedSession = sessions.find(s => s.id === formValues.academic_session_id);
        const selectedSemester = semesters.find(s => s.id === formValues.current_semester_id);

        const completeStudentData = {
          ...studentData,
          ...formValues,
          program_name: selectedProgram?.name,
          level_code: selectedLevel?.code,
          session_year: selectedSession?.session_year,
          semester_number: selectedSemester?.semester_number,
          enrollment_status: 'enrolled' as const,
          face_enrolled_at: new Date().toISOString(),
          enrollment_date: new Date().toISOString(),
          is_active: true
        };

        const { data, error } = await supabase
          .from('students')
          .insert(completeStudentData)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          await supabase.from('student_academic_history').insert({
            student_id: data.id,
            academic_session_id: completeStudentData.academic_session_id,
            level_id: completeStudentData.current_level_id,
            semester_id: completeStudentData.current_semester_id,
            program_id: completeStudentData.program_id,
            status: 'ACTIVE',
            created_at: new Date().toISOString()
          });
        }

        setEnrollmentComplete(true);
        message.success('Student enrollment completed successfully!');

      } catch (error: any) {
        console.error('Enrollment error:', error);
        message.error(`Failed to save student record: ${error.message || 'Unknown error'}`);
      }
    } else {
      message.error(`Face enrollment failed: ${result.message}`);
    }
  };

  const getAvailableSemesters = () => {
    const selectedSessionId = form.getFieldValue('academic_session_id');
    
    if (selectedSessionId) {
      return semesters.filter(s => 
        s.academic_session_id === null || 
        s.academic_session_id === selectedSessionId
      );
    }
    
    return semesters;
  };

  // Updated Steps configuration with mobile-responsive columns
  const stepItems = [
    {
      title: 'Personal Information',
      icon: <User />,
      content: (
        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 800, margin: '0 auto' }}
          initialValues={{
            gender: 'male',
            admission_year: new Date().getFullYear().toString(),
            year_of_entry: new Date().getFullYear().toString()
          }}
        >
          {/* Mobile responsive: xs=24 (full width), md=12 (half width on desktop) */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Matriculation Number"
                name="matric_number"
                rules={[{ required: true, message: 'Please enter matric number' }]}
              >
                <Input 
                  placeholder="e.g., ABU24001" 
                  prefix={<GraduationCap size={16} />}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Full Name"
                name="name"
                rules={[{ required: true, message: 'Please enter student name' }]}
              >
                <Input placeholder="Enter full name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter valid email' }
                ]}
              >
                <Input 
                  placeholder="student@abuad.edu.ng" 
                  prefix={<Mail size={16} />}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Phone Number"
                name="phone"
                rules={[
                  { required: true, message: 'Please enter phone number' },
                  { pattern: /^[+]?[\d\s-]+$/, message: 'Please enter valid phone number' }
                ]}
              >
                <Input 
                  placeholder="+234 800 000 0000" 
                  prefix={<Phone size={16} />}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Gender, Date of Birth, Year of Entry - Stack on mobile */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item label="Gender" name="gender">
                <Select placeholder="Select gender">
                  <Select.Option value="male">Male</Select.Option>
                  <Select.Option value="female">Female</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Date of Birth" name="date_of_birth">
                <DatePicker 
                  style={{ width: '100%' }}
                  placeholder="Select date of birth"
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Year of Entry"
                name="year_of_entry"
                rules={[{ required: true, message: 'Please enter year of entry' }]}
              >
                <Input 
                  placeholder="e.g., 2024" 
                  type="number"
                  min="2000"
                  max={new Date().getFullYear()}
                  prefix={<Calendar size={16} />}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      ),
    },
    {
      title: 'Academic Details',
      icon: <BookOpen />,
      content: loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <Text style={{ display: 'block', marginTop: 20 }}>Loading academic data...</Text>
        </div>
      ) : (
        <Form layout="vertical" style={{ maxWidth: 800, margin: '0 auto' }}>
          {programs.length === 0 && (
            <Alert
              message="No Programs Found"
              description="Default programs have been created. Please refresh the page."
              type="warning"
              showIcon
              style={{ marginBottom: 20 }}
              action={
                <Button size="small" onClick={fetchAcademicData}>
                  Refresh
                </Button>
              }
            />
          )}

          <Alert
            message="Faculty and Program Information"
            description="Select the faculty, department, and program for this student"
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />

          {/* Faculty and Department - Stack on mobile */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Faculty"
                name="faculty_id"
                rules={[{ required: true, message: 'Please select faculty' }]}
              >
                <Select
                  placeholder="Select faculty"
                  onChange={handleFacultyChange}
                  loading={loading}
                  options={faculties.map(f => ({
                    label: f.name,
                    value: f.id,
                  }))}
                  suffixIcon={<Building size={16} />}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Department"
                name="department_id"
                rules={[{ required: true, message: 'Please select department' }]}
              >
                <Select
                  placeholder="Select department"
                  disabled={!selectedFaculty}
                  loading={loading}
                  options={departments.map(d => ({
                    label: d.name,
                    value: d.id,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Program and Level - Stack on mobile */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Program"
                name="program_id"
                rules={[{ required: true, message: 'Please select program' }]}
              >
                <Select
                  placeholder="Select program"
                  loading={loading}
                  options={programs.map(p => ({
                    label: p.name,
                    value: p.id,
                  }))}
                  suffixIcon={<Book size={16} />}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Level"
                name="current_level_id"
                rules={[{ required: true, message: 'Please select level' }]}
              >
                <Select
                  placeholder="Select level"
                  loading={loading}
                  options={levels.map(l => ({
                    label: `${l.code} - ${l.name}`,
                    value: l.id,
                  }))}
                  suffixIcon={<Layers size={16} />}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Academic Session and Current Semester - Stack on mobile */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Academic Session"
                name="academic_session_id"
                rules={[{ required: true, message: 'Please select academic session' }]}
              >
                <Select
                  placeholder="Select academic session"
                  onChange={handleSessionChange}
                  loading={loading}
                  options={sessions.map(s => ({
                    label: s.session_year,
                    value: s.id,
                  }))}
                  suffixIcon={<Calendar size={16} />}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Current Semester"
                name="current_semester_id"
                rules={[{ required: true, message: 'Please select semester' }]}
              >
                <Select
                  placeholder="Select semester"
                  loading={loading}
                  options={getAvailableSemesters().map(s => ({
                    label: s.name,
                    value: s.id,
                    disabled: !s.is_current && form.getFieldValue('academic_session_id')
                  }))}
                  suffixIcon={<Clock size={16} />}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Admission Year - Full width on all devices */}
          <Row gutter={[16, 16]}>
            <Col xs={24}>
              <Form.Item
                label="Admission Year"
                name="admission_year"
                rules={[{ required: true, message: 'Please enter admission year' }]}
              >
                <Input 
                  placeholder="e.g., 2024" 
                  type="number"
                  min="2000"
                  max={new Date().getFullYear()}
                  prefix={<Calendar size={16} />}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      ),
    },
    {
      title: 'Face Enrollment',
      icon: <Camera />,
      content: (
        <div style={{ textAlign: 'center' }}>
          {enrollmentComplete ? (
            <div style={{ padding: '40px 0' }}>
              <CheckCircle size={64} color="#52c41a" />
              <Title level={3} style={{ marginTop: 20 }}>
                Enrollment Complete!
              </Title>
              <Card style={{ maxWidth: 500, margin: '20px auto', textAlign: 'left' }}>
                <Title level={4}>Student Summary</Title>
                <p><strong>Name:</strong> {studentData.name}</p>
                <p><strong>Matric Number:</strong> {studentData.matric_number}</p>
                <p><strong>Program:</strong> {programs.find(p => p.id === studentData.program_id)?.name}</p>
                <p><strong>Level:</strong> {levels.find(l => l.id === studentData.current_level_id)?.name}</p>
                <p><strong>Academic Session:</strong> {sessions.find(s => s.id === studentData.academic_session_id)?.session_year}</p>
                <p><strong>Semester:</strong> {semesters.find(s => s.id === studentData.current_semester_id)?.name}</p>
              </Card>
              <div style={{ marginTop: 30 }}>
                <Button
                  type="primary"
                  onClick={() => {
                    setCurrentStep(0);
                    setEnrollmentComplete(false);
                    form.resetFields();
                    setStudentData({});
                    setSelectedFaculty('');
                    setDepartments([]);
                  }}
                >
                  Enroll Another Student
                </Button>
                <Button
                  style={{ marginLeft: 10 }}
                  onClick={() => window.location.href = '/students'}
                >
                  View All Students
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Alert
                title="Face Enrollment Instructions"
                description={
                  <div style={{ textAlign: 'left' }}>
                    <p>1. Ensure good lighting and face the camera directly</p>
                    <p>2. Remove glasses, hats, or anything covering your face</p>
                    <p>3. Keep a neutral expression and stay still</p>
                    <p>4. The system will capture multiple images for accuracy</p>
                    <p>5. Make sure your entire face is visible in the frame</p>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 20, textAlign: 'left' }}
              />
              
              {studentData.name && (
                <Card style={{ marginBottom: 20, maxWidth: 600, margin: '0 auto 20px' }}>
                  {/* Student summary - Stack on mobile */}
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Text strong>Student: </Text>
                      <Text>{studentData.name}</Text>
                    </Col>
                    <Col xs={24} md={12}>
                      <Text strong>Matric: </Text>
                      <Text>{studentData.matric_number}</Text>
                    </Col>
                  </Row>
                  <Row gutter={[16, 16]} style={{ marginTop: 10 }}>
                    <Col xs={24}>
                      <Text strong>Program: </Text>
                      <Text>
                        {programs.find(p => p.id === studentData.program_id)?.name || 'Not selected'}
                      </Text>
                    </Col>
                  </Row>
                </Card>
              )}
              
              <div style={{ maxWidth: 640, margin: '0 auto' }}>
                <FaceCamera
                  mode="enrollment"
                  student={studentData as any}
                  onEnrollmentComplete={handleEnrollmentComplete}
                />
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Student Face Enrollment</Title>
      <Text type="secondary">
        AFE Babalola University - Face Authentication System
      </Text>

     <Card style={{ marginTop: 20 }}>
  <Steps 
    current={currentStep} 
    style={{ marginBottom: 40 }}
    responsive={false}
    className="enrollment-steps"
    items={stepItems.map((item, index) => ({
      key: index,
      title: (
        <span className={window.innerWidth < 576 ? 'mobile-step-title' : ''}>
          {item.title}
        </span>
      ),
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
                loading={loading && currentStep === 1}
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