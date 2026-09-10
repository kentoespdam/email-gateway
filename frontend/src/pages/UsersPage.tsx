import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Popconfirm, Space, Table, message } from 'antd'
import { useState } from 'react'
import api from '../api/client'
import type { AdminUser } from '../hooks/useAuth'
import { useAuth } from '../hooks/useAuth'

interface UserForm {
  username: string
  password: string
  confirm: string
}

type Dialog =
  | { kind: 'create' }
  | { kind: 'reset'; user: AdminUser }
  | null

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [form] = Form.useForm<UserForm>()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<AdminUser[]>('/admin/users')).data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const createUser = useMutation({
    mutationFn: (payload: { username: string; password: string }) =>
      api.post('/admin/users', payload),
    onSuccess: () => {
      invalidate()
      setDialog(null)
      message.success('User created')
    },
    onError: () => message.error('Failed to create user (username taken?)'),
  })

  const resetPassword = useMutation({
    mutationFn: ({ id, new_password }: { id: string; new_password: string }) =>
      api.put(`/admin/users/${id}/password`, { new_password }),
    onSuccess: () => {
      invalidate()
      setDialog(null)
      message.success('Password updated')
    },
    onError: () => message.error('Failed to reset password'),
  })

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: invalidate,
    onError: () => message.error('Failed to delete user'),
  })

  const onFinish = (values: UserForm) => {
    if (dialog?.kind === 'create') {
      createUser.mutate({ username: values.username, password: values.password })
    } else if (dialog?.kind === 'reset') {
      resetPassword.mutate({ id: dialog.user.id, new_password: values.password })
    }
  }

  const columns = [
    { title: 'Username', dataIndex: 'username' },
    {
      title: 'Created',
      dataIndex: 'created_at',
      render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: 'Actions',
      width: 220,
      render: (_: unknown, record: AdminUser) => {
        const isSelf = record.id === currentUser?.id
        return (
          <Space>
            <Button
              size="small"
              onClick={() => {
                form.resetFields()
                setDialog({ kind: 'reset', user: record })
              }}
            >
              Reset password
            </Button>
            <Popconfirm
              title="Delete this user?"
              disabled={isSelf}
              onConfirm={() => deleteUser.mutate(record.id)}
            >
              <Button size="small" danger disabled={isSelf}>
                {isSelf ? 'You' : 'Delete'}
              </Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <Button
        type="primary"
        style={{ marginBottom: 16 }}
        onClick={() => {
          form.resetFields()
          setDialog({ kind: 'create' })
        }}
      >
        Create User
      </Button>
      <Table rowKey="id" columns={columns} dataSource={users} loading={isLoading} pagination={false} />

      <Modal
        title={dialog?.kind === 'reset' ? `Reset password — ${dialog.user.username}` : 'Create user'}
        open={dialog !== null}
        onCancel={() => setDialog(null)}
        onOk={() => form.submit()}
        confirmLoading={createUser.isPending || resetPassword.isPending}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          {dialog?.kind === 'create' && (
            <Form.Item
              name="username"
              label="Username"
              rules={[{ required: true, message: 'Username is required' }]}
            >
              <Input />
            </Form.Item>
          )}
          <Form.Item
            name="password"
            label={dialog?.kind === 'reset' ? 'New password' : 'Password'}
            rules={[
              { required: true },
              { min: 8, message: 'Minimum 8 characters' },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirm password"
            dependencies={['password']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || value === getFieldValue('password')
                    ? Promise.resolve()
                    : Promise.reject(new Error('Passwords do not match')),
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
