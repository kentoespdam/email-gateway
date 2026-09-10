import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useState } from 'react'
import type { Dayjs } from 'dayjs'
import api from '../api/client'
import type { ApiKey, ApiKeyCreated } from '../api/types'
import { MaskedTokenCell } from '../components/MaskedTokenCell'

interface ApiKeyForm {
  client_name: string
  allowed_from_addresses: string
  expires_at: Dayjs | null
}

export default function ApiKeysPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<ApiKey | null>(null)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<ApiKeyForm>()

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => (await api.get<ApiKey[]>('/admin/api-keys')).data,
  })

  const createKey = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post<ApiKeyCreated>('/admin/api-keys', payload)).data,
    onSuccess: async (key) => {
      setModalOpen(false)
      setCreated(key)
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: () => {
      void message.error('Failed to create API key')
    },
  })

  const updateKey = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      api.patch(`/admin/api-keys/${id}`, payload),
    onSuccess: async () => {
      setModalOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: () => {
      void message.error('Failed to update API key')
    },
  })

  const deleteKey = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/api-keys/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: () => {
      void message.error('Failed to delete API key')
    },
  })

  const openCreate = () => {
    form.resetFields()
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (key: ApiKey) => {
    form.setFieldsValue({
      client_name: key.client_name,
      allowed_from_addresses: key.allowed_from_addresses.join(', '),
    })
    setEditing(key)
    setModalOpen(true)
  }

  const onFinish = (values: ApiKeyForm) => {
    const payload: Record<string, unknown> = {
      client_name: values.client_name,
      allowed_from_addresses: values.allowed_from_addresses
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
    }
    const expires = values.expires_at?.toDate()
    if (expires) payload.expires_at = expires.toISOString()
    if (editing) {
      updateKey.mutate({ id: editing.id, ...payload })
    } else {
      createKey.mutate(payload)
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 110,
      render: (id: string) => <Typography.Text code className="whitespace-nowrap font-mono">{id.slice(0, 8)}…</Typography.Text>,
    },
    {
      title: 'Key Token',
      dataIndex: 'key_token',
      width: 240,
      render: (token: string) => <div className="whitespace-nowrap"><MaskedTokenCell token={token} /></div>,
    },
    { title: 'Client', dataIndex: 'client_name', width: 140 },
    {
      title: 'Allowed From',
      dataIndex: 'allowed_from_addresses',
      width: 220,
      render: (addresses: string[]) =>
        <div className="flex flex-wrap gap-1">{(addresses || []).map((a) => <Tag key={a}>{a}</Tag>)}</div>,
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      width: 90,
      render: (active: boolean, record: ApiKey) => (
        <Switch
          checked={active}
          onChange={(checked) => updateKey.mutate({ id: record.id, is_active: checked })}
        />
      ),
    },
    {
      title: 'Expires',
      dataIndex: 'expires_at',
      width: 170,
      render: (value: string | null) =>
        value ? new Date(value).toLocaleString() : 'Never',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      width: 170,
      render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: 'Actions',
      width: 140,
      render: (_: unknown, record: ApiKey) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this API key?"
            onConfirm={() => deleteKey.mutate(record.id)}
          >
            <Button size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <Typography.Title level={2} style={{ margin: 0 }}>API Keys</Typography.Title>
        <Button type="primary" onClick={openCreate} className="w-full sm:w-auto h-10">
          Create API Key
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block w-full overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141414]">
        <Table rowKey="id" columns={columns} dataSource={keys} loading={isLoading} scroll={{ x: 1280 }} />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {isLoading ? <div className="p-4 text-center">Loading...</div> : keys.map(key => (
          <div key={key.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141414] shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-base">{key.client_name}</span>
              <div className="flex items-center gap-2">
                <Switch size="small" checked={key.is_active} onChange={(c) => updateKey.mutate({ id: key.id, is_active: c })} />
                <Typography.Text code className="text-xs">{key.id.slice(0, 6)}</Typography.Text>
              </div>
            </div>
            <div className="mt-2 mb-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Token:</span>
              <MaskedTokenCell token={key.key_token} />
            </div>
            <div className="text-sm mb-2">{key.allowed_from_addresses.map(a => <Tag key={a} className="mb-1">{a}</Tag>)}</div>
            <div className="text-xs text-gray-500">
              {key.expires_at ? `Expires: ${new Date(key.expires_at).toLocaleString()}` : 'No expiry'} | Dibuat: {key.created_at ? new Date(key.created_at).toLocaleString() : '-'}
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="small" className="h-9 flex-1" onClick={() => openEdit(key)}>Edit</Button>
              <Popconfirm title="Delete?" onConfirm={() => deleteKey.mutate(key.id)}>
                <Button size="small" danger className="h-9 flex-1">Delete</Button>
              </Popconfirm>
            </div>
          </div>
        ))}
        {keys.length === 0 && !isLoading && <div className="p-4 text-center text-gray-500">No API keys found.</div>}
      </div>

      <Modal
        title={editing ? 'Edit API Key' : 'Create API Key'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createKey.isPending || updateKey.isPending}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="client_name"
            label="Client name"
            rules={[{ required: true, message: 'Client name is required' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="allowed_from_addresses"
            label="Allowed from addresses (comma-separated)"
            rules={[{ required: true, message: 'At least one address is required' }]}
          >
            <Input placeholder="noreply@x.com, billing@x.com" />
          </Form.Item>
          <Form.Item name="expires_at" label="Expires at (optional)">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="API key created"
        open={created !== null}
        onCancel={() => setCreated(null)}
        footer={
          <Button type="primary" onClick={() => setCreated(null)}>
            I have saved the key
          </Button>
        }
        style={{ maxWidth: 'calc(100vw - 32px)' }}
      >
        <Typography.Paragraph type="warning">
          Copy this token now — it will not be shown again.
        </Typography.Paragraph>
        <Typography.Paragraph copyable code data-testid="api-key-token">
          {created?.key_token}
        </Typography.Paragraph>
      </Modal>
    </>
  )
}
