import { useQuery } from '@tanstack/react-query'
import { Badge, Button, DatePicker, Input, Select, Space, Table } from 'antd'
import { useEffect, useState } from 'react'
import { EyeOutlined, RedoOutlined } from '@ant-design/icons'
import api from '../api/client'
import type { ApiKey, Transaction, TransactionPage } from '../api/types'
import TransactionDetailDrawer from '../components/logs/TransactionDetailDrawer'

const { RangePicker } = DatePicker

const STATUS_COLORS = { queued: 'blue', sent: 'green', failed: 'red' } as const

interface Filters {
  status?: string
  from_date?: string
  to_date?: string
  api_key_id?: string
  subject?: string
  page: number
  page_size: number
}

export default function LogsPage() {
  const [filters, setFilters] = useState<Filters>({ page: 1, page_size: 50 })
  const [subjectInput, setSubjectInput] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) =>
        prev.subject === subjectInput ? prev : { ...prev, subject: subjectInput || undefined, page: 1 },
      )
    }, 500)
    return () => clearTimeout(timer)
  }, [subjectInput])

  const { data, isLoading, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () =>
      (await api.get<TransactionPage>('/admin/transactions', { params: filters })).data,
    refetchInterval: 30_000,
  })

  const { data: apiKeys = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => (await api.get<ApiKey[]>('/admin/api-keys')).data,
  })

  const setFilter = (patch: Partial<Filters>) =>
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }))

  const columns = [
    {
      title: 'Task ID',
      dataIndex: 'task_id',
      width: 110,
      render: (id: string) => <code>{id.slice(0, 8)}…</code>,
    },
    { title: 'From', dataIndex: 'from_address' },
    {
      title: 'To',
      dataIndex: 'to_addresses',
      render: (addresses: string[]) => {
        const shown = addresses.slice(0, 2).join(', ')
        return addresses.length > 2 ? `${shown}, +${addresses.length - 2}` : shown
      },
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      render: (subject: string) => (subject.length > 50 ? `${subject.slice(0, 50)}…` : subject),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (status: keyof typeof STATUS_COLORS) => (
        <Badge color={STATUS_COLORS[status]} text={status} />
      ),
    },
    { title: 'Retries', dataIndex: 'retry_count', width: 80 },
    {
      title: 'Created',
      dataIndex: 'created_at',
      render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_: any, record: Transaction) => (
        <Button icon={<EyeOutlined />} onClick={() => setSelectedTransaction(record)} />
      ),
    },
  ]

  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      if (dataUpdatedAt) setSecondsAgo(Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000)))
    }, 1000)
    return () => clearInterval(t)
  }, [dataUpdatedAt])

  return (
    <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Status"
          style={{ width: 130 }}
          options={[
            { value: 'queued', label: 'Queued' },
            { value: 'sent', label: 'Sent' },
            { value: 'failed', label: 'Failed' },
          ]}
          onChange={(status) => setFilter({ status })}
        />
        <RangePicker
          onChange={(dates) =>
            setFilter({
              from_date: dates?.[0]?.format('YYYY-MM-DD'),
              to_date: dates?.[1]?.format('YYYY-MM-DD'),
            })
          }
        />
        <Select
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          placeholder="API Key"
          style={{ width: 180 }}
          options={apiKeys.map((k) => ({ value: k.id, label: k.client_name }))}
          onChange={(api_key_id) => setFilter({ api_key_id })}
        />
        <Input.Search
          placeholder="Search subject"
          allowClear
          style={{ width: 240 }}
          value={subjectInput}
          onChange={(e) => setSubjectInput(e.target.value)}
          onSearch={(subject) => setFilter({ subject: subject || undefined })}
        />
        <Button icon={<RedoOutlined />} onClick={() => refetch()} loading={isLoading}>
          Refresh
        </Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data?.items}
        loading={isLoading}
        pagination={{
          current: data?.page ?? 1,
          pageSize: data?.page_size ?? 50,
          total: data?.total_count ?? 0,
          showSizeChanger: true,
          onChange: (page, page_size) => setFilters((prev) => ({ ...prev, page, page_size })),
        }}
        footer={() => <span style={{ color: '#999' }}>Last updated: {secondsAgo}s ago</span>}
      />
      <TransactionDetailDrawer
        transaction={selectedTransaction}
        open={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </>
  )
}

