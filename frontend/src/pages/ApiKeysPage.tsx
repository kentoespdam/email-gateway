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
import api from '../api/client'
import type { ApiKey, ApiKeyCreated } from '../api/types'

interface ApiKeyForm {
  client_name: string
  allowed_from_addresses: string
  expires_at: { asDate(): Date | null } | null
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['api-keys'] })

  const createKey = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post<ApiKeyCreated>('/admin/api-keys', payload)).data,
    onSuccess: (key) => {
      invalidate()
      setModalOpen(false)
      setCreated(key)
    },
    onError: () => message.error('Failed to create API key'),
  })

  const updateKey = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      api.patch(`/admin/api-keys/${id}`, payload),
    onSuccess: invalidate,
    onError: () => message.error('Failed to update API key'),
  })

  const deleteKey = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/api-keys/${id}`),
    onSuccess: invalidate,
    onError: () => message.error('Failed to delete API key'),
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
    const expires = values.expires_at?.asDate()
    if (expires) payload.expires_at = expires.toISOString()
    if (editing) {
      updateKey.mutate({ id: editing.id, ...payload })
    } else {
      createKey.mutate(payload)
    }
    setModalOpen(false)
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 100,
      render: (id: string) => <Typography.Text code>{id.slice(0, 8)}…</Typography.Text>,
    },
    { title: 'Client', dataIndex: 'client_name' },
    {
      title: 'Allowed From',
      dataIndex: 'allowed_from_addresses',
      render: (addresses: string[]) =>
        addresses.map((a) => <Tag key={a}>{a}</Tag>),
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
      render: (value: string | null) =>
        value ? new Date(value).toLocaleString() : 'Never',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: 'Actions',
      width: 160,
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
      <Button type="primary" onClick={openCreate} style={{ marginBottom: 16 }}>
        Create API Key
      </Button>
      <Table rowKey="id" columns={columns} dataSource={keys} loading={isLoading} />

      <Modal
        title={editing ? 'Edit API Key' : 'Create API Key'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createKey.isPending || updateKey.isPending}
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
