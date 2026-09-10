import { useQuery } from '@tanstack/react-query'
import { Button, Flex } from 'antd'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import type { TransactionPage } from '../api/types'
import { MetricCard } from '../components/dashboard/MetricCard'
import { TransactionChart } from '../components/dashboard/TransactionChart'
import { RecentActivity } from '../components/dashboard/RecentActivity'
import { MailOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => (await api.get<TransactionPage>('/admin/transactions', { params: { page: 1, page_size: 50 } })).data,
  })

  const transactions = data?.items || []
  const total = transactions.length
  const delivered = transactions.filter((t) => t.status === 'sent').length
  const queued = transactions.filter((t) => t.status === 'queued').length
  const failed = transactions.filter((t) => t.status === 'failed').length

  return (
    <Flex vertical gap="large" style={{ width: '100%' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Total" value={total} prefixIcon={<MailOutlined />} color="#1890ff" />
        <MetricCard title="Delivered" value={delivered} prefixIcon={<CheckCircleOutlined />} color="#52c41a" />
        <MetricCard title="Queued" value={queued} prefixIcon={<ClockCircleOutlined />} color="#faad14" />
        <MetricCard title="Failed" value={failed} prefixIcon={<CloseCircleOutlined />} color="#ff4d4f" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TransactionChart delivered={delivered} queued={queued} failed={failed} total={total} />
        <RecentActivity transactions={transactions} />
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3 pt-2">
        <Button type="primary" onClick={() => navigate('/test-email')} className="w-full sm:w-auto h-10">
          Send Test Email
        </Button>
        <Button onClick={() => navigate('/logs')} className="w-full sm:w-auto h-10">
          View All Logs
        </Button>
        <Button onClick={() => void refetch()} loading={isFetching} className="w-full sm:w-auto h-10">
          Refresh
        </Button>
      </div>
    </Flex>
  )
}
