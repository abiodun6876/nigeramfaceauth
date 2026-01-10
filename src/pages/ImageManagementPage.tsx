// src/pages/ImageManagementPage.tsx - NIGERAM STAFF VERSION
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
  Upload,
  Avatar
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
  ExclamationCircleOutlined,
  TeamOutlined,
  ApartmentOutlined
} from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { Staff, StaffFaceEnrollment } from '../types/database';

const { Title, Text } = Typography;
const { Search: AntdSearch } = Input;
const { confirm } = Modal;

// Create extended interface for local image tracking
interface StaffFaceEnrollmentWithLocal extends StaffFaceEnrollment {
  has_local_image?: boolean;
  local_storage_key?: string;
}

interface StaffWithImages extends Staff {
  face_enrollments?: StaffFaceEnrollmentWithLocal[];
  enrollment_count?: number;
  last_enrollment?: string;
  image_quality?: number;
}

// Local storage configuration
const LOCAL_STORAGE_PREFIX = 'staff_face_images_';

// Helper functions for local image storage
const localImageStorage = {
  saveImage: (staffId: string, imageId: string, imageData: string): void => {
    try {
      const key = `${LOCAL_STORAGE_PREFIX}${staffId}_${imageId}`;
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

  getImage: (staffId: string, imageId: string): string | null => {
    try {
      const key = `${LOCAL_STORAGE_PREFIX}${staffId}_${imageId}`;
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error getting image from localStorage:', error);
      return null;
    }
  },

  deleteImage: (staffId: string, imageId: string): void => {
    try {
      const key = `${LOCAL_STORAGE_PREFIX}${staffId}_${imageId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error deleting image from localStorage:', error);
    }
  },

  deleteAllStaffImages: (staffId: string): void => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`${LOCAL_STORAGE_PREFIX}${staffId}_`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error deleting staff images:', error);
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

// Get department color
const getDepartmentColor = (dept: string) => {
  const colors: Record<string, string> = {
    studio: '#00aaff',
    logistics: '#00ffaa',
    bakery: '#ffaa00',
    spa: '#9b59b6'
  };
  return colors[dept] || '#1890ff';
};

const ImageManagementPage: React.FC = () => {
  const [staff, setStaff] = useState<StaffWithImages[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffWithImages[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<StaffWithImages | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [selectedImage, setSelectedImage] = useState<StaffFaceEnrollmentWithLocal | null>(null);
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 0, imageCount: 0, percentage: 0 });
  const [importLoading, setImportLoading] = useState(false);
  const [filters, setFilters] = useState({
    has_images: 'all' as 'all' | 'yes' | 'no' | 'local',
    department: '' as string | ''
  });

  const departments = ['studio', 'logistics', 'bakery', 'spa'];

  const fetchStaffWithImages = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch staff with their face enrollments
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select(`
          *,
          face_enrollments(*)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (staffError) throw staffError;

      // Process staff to add image metadata
      const processedStaff: StaffWithImages[] = (staffData || []).map(staffMember => {
        // Check each enrollment for local images
        const enrollmentsWithLocalImages: StaffFaceEnrollmentWithLocal[] = 
          (staffMember.face_enrollments || []).map(enrollment => {
            const localImageKey = `${LOCAL_STORAGE_PREFIX}${staffMember.id}_${enrollment.id}`;
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
          ...staffMember,
          face_enrollments: enrollmentsWithLocalImages,
          enrollment_count: enrollmentsWithLocalImages.length,
          last_enrollment: enrollmentsWithLocalImages[0]?.enrolled_at,
          image_quality: enrollmentsWithLocalImages[0]?.quality_score || 0
        };
      });

      setStaff(processedStaff);
      setFilteredStaff(processedStaff);
      
      // Update storage usage
      const storageInfo = localImageStorage.getStorageUsage();
      setStorageUsage(storageInfo);
      
    } catch (error) {
      console.error('Error fetching staff with images:', error);
      message.error('Failed to load staff images');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffWithImages();
  }, [fetchStaffWithImages]);

  useEffect(() => {
    let result = staff;
    
    // Apply search filter
    if (searchText) {
      result = result.filter(staffMember =>
        staffMember.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        staffMember.staff_id?.toLowerCase().includes(searchText.toLowerCase()) ||
        staffMember.email?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    // Apply department filter
    if (filters.department) {
      result = result.filter(staffMember => staffMember.department === filters.department);
    }
    
    // Apply image filters
    if (filters.has_images !== 'all') {
      switch (filters.has_images) {
        case 'yes':
          result = result.filter(staffMember => (staffMember.enrollment_count || 0) > 0);
          break;
        case 'no':
          result = result.filter(staffMember => (staffMember.enrollment_count || 0) === 0);
          break;
        case 'local':
          result = result.filter(staffMember => 
            staffMember.face_enrollments?.some(img => img.has_local_image)
          );
          break;
      }
    }
    
    setFilteredStaff(result);
  }, [searchText, filters, staff]);

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handlePreview = (imageUrl: string, image?: StaffFaceEnrollmentWithLocal) => {
    setPreviewImage(imageUrl);
    setSelectedImage(image || null);
    setPreviewVisible(true);
  };

  const handleViewStaffImages = (staffMember: StaffWithImages) => {
    setSelectedStaff(staffMember);
  };

  const handleDeleteImage = async (staffId: string, imageId: string) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from('staff_face_enrollments')
        .delete()
        .eq('id', imageId);

      if (error) throw error;

      // Delete from localStorage
      localImageStorage.deleteImage(staffId, imageId);
      
      message.success('Image deleted successfully');
      fetchStaffWithImages();
      
      // Refresh selected staff if viewing their images
      if (selectedStaff?.id === staffId) {
        const updatedStaff = await fetchStaffDetails(staffId);
        setSelectedStaff(updatedStaff);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      message.error('Failed to delete image');
    }
  };

  const fetchStaffDetails = async (staffId: string) => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select(`
          *,
          face_enrollments(*)
        `)
        .eq('id', staffId)
        .single();

      if (error) throw error;
      
      // Check for local images
      const enrollmentsWithLocalImages: StaffFaceEnrollmentWithLocal[] = 
        (data.face_enrollments || []).map((enrollment: StaffFaceEnrollment) => {
          const localImageKey = `${LOCAL_STORAGE_PREFIX}${staffId}_${enrollment.id}`;
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
      } as StaffWithImages;
    } catch (error) {
      console.error('Error fetching staff details:', error);
      return null;
    }
  };

  const handleDeleteAllImages = async (staffId: string) => {
    confirm({
      title: 'Delete All Images',
      content: 'Are you sure you want to delete all face images for this staff member? This will delete from both database and local storage.',
      icon: <ExclamationCircleOutlined />,
      okText: 'Yes, Delete All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          // Delete from database
          const { error } = await supabase
            .from('staff_face_enrollments')
            .delete()
            .eq('staff_id', staffId);

          if (error) throw error;

          // Delete from localStorage
          localImageStorage.deleteAllStaffImages(staffId);
          
          message.success('All images deleted successfully');
          fetchStaffWithImages();
          setSelectedStaff(null);
        } catch (error) {
          console.error('Error deleting all images:', error);
          message.error('Failed to delete images');
        }
      }
    });
  };

  const handleReEnrollStaff = (staffMember: StaffWithImages) => {
    // Redirect to enrollment page with staff data
    const enrollmentUrl = `/enroll?staffId=${staffMember.id}`;
    window.location.href = enrollmentUrl;
  };

  const handleExportAllImages = () => {
    try {
      const exportData: any = {};
      
      staff.forEach(staffMember => {
        if (staffMember.face_enrollments) {
          staffMember.face_enrollments.forEach(enrollment => {
            if (enrollment.has_local_image && enrollment.local_storage_key) {
              const imageData = localStorage.getItem(enrollment.local_storage_key);
              if (imageData) {
                if (!exportData[staffMember.id]) {
                  exportData[staffMember.id] = {
                    name: staffMember.name,
                    staff_id: staffMember.staff_id,
                    department: staffMember.department,
                    images: {}
                  };
                }
                exportData[staffMember.id].images[enrollment.id] = {
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
      a.download = `staff_face_images_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success(`Exported ${Object.keys(exportData).length} staff members' images`);
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
          
          Object.keys(importData).forEach(staffId => {
            const staffData = importData[staffId];
            Object.keys(staffData.images).forEach(imageId => {
              const imageInfo = staffData.images[imageId];
              const key = `${LOCAL_STORAGE_PREFIX}${staffId}_${imageId}`;
              localStorage.setItem(key, imageInfo.imageData);
              importedCount++;
            });
          });
          
          message.success(`Imported ${importedCount} images`);
          fetchStaffWithImages();
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

  const handleDownloadImage = (staffId: string, imageId: string, imageData: string) => {
    try {
      // Create download link
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `staff_face_${staffId}_${imageId}.jpg`;
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
        fetchStaffWithImages();
      }
    });
  };

  const columns = [
    {
      title: 'Staff',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: StaffWithImages) => (
        <Space>
          <Avatar 
            size="small" 
            style={{ 
              backgroundColor: getDepartmentColor(record.department),
              color: 'white'
            }}
          >
            {text.charAt(0)}
          </Avatar>
          <div>
            <Text strong>{text}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.staff_id}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (dept: string) => (
        <Tag 
          color={getDepartmentColor(dept)}
          style={{ color: 'white', fontWeight: 500 }}
        >
          {dept.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Face Images',
      dataIndex: 'enrollment_count',
      key: 'images',
      render: (count: number, record: StaffWithImages) => {
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
      title: 'Status',
      dataIndex: 'employment_status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'success' : 'warning'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: StaffWithImages) => (
        <Space>
          <Tooltip title="View Images">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewStaffImages(record)}
              disabled={!record.enrollment_count}
            />
          </Tooltip>
          <Tooltip title="Re-enroll Face">
            <Button
              type="text"
              icon={<CameraOutlined />}
              onClick={() => handleReEnrollStaff(record)}
            />
          </Tooltip>
          {record.enrollment_count ? (
            <Popconfirm
              title="Delete all images for this staff member?"
              onConfirm={() => handleDeleteAllImages(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete All Images">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
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
      render: (url: string, record: StaffFaceEnrollmentWithLocal) => (
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
      render: (_: any, record: StaffFaceEnrollmentWithLocal) => (
        <Space>
          <Tooltip title="Preview">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record.photo_url, record)}
            />
          </Tooltip>
          {record.has_local_image && (
            <Tooltip title="Download">
              <Button
                type="text"
                icon={<DownloadOutlined />}
                onClick={() => {
                  if (selectedStaff) {
                    const imageData = localStorage.getItem(record.local_storage_key || '');
                    if (imageData) {
                      handleDownloadImage(selectedStaff.id, record.id, imageData);
                    }
                  }
                }}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Delete this image?"
            onConfirm={() => {
              if (selectedStaff) {
                handleDeleteImage(selectedStaff.id, record.id);
              }
            }}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
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
          <Title level={2}>Staff Image Management</Title>
          <Text type="secondary">
            Manage face images for Nigeram staff
          </Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchStaffWithImages}
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
                icon={<UploadOutlined />}
                loading={importLoading}
              >
                Import
              </Button>
            </Upload>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportAllImages}
              disabled={storageUsage.imageCount === 0}
            >
              Export
            </Button>
            <Button
              icon={<DeleteOutlined />}
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
              ({storageUsage.imageCount} staff images)
            </Text>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Tag color="blue">
              <TeamOutlined style={{ marginRight: 4 }} />
              Total Staff: {staff.length}
            </Tag>
            <Tag color="green">
              <UserOutlined style={{ marginRight: 4 }} />
              With Images: {staff.filter(s => (s.enrollment_count || 0) > 0).length}
            </Tag>
          </Col>
        </Row>
      </Card>

      {/* Search and Filters */}
      <Card style={{ marginBottom: 20 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <AntdSearch
              placeholder="Search staff name or ID"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              onSearch={handleSearch}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col xs={12} md={6}>
            <Select
              placeholder="Department"
              style={{ width: '100%' }}
              value={filters.department || undefined}
              onChange={(value) => setFilters({...filters, department: value})}
              allowClear
            >
              {departments.map(dept => (
                <Select.Option key={dept} value={dept}>
                  <Tag color={getDepartmentColor(dept)} style={{ marginRight: 4 }}>
                    {dept.charAt(0).toUpperCase()}
                  </Tag>
                  {dept.toUpperCase()}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={6}>
            <Select
              placeholder="Images"
              style={{ width: '100%' }}
              value={filters.has_images}
              onChange={(value) => setFilters({...filters, has_images: value})}
            >
              <Select.Option value="all">All Staff</Select.Option>
              <Select.Option value="yes">With Images</Select.Option>
              <Select.Option value="no">No Images</Select.Option>
              <Select.Option value="local">Local Storage</Select.Option>
            </Select>
          </Col>
          <Col xs={24} md={4}>
            <Button
              icon={<FilterOutlined />}
              onClick={() => {
                setFilters({ has_images: 'all', department: '' });
                setSearchText('');
              }}
              style={{ width: '100%' }}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Main Content */}
      {selectedStaff ? (
        <Card 
          title={
            <Space>
              <Avatar 
                style={{ 
                  backgroundColor: getDepartmentColor(selectedStaff.department),
                  color: 'white'
                }}
              >
                {selectedStaff.name.charAt(0)}
              </Avatar>
              <div>
                <Text strong>{selectedStaff.name}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {selectedStaff.staff_id} • {selectedStaff.department.toUpperCase()}
                </Text>
              </div>
            </Space>
          }
          extra={
            <Space>
              <Button onClick={() => setSelectedStaff(null)}>
                Back to List
              </Button>
              <Button
                type="primary"
                icon={<CameraOutlined />}
                onClick={() => handleReEnrollStaff(selectedStaff)}
              >
                Add New Image
              </Button>
            </Space>
          }
        >
          <Row gutter={[20, 20]}>
            <Col span={24}>
              <Alert
                message="Staff Face Images"
                description={
                  <>
                    {selectedStaff.face_enrollments?.length || 0} total images
                    {selectedStaff.face_enrollments?.some(img => img.has_local_image) && 
                      ` (${selectedStaff.face_enrollments?.filter(img => img.has_local_image).length} stored locally)`}
                  </>
                }
                type="info"
                showIcon
              />
            </Col>
            
            {selectedStaff.face_enrollments && selectedStaff.face_enrollments.length > 0 ? (
              <Col span={24}>
                <Table
                  columns={imageColumns}
                  dataSource={selectedStaff.face_enrollments}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                />
              </Col>
            ) : (
              <Col span={24}>
                <Empty
                  description="No face images found for this staff member"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button
                    type="primary"
                    icon={<CameraOutlined />}
                    onClick={() => handleReEnrollStaff(selectedStaff)}
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
            dataSource={filteredStaff}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
            locale={{
              emptyText: (
                <Empty
                  description="No staff members found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Text type="secondary">Enroll staff to see their face images here</Text>
                </Empty>
              )
            }}
          />
        </Card>
      )}

      {/* Image Preview Modal */}
      <Modal
        open={previewVisible}
        title="Staff Face Image Preview"
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
          {selectedImage && selectedStaff && (
            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <Divider style={{ margin: '16px 0' }}>
                <Text strong>Image Details</Text>
              </Divider>
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Text strong>Staff: </Text>
                  <Text>{selectedStaff.name}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Storage: </Text>
                  {selectedImage.has_local_image ? (
                    <Tag color="green">Local Storage</Tag>
                  ) : (
                    <Tag color="orange">Database</Tag>
                  )}
                </Col>
                <Col span={12}>
                  <Text strong>Department: </Text>
                  <Tag color={getDepartmentColor(selectedStaff.department)}>
                    {selectedStaff.department.toUpperCase()}
                  </Tag>
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