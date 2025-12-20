// src/pages/CourseManagement.tsx
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Form, 
  Input, 
  Select, 
  Modal, 
  message, 
  Tag, 
  Space,
  Typography,
  Row,
  Col
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;

const CourseManagement: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchCourses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('course_code', { ascending: true });
    
    if (error) {
      message.error('Failed to fetch courses');
      console.error(error);
    } else {
      setCourses(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    
    const courseData = {
      ...values,
      updated_at: new Date().toISOString()
    };

    if (editingCourse) {
      // Update existing course
      const { error } = await supabase
        .from('courses')
        .update(courseData)
        .eq('id', editingCourse.id);
      
      if (error) {
        message.error('Failed to update course');
      } else {
        message.success('Course updated successfully');
        fetchCourses();
        setModalVisible(false);
        setEditingCourse(null);
        form.resetFields();
      }
    } else {
      // Create new course
      const { error } = await supabase
        .from('courses')
        .insert([courseData]);
      
      if (error) {
        message.error('Failed to create course');
      } else {
        message.success('Course created successfully');
        fetchCourses();
        setModalVisible(false);
        form.resetFields();
      }
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Delete Course',
      content: 'Are you sure you want to delete this course?',
      onOk: async () => {
        const { error } = await supabase
          .from('courses')
          .delete()
          .eq('id', id);
        
        if (error) {
          message.error('Failed to delete course');
        } else {
          message.success('Course deleted successfully');
          fetchCourses();
        }
      }
    });
  };

  const columns = [
    {
      title: 'Course Code',
      dataIndex: 'course_code',
      key: 'course_code',
    },
    {
      title: 'Course Name',
      dataIndex: 'course_name',
      key: 'course_name',
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      render: (level: number) => `${level} Level`,
    },
    {
      title: 'Semester',
      dataIndex: 'semester',
      key: 'semester',
      render: (semester: number) => `Semester ${semester}`,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingCourse(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          >
            Edit
          </Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDelete(record.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Title level={2}>Course Management</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingCourse(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            Add Course
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={courses}
          loading={loading}
          rowKey="id"
        />

        <Modal
          title={editingCourse ? 'Edit Course' : 'Add New Course'}
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            setEditingCourse(null);
            form.resetFields();
          }}
          onOk={() => form.submit()}
          confirmLoading={loading}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              level: 100,
              semester: 1
            }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Course Code"
                  name="course_code"
                  rules={[{ required: true, message: 'Please enter course code' }]}
                >
                  <Input placeholder="e.g., ACC101" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Level"
                  name="level"
                  rules={[{ required: true, message: 'Please select level' }]}
                >
                  <Select>
                    <Select.Option value={100}>100 Level</Select.Option>
                    <Select.Option value={200}>200 Level</Select.Option>
                    <Select.Option value={300}>300 Level</Select.Option>
                    <Select.Option value={400}>400 Level</Select.Option>
                    <Select.Option value={500}>500 Level</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Course Name"
              name="course_name"
              rules={[{ required: true, message: 'Please enter course name' }]}
            >
              <Input placeholder="e.g., Principles of Accounting" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Semester"
                  name="semester"
                  rules={[{ required: true, message: 'Please select semester' }]}
                >
                  <Select>
                    <Select.Option value={1}>First Semester</Select.Option>
                    <Select.Option value={2}>Second Semester</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Academic Session"
                  name="academic_session"
                >
                  <Input placeholder="e.g., 2024/2025" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default CourseManagement;