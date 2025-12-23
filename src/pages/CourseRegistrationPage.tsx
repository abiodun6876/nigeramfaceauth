// src/pages/CourseRegistrationPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Typography,
  Space,
  Alert,
  Row,
  Col,
  Input,
  Tag,
  Select,
  Spin,
  Checkbox,
  message,
  Modal,
  Form,
  Popconfirm,
  Tooltip
} from 'antd';
import {
  Book,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  Plus,
  Users,
  Delete
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;
const { Search: AntdSearch } = Input;

const CourseRegistrationPage: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [studentId, setStudentId] = useState(''); // Changed from matricNumber
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [isSelectAll, setIsSelectAll] = useState(false);

  useEffect(() => {
    fetchCourses();
    fetchStudents();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*, department:departments(*)')
        .order('level');

      if (!error) {
        setCourses(data || []);
        console.log('Courses loaded:', data?.length);
      } else {
        console.error('Error fetching courses:', error);
        message.error('Failed to load courses');
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      message.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      // Updated to select the correct columns from your database
      const { data, error } = await supabase
        .from('students')
        .select('id, student_id, name, level, department_name, email, phone, program')
        .order('name');

      if (!error) {
        setStudents(data || []);
        console.log('Students loaded:', data?.length);
        console.log('Sample student:', data?.[0]);
      } else {
        console.error('Error fetching students:', error);
        message.error('Failed to load students');
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const findStudentById = async (id: string) => {
    try {
      setSearching(true);
      console.log('Searching for student ID:', id);
      
      // Clean the input
      const cleanId = id.trim().toUpperCase();
      console.log('Cleaned ID:', cleanId);
      
      // First try exact match on student_id
      console.log('Trying exact match on student_id...');
      let { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('student_id', cleanId);
      
      console.log('Exact match result:', { data, error });
      
      // If no exact match, try partial match
      if (!data || data.length === 0) {
        console.log('Trying partial match...');
        const { data: data2, error: error2 } = await supabase
          .from('students')
          .select('*')
          .ilike('student_id', `%${cleanId}%`);
        
        console.log('Partial match result:', { data2, error2 });
        data = data2;
        error = error2;
      }
      
      // If still no match, try searching by name
      if (!data || data.length === 0) {
        console.log('Trying name search...');
        const { data: data3, error: error3 } = await supabase
          .from('students')
          .select('*')
          .ilike('name', `%${cleanId}%`);
        
        console.log('Name search result:', { data3, error3 });
        data = data3;
        error = error3;
      }
      
      if (error) {
        console.error('Database error details:', error);
        message.error(`Database error: ${error.message}`);
        return null;
      }
      
      if (!data || data.length === 0) {
        console.log('No students found with any matching criteria');
        message.error(`No student found with ID: "${id}"`);
        return null;
      }
      
      if (data.length > 1) {
        console.warn('Multiple students found:', data);
        const matches = data.map(d => `${d.student_id || d.id} - ${d.name}`).join(', ');
        message.warning(`Multiple students found. Using: ${data[0].name}`);
      }
      
      const student = data[0];
      console.log('Successfully found student:', student);
      console.log('Student ID:', student.id);
      console.log('Student student_id:', student.student_id);
      console.log('Student name:', student.name);
      
      return student;
      
    } catch (error: any) {
      console.error('Error finding student:', error);
      message.error(`Search error: ${error.message}`);
      return null;
    } finally {
      setSearching(false);
    }
  };

  const fetchStudentEnrollments = async (studentId: string) => {
    try {
      setLoading(true);
      console.log('Fetching enrollments for student ID:', studentId);
      
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          course:courses(
            id,
            code,
            title,
            level,
            credit_units,
            lecturer_name,
            department_id
          )
        `)
        .eq('student_id', studentId) // This should match the student_id in enrollments table
        .eq('status', 'active')
        .order('enrollment_date', { ascending: false });

      if (error) {
        console.error('Error fetching enrollments:', error);
        message.error('Failed to load enrolled courses');
        return;
      }
      
      console.log('Enrollments loaded:', data);
      setEnrolledCourses(data || []);
      
      // Filter available courses (not enrolled and matching student level)
      const enrolledCourseIds = (data || []).map((e: any) => e.course_id);
      console.log('Enrolled course IDs:', enrolledCourseIds);
      
      const available = courses.filter(c => 
        !enrolledCourseIds.includes(c.id) && 
        c.level === selectedStudent?.level
      );
      
      console.log('Available courses:', available);
      setAvailableCourses(available);
      setSelectedCourses([]);
      setIsSelectAll(false);
      
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSearch = async () => {
    if (!studentId.trim()) {
      message.error('Please enter a student ID');
      return;
    }

    console.log('Starting search for:', studentId);
    
    const student = await findStudentById(studentId);
    if (student) {
      console.log('Setting selected student:', student);
      setSelectedStudent(student);
      // Use student.student_id for enrollment lookup (matches enrollments table)
      await fetchStudentEnrollments(student.student_id || student.id);
    } else {
      console.log('Student not found');
      setSelectedStudent(null);
      setEnrolledCourses([]);
      setAvailableCourses([]);
    }
  };

  const handleCourseSelect = (courseId: string, checked: boolean) => {
    if (checked) {
      setSelectedCourses([...selectedCourses, courseId]);
    } else {
      setSelectedCourses(selectedCourses.filter(id => id !== courseId));
      setIsSelectAll(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setIsSelectAll(checked);
    if (checked) {
      const allCourseIds = availableCourses.map(course => course.id);
      setSelectedCourses(allCourseIds);
    } else {
      setSelectedCourses([]);
    }
  };

  const enrollInCourses = async () => {
    if (!selectedStudent) {
      message.error('Please select a student first');
      return;
    }

    if (selectedCourses.length === 0) {
      message.error('Please select at least one course');
      return;
    }

    try {
      const enrollments = selectedCourses.map(courseId => ({
        student_id: selectedStudent.student_id || selectedStudent.id, // Use student_id for enrollments
        course_id: courseId,
        enrollment_date: new Date().toISOString().split('T')[0],
        academic_session: '2024/2025',
        status: 'active'
      }));

      console.log('Enrolling courses:', enrollments);

      const { data, error } = await supabase
        .from('enrollments')
        .insert(enrollments)
        .select();

      if (error) {
        console.error('Enrollment database error:', error);
        throw error;
      }

      console.log('Enrollment successful:', data);
      message.success(`Successfully enrolled in ${selectedCourses.length} course(s)`);
      
      // Refresh data
      await fetchStudentEnrollments(selectedStudent.student_id || selectedStudent.id);
      
    } catch (error: any) {
      console.error('Enrollment error:', error);
      message.error(`Failed to enroll: ${error.message || 'Unknown error'}`);
    }
  };

  const unenrollCourse = async (enrollmentId: string) => {
    try {
      console.log('Unenrolling enrollment:', enrollmentId);
      
      const { error } = await supabase
        .from('enrollments')
        .update({ 
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', enrollmentId);

      if (error) {
        console.error('Unenrollment database error:', error);
        throw error;
      }

      message.success('Course unenrolled successfully');
      await fetchStudentEnrollments(selectedStudent?.student_id || selectedStudent?.id || '');
      
    } catch (error: any) {
      console.error('Unenrollment error:', error);
      message.error(`Failed to unenroll: ${error.message || 'Unknown error'}`);
    }
  };

  const columns = [
    {
      title: 'Course Code',
      dataIndex: ['course', 'code'],
      key: 'code',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Course Title',
      dataIndex: ['course', 'title'],
      key: 'title',
    },
    {
      title: 'Level',
      dataIndex: ['course', 'level'],
      key: 'level',
      render: (level: number) => `Level ${level}`,
    },
    {
      title: 'Credit Units',
      dataIndex: ['course', 'credit_units'],
      key: 'credits',
    },
    {
      title: 'Enrollment Date',
      dataIndex: 'enrollment_date',
      key: 'date',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Popconfirm
          title="Are you sure you want to unenroll from this course?"
          onConfirm={() => unenrollCourse(record.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button
            danger
            size="small"
            icon={<Delete size={14} />}
          >
            Unenroll
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Student Course Enrollment</Title>
      <Text type="secondary">
        Enroll students in courses
      </Text>

      <Card style={{ marginTop: 20 }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} md={12}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="Enter Student ID (e.g., ABU/2024/001 or ABU24007)"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                onPressEnter={handleStudentSearch}
                allowClear
                disabled={searching}
              />
              <Button 
                type="primary" 
                onClick={handleStudentSearch}
                loading={searching}
                icon={<Search size={16} />}
              >
                {searching ? 'Searching...' : 'Search'}
              </Button>
            </Space.Compact>
            <Text type="secondary" style={{ fontSize: '12px', marginTop: 4, display: 'block' }}>
              Enter student ID or name (case-insensitive)
            </Text>
          </Col>
          <Col xs={24} md={12}>
            {selectedStudent && (
              <Alert
                message={
                  <div>
                    <strong>Selected Student:</strong> {selectedStudent.name}
                  </div>
                }
                description={
                  <div>
                    <div><strong>Student ID:</strong> {selectedStudent.student_id || selectedStudent.id}</div>
                    <div><strong>Level:</strong> {selectedStudent.level}</div>
                    <div><strong>Program:</strong> {selectedStudent.program || 'Not specified'}</div>
                    <div><strong>Department:</strong> {selectedStudent.department_name || 'Not specified'}</div>
                  </div>
                }
                type="info"
                showIcon
              />
            )}
          </Col>
        </Row>

        {students.length === 0 && !loading ? (
          <Alert
            message="No students found in database"
            description="Please add students first before attempting course enrollment."
            type="warning"
            showIcon
            style={{ marginBottom: 20 }}
          />
        ) : selectedStudent ? (
          <>
            <div style={{ marginBottom: 30 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}>
                  Available Courses (Level {selectedStudent.level})
                  {availableCourses.length > 0 && ` - ${availableCourses.length} available`}
                </Title>
                <Space>
                  <Checkbox
                    checked={isSelectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={availableCourses.length === 0}
                  >
                    Select All
                  </Checkbox>
                  <Button
                    type="primary"
                    icon={<Plus size={16} />}
                    onClick={enrollInCourses}
                    disabled={selectedCourses.length === 0}
                    loading={loading}
                  >
                    Enroll Selected ({selectedCourses.length})
                  </Button>
                </Space>
              </div>
              
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: 16 }}>Loading courses...</div>
                </div>
              ) : availableCourses.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {availableCourses.map(course => (
                    <Col xs={24} md={12} lg={8} key={course.id}>
                      <Card size="small" hoverable style={{ height: '100%' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <Checkbox
                            checked={selectedCourses.includes(course.id)}
                            onChange={(e) => handleCourseSelect(course.id, e.target.checked)}
                            style={{ marginTop: 4 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <Text strong style={{ display: 'block', fontSize: '14px' }}>
                                  {course.code}
                                </Text>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  {course.title}
                                </Text>
                              </div>
                              <Tag color="blue" style={{ margin: 0 }}>
                                Level {course.level}
                              </Tag>
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <Tag color="green" style={{ fontSize: '11px' }}>
                                {course.credit_units} Credits
                              </Tag>
                              {course.lecturer_name && (
                                <Tag color="purple" style={{ fontSize: '11px' }}>
                                  {course.lecturer_name}
                                </Tag>
                              )}
                            </div>
                            {course.department?.name && (
                              <div style={{ marginTop: 8 }}>
                                <Text style={{ fontSize: '11px', color: '#666' }}>
                                  Department: {course.department.name}
                                </Text>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Alert
                  message="No available courses"
                  description="All courses for this level have been enrolled or no courses exist for this level."
                  type="info"
                  showIcon
                />
              )}
            </div>

            <div>
              <Title level={4}>
                Enrolled Courses
                {enrolledCourses.length > 0 && ` (${enrolledCourses.length} courses)`}
              </Title>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Spin />
                </div>
              ) : (
                <Table
                  columns={columns}
                  dataSource={enrolledCourses}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 5 }}
                  locale={{
                    emptyText: 'No courses enrolled yet'
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <User size={48} style={{ color: '#d9d9d9', marginBottom: 16 }} />
            <Text type="secondary">Enter a student ID or name to search for a student</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 8 }}>
              Examples: "ABU/2024/001" or "John Student"
            </Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CourseRegistrationPage;