// src/pages/ImageManagementPage.tsx - UPDATED WITH PROPER TYPES
import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
  Image as AntdImage,
  Tag,
  Tooltip,
  Select,
  message,
  Popconfirm,
  Empty,
  Divider,
  Progress,
  Badge,
  Upload
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined,
  CameraOutlined,
  UserOutlined,
  FilterOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import {
  Search,
  Eye,
  Trash2,
  Download,
  Upload as UploadIcon,
  RefreshCw,
  Camera,
  User,
  Filter,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Database,
  Cloud,
  Save,
  FolderOpen
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Student, FaceEnrollment } from '../types/database';

const { Title, Text } = Typography;
const { Search: AntdSearch } = Input;
const { confirm } = Modal;

// Create extended interface for local image tracking
interface FaceEnrollmentWithLocal extends FaceEnrollment {
  has_local_image?: boolean;
  local_storage_key?: string;
}

interface StudentWithImages extends Student {
  face_enrollments?: FaceEnrollmentWithLocal[];
  enrollment_count?: number;
  last_enrollment?: string;
  image_quality?: number;
}

// Local storage configuration
const LOCAL_STORAGE_PREFIX = 'face_images_';

// Helper functions for local image storage
const localImageStorage = {
  saveImage: (studentId: string, imageId: string, imageData: string): void => {
    try {
      const key = `${LOCAL_STORAGE_PREFIX}${studentId}_${imageId}`;
      // Compress if too large
      if (imageData.length > 100000) { // 100KB limit
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          // Resize to max 300x300
          let width = img.width;
          let height = img.height;
          const maxSize = 300;
          
          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          const compressedData = canvas.toDataURL('image/jpeg', 0.7);
          localStorage.setItem(key, compressedData);
        };
        img.src = imageData;
      } else {
        localStorage.setItem(key, imageData);
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  },

  getImage: (studentId: string, imageId: string): string | null => {
    try {
      const key = `${LOCAL_STORAGE_PREFIX}${studentId}_${imageId}`;
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error getting image from localStorage:', error);
      return null;
    }
  },

  deleteImage: (studentId: string, imageId: string): void => {
    try {
      const key = `${LOCAL_STORAGE_PREFIX}${studentId}_${imageId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error deleting image from localStorage:', error);
    }
  },

  deleteAllStudentImages: (studentId: string): void => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`${LOCAL_STORAGE_PREFIX}${studentId}_`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error deleting student images:', error);
    }
  },

  getStorageUsage: () => {
    try {
      let totalSize = 0;
      let imageCount = 0;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
          const value = localStorage.getItem(key) || '';
          totalSize += key.length + value.length;
          imageCount++;
        }
      }
      
      // Approximate size (base64 is about 33% larger than binary)
      const usedKB = Math.round((totalSize * 2) / 1024);
      const totalKB = 5 * 1024; // 5MB typical limit
      
      return { 
        used: usedKB, 
        total: totalKB,
        imageCount,
        percentage: Math.round((usedKB / totalKB) * 100)
      };
    } catch (error) {
      console.error('Error calculating storage:', error);
      return { used: 0, total: 0, imageCount: 0, percentage: 0 };
    }
  }
};

const ImageManagementPage: React.FC = () => {
  const [students, setStudents] = useState<StudentWithImages[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithImages[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentWithImages | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [selectedImage, setSelectedImage] = useState<FaceEnrollmentWithLocal | null>(null);
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 0, imageCount: 0, percentage: 0 });
  const [importLoading, setImportLoading] = useState(false);
  const [filters, setFilters] = useState({
    has_images: 'all' as 'all' | 'yes' | 'no' | 'local'
  });

  const fetchStudentsWithImages = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch students with their face enrollments
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          *,
          face_enrollments(*)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (studentsError) throw studentsError;

      // Process students to add image metadata
      const processedStudents: StudentWithImages[] = (studentsData || []).map(student => {
        // Check each enrollment for local images
        const enrollmentsWithLocalImages: FaceEnrollmentWithLocal[] = 
          (student.face_enrollments || []).map(enrollment => {
            const localImageKey = `${LOCAL_STORAGE_PREFIX}${student.id}_${enrollment.id}`;
            const hasLocalImage = !!localStorage.getItem(localImageKey);
            const localImageUrl = localStorage.getItem(localImageKey);
            
            return {
              ...enrollment,
              has_local_image: hasLocalImage,
              local_storage_key: localImageKey,
              // Use local image if available, otherwise use database URL
              photo_url: localImageUrl || enrollment.photo_url || ''
            };
          });

        return {
          ...student,
          face_enrollments: enrollmentsWithLocalImages,
          enrollment_count: enrollmentsWithLocalImages.length,
          last_enrollment: enrollmentsWithLocalImages[0]?.enrolled_at,
          image_quality: enrollmentsWithLocalImages[0]?.quality_score || 0
        };
      });

      setStudents(processedStudents);
      setFilteredStudents(processedStudents);
      
      // Update storage usage
      const storageInfo = localImageStorage.getStorageUsage();
      setStorageUsage(storageInfo);
      
    } catch (error) {
      console.error('Error fetching students with images:', error);
      message.error('Failed to load student images');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudentsWithImages();
  }, [fetchStudentsWithImages]);

  useEffect(() => {
    let result = students;
    
    // Apply search filter
    if (searchText) {
      result = result.filter(student =>
        student.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        student.matric_number?.toLowerCase().includes(searchText.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    // Apply image filters
    if (filters.has_images !== 'all') {
      switch (filters.has_images) {
        case 'yes':
          result = result.filter(student => (student.enrollment_count || 0) > 0);
          break;
        case 'no':
          result = result.filter(student => (student.enrollment_count || 0) === 0);
          break;
        case 'local':
          result = result.filter(student => 
            student.face_enrollments?.some(img => img.has_local_image)
          );
          break;
      }
    }
    
    setFilteredStudents(result);
  }, [searchText, filters, students]);

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handlePreview = (imageUrl: string, image?: FaceEnrollmentWithLocal) => {
    setPreviewImage(imageUrl);
    setSelectedImage(image || null);
    setPreviewVisible(true);
  };

  const handleViewStudentImages = (student: StudentWithImages) => {
    setSelectedStudent(student);
  };

  const handleDeleteImage = async (studentId: string, imageId: string) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from('face_enrollments')
        .delete()
        .eq('id', imageId);

      if (error) throw error;

      // Delete from localStorage
      localImageStorage.deleteImage(studentId, imageId);
      
      message.success('Image deleted successfully');
      fetchStudentsWithImages();
      
      // Refresh selected student if viewing their images
      if (selectedStudent?.id === studentId) {
        const updatedStudent = await fetchStudentDetails(studentId);
        setSelectedStudent(updatedStudent);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      message.error('Failed to delete image');
    }
  };

  const fetchStudentDetails = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          face_enrollments(*)
        `)
        .eq('id', studentId)
        .single();

      if (error) throw error;
      
      // Check for local images
      const enrollmentsWithLocalImages: FaceEnrollmentWithLocal[] = 
        (data.face_enrollments || []).map((enrollment: FaceEnrollment) => {
          const localImageKey = `${LOCAL_STORAGE_PREFIX}${studentId}_${enrollment.id}`;
          const hasLocalImage = !!localStorage.getItem(localImageKey);
          const localImageUrl = localStorage.getItem(localImageKey);
          
          return {
            ...enrollment,
            has_local_image: hasLocalImage,
            local_storage_key: localImageKey,
            photo_url: localImageUrl || enrollment.photo_url || ''
          };
        });

      return {
        ...data,
        face_enrollments: enrollmentsWithLocalImages,
        enrollment_count: enrollmentsWithLocalImages.length
      } as StudentWithImages;
    } catch (error) {
      console.error('Error fetching student details:', error);
      return null;
    }
  };

  const handleDeleteAllImages = async (studentId: string) => {
    confirm({
      title: 'Delete All Images',
      content: 'Are you sure you want to delete all face images for this student? This will delete from both database and local storage.',
      icon: <ExclamationCircleOutlined />,
      okText: 'Yes, Delete All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          // Delete from database
          const { error } = await supabase
            .from('face_enrollments')
            .delete()
            .eq('student_id', studentId);

          if (error) throw error;

          // Delete from localStorage
          localImageStorage.deleteAllStudentImages(studentId);
          
          message.success('All images deleted successfully');
          fetchStudentsWithImages();
          setSelectedStudent(null);
        } catch (error) {
          console.error('Error deleting all images:', error);
          message.error('Failed to delete images');
        }
      }
    });
  };

  const handleReEnrollStudent = (student: StudentWithImages) => {
    // Redirect to enrollment page with student data
    const enrollmentUrl = `/enroll?studentId=${student.id}`;
    window.location.href = enrollmentUrl;
  };

  const handleExportAllImages = () => {
    try {
      const exportData: any = {};
      
      students.forEach(student => {
        if (student.face_enrollments) {
          student.face_enrollments.forEach(enrollment => {
            if (enrollment.has_local_image && enrollment.local_storage_key) {
              const imageData = localStorage.getItem(enrollment.local_storage_key);
              if (imageData) {
                if (!exportData[student.id]) {
                  exportData[student.id] = {
                    name: student.name,
                    matric_number: student.matric_number,
                    images: {}
                  };
                }
                exportData[student.id].images[enrollment.id] = {
                  imageData,
                  quality_score: enrollment.quality_score,
                  enrolled_at: enrollment.enrolled_at,
                  capture_device: enrollment.capture_device
                };
              }
            }
          });
        }
      });

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `face_images_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success(`Exported ${Object.keys(exportData).length} students' images`);
    } catch (error) {
      console.error('Error exporting images:', error);
      message.error('Failed to export images');
    }
  };

  const handleImportImages = async (file: File) => {
    setImportLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importData = JSON.parse(e.target?.result as string);
          let importedCount = 0;
          
          Object.keys(importData).forEach(studentId => {
            const studentData = importData[studentId];
            Object.keys(studentData.images).forEach(imageId => {
              const imageInfo = studentData.images[imageId];
              const key = `${LOCAL_STORAGE_PREFIX}${studentId}_${imageId}`;
              localStorage.setItem(key, imageInfo.imageData);
              importedCount++;
            });
          });
          
          message.success(`Imported ${importedCount} images`);
          fetchStudentsWithImages();
        } catch (error) {
          console.error('Error parsing import file:', error);
          message.error('Invalid import file format');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Import error:', error);
      message.error('Failed to import images');
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadImage = (studentId: string, imageId: string, imageData: string) => {
    try {
      // Create download link
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `face_${studentId}_${imageId}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('Image downloaded');
    } catch (error) {
      console.error('Download error:', error);
      message.error('Failed to download image');
    }
  };

  const handleClearLocalStorage = () => {
    confirm({
      title: 'Clear All Local Images',
      content: 'This will delete all images stored in browser storage. Database records will remain.',
      icon: <ExclamationCircleOutlined />,
      okText: 'Clear All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        message.success('All local images cleared');
        fetchStudentsWithImages();
      }
    });
  };

  const columns = [
    {
      title: 'Student',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: StudentWithImages) => (
        <Space>
          <User size={16} style={{ color: '#1890ff' }} />
          <div>
            <Text strong>{text}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.matric_number}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Program',
      dataIndex: 'program_name',
      key: 'program',
      render: (text: string) => text || 'N/A',
    },
    {
      title: 'Face Images',
      dataIndex: 'enrollment_count',
      key: 'images',
      render: (count: number, record: StudentWithImages) => {
        const localCount = record.face_enrollments?.filter(img => img.has_local_image).length || 0;
        return (
          <Tooltip title={`${localCount} local / ${count} total`}>
            <Badge
              count={count}
              style={{ backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' }}
            />
            {localCount > 0 && (
              <Tag color="blue" style={{ marginLeft: 8, fontSize: 10 }}>
                {localCount} local
              </Tag>
            )}
          </Tooltip>
        );
      },
    },
    {
      title: 'Last Enrollment',
      dataIndex: 'last_enrollment',
      key: 'last_enrollment',
      render: (date: string) => date ? new Date(date).toLocaleDateString() : 'Never',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: StudentWithImages) => (
        <Space>
          <Tooltip title="View Images">
            <Button
              type="text"
              icon={<Eye size={16} />}
              onClick={() => handleViewStudentImages(record)}
              disabled={!record.enrollment_count}
            />
          </Tooltip>
          <Tooltip title="Re-enroll Face">
            <Button
              type="text"
              icon={<Camera size={16} />}
              onClick={() => handleReEnrollStudent(record)}
            />
          </Tooltip>
          {record.enrollment_count ? (
            <Popconfirm
              title="Delete all images for this student?"
              onConfirm={() => handleDeleteAllImages(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete All Images">
                <Button
                  type="text"
                  danger
                  icon={<Trash2 size={16} />}
                />
              </Tooltip>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const imageColumns = [
    {
      title: 'Preview',
      dataIndex: 'photo_url',
      key: 'preview',
      render: (url: string, record: FaceEnrollmentWithLocal) => (
        <div 
          style={{ 
            width: 60, 
            height: 60, 
            position: 'relative',
            cursor: 'pointer' 
          }} 
          onClick={() => handlePreview(url, record)}
        >
          <AntdImage
            src={url}
            alt="Face"
            width={60}
            height={60}
            style={{ 
              objectFit: 'cover', 
              borderRadius: 4,
              border: record.has_local_image ? '2px solid #52c41a' : '1px solid #d9d9d9'
            }}
            preview={false}
          />
          {record.has_local_image && (
            <Tag 
              color="green" 
              style={{ 
                position: 'absolute', 
                top: -8, 
                right: -8, 
                fontSize: 8,
                padding: '0 4px',
                lineHeight: '16px'
              }}
            >
              Local
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Quality',
      dataIndex: 'quality_score',
      key: 'quality',
      render: (score: number) => {
        const percentage = Math.round((score || 0) * 100);
        return (
          <Tooltip title={`${percentage}% quality score`}>
            <Tag color={percentage >= 80 ? 'success' : percentage >= 60 ? 'warning' : 'error'}>
              {percentage}%
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Enrolled Date',
      dataIndex: 'enrolled_at',
      key: 'enrolled_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: FaceEnrollmentWithLocal) => (
        <Space>
          <Tooltip title="Preview">
            <Button
              type="text"
              icon={<Eye size={16} />}
              onClick={() => handlePreview(record.photo_url, record)}
            />
          </Tooltip>
          {record.has_local_image && (
            <Tooltip title="Download">
              <Button
                type="text"
                icon={<Download size={16} />}
                onClick={() => {
                  if (selectedStudent) {
                    const imageData = localStorage.getItem(record.local_storage_key || '');
                    if (imageData) {
                      handleDownloadImage(selectedStudent.id, record.id, imageData);
                    }
                  }
                }}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Delete this image?"
            onConfirm={() => {
              if (selectedStudent) {
                handleDeleteImage(selectedStudent.id, record.id);
              }
            }}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                danger
                icon={<Trash2 size={16} />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={2}>Image Management</Title>
          <Text type="secondary">
            Manage face images stored locally and in database
          </Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<RefreshCw size={16} />}
              onClick={fetchStudentsWithImages}
              loading={loading}
            >
              Refresh
            </Button>
            <Upload
              accept=".json"
              showUploadList={false}
              beforeUpload={handleImportImages}
              disabled={importLoading}
            >
              <Button
                icon={<UploadIcon size={16} />}
                loading={importLoading}
              >
                Import
              </Button>
            </Upload>
            <Button
              icon={<Download size={16} />}
              onClick={handleExportAllImages}
              disabled={storageUsage.imageCount === 0}
            >
              Export
            </Button>
            <Button
              icon={<FolderOpen size={16} />}
              onClick={handleClearLocalStorage}
              danger
              disabled={storageUsage.imageCount === 0}
            >
              Clear Local
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Storage Usage */}
      <Card style={{ marginBottom: 20 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={16}>
            <Text strong>Local Storage: </Text>
            <Progress
              percent={storageUsage.percentage}
              status={storageUsage.percentage > 90 ? 'exception' : 'normal'}
              style={{ marginTop: 8 }}
            />
            <Text type="secondary">
              {Math.round(storageUsage.used / 1024)}MB / {Math.round(storageUsage.total / 1024)}MB
              ({storageUsage.imageCount} images)
            </Text>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Tag color="blue">
              <Database size={12} style={{ marginRight: 4 }} />
              Supabase
            </Tag>
            <Tag color="green">
              <Save size={12} style={{ marginRight: 4 }} />
              Local Storage
            </Tag>
          </Col>
        </Row>
      </Card>

      {/* Search and Filters */}
      <Card style={{ marginBottom: 20 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <AntdSearch
              placeholder="Search by name or matric number"
              allowClear
              enterButton={<Search size={16} />}
              size="large"
              onSearch={handleSearch}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col xs={24} md={12}>
            <Space>
              <Select
                value={filters.has_images}
                onChange={(value) => setFilters({ has_images: value })}
                style={{ width: 150 }}
              >
                <Select.Option value="all">All Students</Select.Option>
                <Select.Option value="yes">With Images</Select.Option>
                <Select.Option value="no">No Images</Select.Option>
                <Select.Option value="local">Local Storage</Select.Option>
              </Select>
              <Button
                icon={<Filter size={16} />}
                onClick={() => {
                  setFilters({ has_images: 'all' });
                  setSearchText('');
                }}
              >
                Clear Filters
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Main Content */}
      {selectedStudent ? (
        <Card 
          title={
            <Space>
              <User size={16} />
              <Text strong>{selectedStudent.name}</Text>
              <Text type="secondary">({selectedStudent.matric_number})</Text>
            </Space>
          }
          extra={
            <Space>
              <Button onClick={() => setSelectedStudent(null)}>
                Back to List
              </Button>
              <Button
                type="primary"
                icon={<Camera size={16} />}
                onClick={() => handleReEnrollStudent(selectedStudent)}
              >
                Add New Image
              </Button>
            </Space>
          }
        >
          <Row gutter={[20, 20]}>
            <Col span={24}>
              <Alert
                message="Student Face Images"
                description={
                  <>
                    {selectedStudent.face_enrollments?.length || 0} total images
                    {selectedStudent.face_enrollments?.some(img => img.has_local_image) && 
                      ` (${selectedStudent.face_enrollments?.filter(img => img.has_local_image).length} stored locally)`}
                  </>
                }
                type="info"
                showIcon
              />
            </Col>
            
            {selectedStudent.face_enrollments && selectedStudent.face_enrollments.length > 0 ? (
              <Col span={24}>
                <Table
                  columns={imageColumns}
                  dataSource={selectedStudent.face_enrollments}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                />
              </Col>
            ) : (
              <Col span={24}>
                <Empty
                  description="No face images found for this student"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button
                    type="primary"
                    icon={<Camera size={16} />}
                    onClick={() => handleReEnrollStudent(selectedStudent)}
                  >
                    Enroll Face Now
                  </Button>
                </Empty>
              </Col>
            )}
          </Row>
        </Card>
      ) : (
        <Card>
          <Table
            columns={columns}
            dataSource={filteredStudents}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
            locale={{
              emptyText: (
                <Empty
                  description="No students found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Text type="secondary">Enroll students to see their face images here</Text>
                </Empty>
              )
            }}
          />
        </Card>
      )}

      {/* Image Preview Modal */}
      <Modal
        open={previewVisible}
        title="Face Image Preview"
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={720}
      >
        <div style={{ textAlign: 'center' }}>
          <AntdImage
            src={previewImage}
            alt="Face Preview"
            style={{ maxWidth: '100%', maxHeight: '70vh' }}
          />
          {selectedImage && (
            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <Divider style={{ margin: '16px 0' }}>
                <Text strong>Image Details</Text>
              </Divider>
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Text strong>Storage: </Text>
                  {selectedImage.has_local_image ? (
                    <Tag color="green">Local Storage</Tag>
                  ) : (
                    <Tag color="orange">Database</Tag>
                  )}
                </Col>
                <Col span={12}>
                  <Text strong>Quality: </Text>
                  <Tag color="blue">
                    {Math.round((selectedImage.quality_score || 0) * 100)}%
                  </Tag>
                </Col>
                <Col span={24}>
                  <Text strong>Enrolled: </Text>
                  <Text>{new Date(selectedImage.enrolled_at).toLocaleString()}</Text>
                </Col>
                {selectedImage.capture_device && (
                  <Col span={24}>
                    <Text strong>Device: </Text>
                    <Text>{selectedImage.capture_device}</Text>
                  </Col>
                )}
              </Row>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ImageManagementPage;