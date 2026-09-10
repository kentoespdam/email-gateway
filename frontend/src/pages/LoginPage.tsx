import { Button, Card, Form, Input, message } from 'antd'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

interface LoginForm {
  username: string
  password: string
}

export default function LoginPage() {
  const { login } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  const onFinish = async (values: LoginForm) => {
    setSubmitting(true)
    try {
      await login(values)
    } catch {
      message.error('Invalid username or password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
      }}
    >
      <Card title="Email Gateway — Admin Login" style={{ width: 360 }}>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Log in
          </Button>
        </Form>
      </Card>
    </div>
  )
}
