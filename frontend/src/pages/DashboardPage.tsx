import { useQuery } from '@tanstack/react-query'
import { Row, Col, Space, Button } from 'antd'
import api from '../api/client'
import type { TransactionPage } from '../api/types'
import { MetricCard } from '../components/dashboard/MetricCard'
import { TransactionChart } from '../components/dashboard/TransactionChart'
import { RecentActivity } from '../components/dashboard/RecentActivity'
import { MailOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

export default function DashboardPage() {
  const { data } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => (await api.get<TransactionPage>('/admin/transactions', { params: { page: 1, page_size: 50 } })).data,
  })

  const transactions = data?.items || []
  const total = transactions.length
  const delivered = transactions.filter((t) => t.status === 'sent').length
  const queued = transactions.filter((t) => t.status === 'queued').length
  const failed = transactions.filter((t) => t.status === 'failed').length

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={6}><MetricCard title="Total" value={total} prefixIcon={<MailOutlined />} color="#1890ff" /></Col>
        <Col span={6}><MetricCard title="Delivered" value={delivered} prefixIcon={<CheckCircleOutlined />} color="#52c41a" /></Col>
        <Col span={6}><MetricCard title="Queued" value={queued} prefixIcon={<ClockCircleOutlined />} color="#faad14" /></Col>
        <Col span={6}><MetricCard title="Failed" value={failed} prefixIcon={<CloseCircleOutlined />} color="#ff4d4f" /></Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}><TransactionChart delivered={delivered} queued={queued} failed={failed} total={total} /></Col>
        <Col span={12}><RecentActivity transactions={transactions} /></Col>
      </Row>

      <Space>
        <Button type="primary">Send Test Email</Button>
        <Button>View All Logs</Button>
        <Button>Refresh</Button>
      </Space>
    </Space>
  )
}
