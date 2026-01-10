// src/pages/AttendanceManagementPage.tsx - NIGERAM STAFF VERSION
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Select,
  DatePicker,
  Button,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  Alert,
  message,
  Modal,
  Descriptions,
  Avatar,
  Tooltip,
  Badge
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  DownloadOutlined,
  EyeOutlined,
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  TeamOutlined,
  ApartmentOutlined 
} from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface StaffAttendanceRecord {
  id: number;
  staff_id: string;
  staff_name: string;
  department: 'studio' | 'logistics' | 'bakery' | 'spa';
  attendance_date: string;
  check_in_time: string;
  status: 'present' | 'absent' | 'late' | 'early_departure';
  verification_method: 'face_recognition' | 'manual' | 'card_swipe';
  confidence_score: number | null;
  total_hours?: number;
  overtime_minutes?: number;
  location?: string;
  created_at: string;
  updated_at: string;
}

const AttendanceManagementPage: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<StaffAttendanceRecord[]>([]);
  const [filteredData, setFilteredData] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [departments] = useState<string[]>(['studio', 'logistics', 'bakery', 'spa']);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    faceVerified: 0
  });
  const [selectedRecord, setSelectedRecord] = useState<StaffAttendanceRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    status: '',
    verification: '',
    dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null
  });

  const isMobile = window.innerWidth < 768;

  // Fetch attendance data for staff
  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        setAttendanceData(data);
        setFilteredData(data);
        calculateStats(data);
      }
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      message.error('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const calculateStats = (data: StaffAttendanceRecord[]) => {
    const present = data.filter(record => record.status === 'present').length;
    const absent = data.filter(record => record.status === 'absent').length;
    const late = data.filter(record => record.status === 'late').length;
    const faceVerified = data.filter(record => record.verification_method === 'face_recognition').length;
    
    setStats({
      total: data.length,
      present,
      absent,
      late,
      faceVerified
    });
  };

  // Apply filters
  const applyFilters = () => {
    let filtered = [...attendanceData];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(record =>
        record.staff_name.toLowerCase().includes(searchLower) ||
        record.staff_id.toLowerCase().includes(searchLower) ||
        record.department.toLowerCase().includes(searchLower)
      );
    }

    // Department filter
    if (filters.department) {
      filtered = filtered.filter(record => record.department === filters.department);
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(record => record.status === filters.status);
    }

    // Verification method filter
    if (filters.verification) {
      filtered = filtered.filter(record => record.verification_method === filters.verification);
    }

    // Date range filter
    if (filters.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      filtered = filtered.filter(record => {
        const recordDate = dayjs(record.attendance_date);
        return recordDate.isAfter(startDate.subtract(1, 'day')) && 
               recordDate.isBefore(endDate.add(1, 'day'));
      });
    }

    setFilteredData(filtered);
    calculateStats(filtered);
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      search: '',
      department: '',
      status: '',
      verification: '',
      dateRange: null
    });
    setFilteredData(attendanceData);
    calculateStats(attendanceData);
  };

  // View record details
  const viewRecordDetails = (record: StaffAttendanceRecord) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  // Export data
  const exportToCSV = () => {
    const headers = ['Staff ID', 'Name', 'Department', 'Date', 'Check-in Time', 'Status', 'Verification Method', 'Confidence Score', 'Hours Worked'];
    const csvData = filteredData.map(record => [
      record.staff_id,
      record.staff_name,
      record.department.toUpperCase(),
      record.attendance_date,
      dayjs(record.check_in_time).format('HH:mm:ss'),
      record.status.toUpperCase(),
      record.verification_method,
      record.confidence_score ? `${(record.confidence_score * 100).toFixed(1)}%` : 'N/A',
      record.total_hours ? record.total_hours.toFixed(2) : 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `staff_attendance_${dayjs().format('YYYY-MM-DD_HH-mm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('Data exported successfully');
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

  // Table columns
  const columns = [
    {
      title: 'Staff',
      dataIndex: 'staff_name',
      key: 'staff_name',
      width: isMobile ? 150 : 200,
      render: (text: string, record: StaffAttendanceRecord) => (
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
            <div style={{ fontWeight: 500 }}>{text}</div>
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
      width: isMobile ? 100 : 120,
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
      title: 'Date & Time',
      key: 'datetime',
      width: isMobile ? 140 : 180,
      render: (record: StaffAttendanceRecord) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {dayjs(record.attendance_date).format('MMM D, YYYY')}
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {dayjs(record.check_in_time).format('h:mm A')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusConfig: any = {
          present: { color: 'green', icon: <CheckCircleOutlined />, text: 'Present' },
          absent: { color: 'red', icon: <CloseCircleOutlined />, text: 'Absent' },
          late: { color: 'orange', icon: <ClockCircleOutlined />, text: 'Late' },
          early_departure: { color: 'volcano', icon: <ClockCircleOutlined />, text: 'Early' }
        };
        const config = statusConfig[status] || statusConfig.present;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: 'Verification',
      dataIndex: 'verification_method',
      key: 'verification_method',
      width: isMobile ? 100 : 120,
      render: (method: string, record: StaffAttendanceRecord) => (
        <Tooltip title={`Confidence: ${record.confidence_score ? (record.confidence_score * 100).toFixed(1) + '%' : 'N/A'}`}>
          <Badge
            color={method === 'face_recognition' ? 'green' : 'blue'}
            text={
              method === 'face_recognition' ? 'Face ID' :
              method === 'manual' ? 'Manual' : 'Card'
            }
          />
        </Tooltip>
      ),
    },
    {
      title: 'Hours',
      key: 'hours',
      width: 80,
      render: (record: StaffAttendanceRecord) => (
        <Text>
          {record.total_hours ? `${record.total_hours.toFixed(1)}h` : 'N/A'}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (record: StaffAttendanceRecord) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => viewRecordDetails(record)}
          size="small"
        />
      ),
    },
  ];

  // Mobile responsive columns
  const mobileColumns = [
    {
      title: 'Details',
      key: 'details',
      render: (record: StaffAttendanceRecord) => (
        <div style={{ padding: '8px 0' }}>
          <Row gutter={[8, 8]}>
            <Col span={24}>
              <Space>
                <Avatar 
                  size="small" 
                  style={{ 
                    backgroundColor: getDepartmentColor(record.department),
                    color: 'white'
                  }}
                >
                  {record.staff_name.charAt(0)}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 500 }}>{record.staff_name}</div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {record.staff_id}
                  </Text>
                </div>
              </Space>
            </Col>
            <Col span={24}>
              <Tag 
                color={getDepartmentColor(record.department)}
                style={{ color: 'white', fontWeight: 500 }}
              >
                {record.department.toUpperCase()}
              </Tag>
              {record.status === 'present' ? (
                <Tag color="green" icon={<CheckCircleOutlined />} style={{ marginLeft: 4 }}>
                  Present
                </Tag>
              ) : record.status === 'late' ? (
                <Tag color="orange" icon={<ClockCircleOutlined />} style={{ marginLeft: 4 }}>
                  Late
                </Tag>
              ) : (
                <Tag color="red" icon={<CloseCircleOutlined />} style={{ marginLeft: 4 }}>
                  Absent
                </Tag>
              )}
            </Col>
            <Col span={24}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <CalendarOutlined style={{ marginRight: 4 }} />
                {dayjs(record.attendance_date).format('MMM D')} • 
                <ClockCircleOutlined style={{ marginRight: 4, marginLeft: 8 }} />
                {dayjs(record.check_in_time).format('h:mm A')}
              </Text>
            </Col>
            <Col span={24}>
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => viewRecordDetails(record)}
                size="small"
                style={{ padding: 0 }}
              >
                View Details
              </Button>
            </Col>
          </Row>
        </div>
      ),
    },
  ];

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, attendanceData]);

  return (
    <div style={{ padding: isMobile ? '12px' : '24px', maxWidth: 1400, margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        Staff Attendance Management
      </Title>
      <Text type="secondary">
        View, search, and filter attendance records for Nigeram staff
      </Text>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginTop: 24, marginBottom: 24 }}>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Total Records"
              value={stats.total}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Present"
              value={stats.present}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Late"
              value={stats.late}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Face Verified"
              value={stats.faceVerified}
              suffix={`/ ${stats.total}`}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Departments"
              value={4}
              prefix={<ApartmentOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters Card */}
      <Card
        title={
          <Space>
            <FilterOutlined />
            <span>Filters & Search</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={resetFilters}
              size={isMobile ? "small" : "middle"}
            >
              Reset
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportToCSV}
              size={isMobile ? "small" : "middle"}
            >
              Export
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Search staff name or ID..."
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              size={isMobile ? "small" : "middle"}
              allowClear
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="Department"
              style={{ width: '100%' }}
              value={filters.department || undefined}
              onChange={(value) => setFilters({...filters, department: value})}
              size={isMobile ? "small" : "middle"}
              allowClear
            >
              {departments.map(dept => (
                <Option key={dept} value={dept}>
                  <Tag color={getDepartmentColor(dept)} style={{ marginRight: 4 }}>
                    {dept.charAt(0).toUpperCase()}
                  </Tag>
                  {dept.toUpperCase()}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="Status"
              style={{ width: '100%' }}
              value={filters.status || undefined}
              onChange={(value) => setFilters({...filters, status: value})}
              size={isMobile ? "small" : "middle"}
              allowClear
            >
              <Option value="present">Present</Option>
              <Option value="absent">Absent</Option>
              <Option value="late">Late</Option>
              <Option value="early_departure">Early Departure</Option>
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="Method"
              style={{ width: '100%' }}
              value={filters.verification || undefined}
              onChange={(value) => setFilters({...filters, verification: value})}
              size={isMobile ? "small" : "middle"}
              allowClear
            >
              <Option value="face_recognition">Face ID</Option>
              <Option value="manual">Manual</Option>
              <Option value="card_swipe">Card</Option>
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['Start Date', 'End Date']}
              value={filters.dateRange}
              onChange={(dates) => setFilters({...filters, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs]})}
              size={isMobile ? "small" : "middle"}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* Results Alert */}
      <Alert
        message={`Showing ${filteredData.length} of ${attendanceData.length} attendance records`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        action={
          <Button type="link" size="small" onClick={fetchAttendanceData}>
            Refresh
          </Button>
        }
      />

      {/* Attendance Table */}
      <Card>
        <Table
          columns={isMobile ? mobileColumns : columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: isMobile ? 10 : 20,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
            responsive: true
          }}
          scroll={{ x: isMobile ? 400 : 1200 }}
          size={isMobile ? "small" : "middle"}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Staff Attendance Record Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>
        ]}
        width={isMobile ? '90%' : 700}
      >
        {selectedRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Staff">
              <Space>
                <Avatar 
                  style={{ 
                    backgroundColor: getDepartmentColor(selectedRecord.department),
                    color: 'white'
                  }}
                >
                  {selectedRecord.staff_name.charAt(0)}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 500 }}>{selectedRecord.staff_name}</div>
                  <Text type="secondary">{selectedRecord.staff_id}</Text>
                </div>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Department">
              <Tag 
                color={getDepartmentColor(selectedRecord.department)}
                style={{ color: 'white', fontWeight: 500 }}
              >
                {selectedRecord.department.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Attendance Date">
              {dayjs(selectedRecord.attendance_date).format('dddd, MMMM D, YYYY')}
            </Descriptions.Item>
            <Descriptions.Item label="Check-in Time">
              {dayjs(selectedRecord.check_in_time).format('h:mm:ss A')}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {selectedRecord.status === 'present' ? (
                <Tag color="green" icon={<CheckCircleOutlined />}>Present</Tag>
              ) : selectedRecord.status === 'absent' ? (
                <Tag color="red" icon={<CloseCircleOutlined />}>Absent</Tag>
              ) : selectedRecord.status === 'late' ? (
                <Tag color="orange" icon={<ClockCircleOutlined />}>Late</Tag>
              ) : (
                <Tag color="volcano" icon={<ClockCircleOutlined />}>Early Departure</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Verification Method">
              <Tag color={selectedRecord.verification_method === 'face_recognition' ? 'green' : 'blue'}>
                {selectedRecord.verification_method.replace('_', ' ').toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Confidence Score">
              {selectedRecord.confidence_score ? (
                <div>
                  <Text strong>{(selectedRecord.confidence_score * 100).toFixed(1)}%</Text>
                  <div style={{ width: '100%', backgroundColor: '#f5f5f5', borderRadius: 4, marginTop: 4 }}>
                    <div
                      style={{
                        width: `${selectedRecord.confidence_score * 100}%`,
                        height: 8,
                        backgroundColor: selectedRecord.confidence_score > 0.8 ? '#52c41a' : 
                                       selectedRecord.confidence_score > 0.6 ? '#faad14' : '#ff4d4f',
                        borderRadius: 4
                      }}
                    />
                  </div>
                </div>
              ) : 'N/A'}
            </Descriptions.Item>
            {selectedRecord.total_hours && (
              <Descriptions.Item label="Hours Worked">
                <Text strong>{selectedRecord.total_hours.toFixed(2)} hours</Text>
                {selectedRecord.overtime_minutes && selectedRecord.overtime_minutes > 0 && (
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      +{selectedRecord.overtime_minutes} mins overtime
                    </Text>
                  </div>
                )}
              </Descriptions.Item>
            )}
            {selectedRecord.location && (
              <Descriptions.Item label="Location">
                {selectedRecord.location}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Record Created">
              {dayjs(selectedRecord.created_at).format('MMM D, YYYY h:mm:ss A')}
            </Descriptions.Item>
            <Descriptions.Item label="Last Updated">
              {dayjs(selectedRecord.updated_at).format('MMM D, YYYY h:mm:ss A')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AttendanceManagementPage;