import { Button, Card, Form, Input, message } from 'antd'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { MailOutlined } from '@ant-design/icons'

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
    <div className="min-h-screen min-h-svh min-h-dvh flex items-center justify-center p-4 bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100">
      <Card 
        title={
          <div className="flex items-center gap-2">
            <MailOutlined />
            <span>Email Gateway — Admin Login</span>
          </div>
        } 
        className="w-full max-w-sm sm:max-w-md shadow-xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141414]"
      >
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting} className="h-11 text-base font-medium rounded-lg">
            Log in
          </Button>
        </Form>
      </Card>
    </div>
  )
}
