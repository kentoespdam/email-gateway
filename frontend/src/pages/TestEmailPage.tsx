import { useState } from 'react'
import { Button, Form, Input, Select, message, Badge, Segmented, Alert } from 'antd'
import { useQuery, useMutation } from '@tanstack/react-query'
import { SendOutlined, CopyOutlined } from '@ant-design/icons'
import ReactQuill from 'react-quill-new'
import 'quill/dist/quill.snow.css'
import api from '../api/client'
import type { ApiKey } from '../api/types'

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image'],
    ['clean'],
  ],
}

export default function TestEmailPage() {
  const [form] = Form.useForm()
  const [contentMode, setContentMode] = useState<'text' | 'html'>('text')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [activeApiKeyToken, setActiveApiKeyToken] = useState<string | null>(null)

  const { data: keys = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => (await api.get<ApiKey[]>('/admin/api-keys')).data,
  })

  const selectedKey = Form.useWatch('api_key_id', form)
  const keyInfo = keys.find(k => k.id === selectedKey)

  const { data: status } = useQuery({
    queryKey: ['email-status', taskId, activeApiKeyToken],
    queryFn: async () =>
      (
        await api.get(`/api/v1/emails/${taskId}`, {
          headers: activeApiKeyToken ? { 'X-API-Key': activeApiKeyToken } : undefined,
        })
      ).data,
    enabled: !!taskId && !!activeApiKeyToken,
    refetchInterval: (query) => (query.state.data?.status === 'queued' ? 2000 : false),
  })

  const sendEmail = useMutation({
    mutationFn: (payload: any) => api.post('/admin/emails/test-send', payload),
    onSuccess: (res) => {
      void message.success('Email test submitted')
      setTaskId(res.data.task_id)
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (typeof detail === 'string') {
        void message.error(detail)
      } else if (Array.isArray(detail)) {
        void message.error(detail.map((e: any) => e.msg).join(', '))
      } else {
        void message.error('Failed to submit email test')
      }
    },
  })

  const onFinish = (values: any) => {
    const selected = keys.find((k) => k.id === values.api_key_id)
    if (selected) setActiveApiKeyToken(selected.key_token)
    const payload = {
      ...values,
      to: typeof values.to === 'string' ? values.to.split(',').map((s: string) => s.trim()) : values.to,
    }
    sendEmail.mutate(payload)
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Email</h1>
        <p className="text-gray-500 dark:text-gray-400">Send a test email using your API keys.</p>
      </div>
      <Form form={form} layout="vertical" onFinish={onFinish} className="p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141414] shadow-sm mb-6">
        <Form.Item name="api_key_id" label="API Key" rules={[{ required: true }]}>
          <Select size="large" placeholder="Select API Key" options={keys.map((k) => ({ value: k.id, label: k.client_name }))} />
        </Form.Item>
        <Form.Item name="from_address" label="From Address" rules={[{ required: true }]}>
          <Input size="large" placeholder="e.g. sender@example.com" />
        </Form.Item>
        {keyInfo && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-[#1f1f1f] rounded border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Allowed Addresses (Click to use):</p>
            <div className="flex flex-wrap gap-2">
              {keyInfo.allowed_from_addresses.map(addr => (
                <button type="button" key={addr} onClick={() => form.setFieldValue('from_address', addr)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">{addr}</button>
              ))}
            </div>
          </div>
        )}
        <Form.Item name="to" label="To" rules={[{ required: true }]}>
          <Select mode="tags" size="large" placeholder="e.g. recipient@example.com (press Enter)" />
        </Form.Item>
        <Form.Item name="subject" label="Subject" rules={[{ required: true }]}>
          <Input size="large" placeholder="e.g. Test Email Subject" />
        </Form.Item>
        <Form.Item label="Content Mode">
          <Segmented block size="large" options={[{ label: 'Plain Text', value: 'text' }, { label: 'Rich HTML (Quill)', value: 'html' }]} value={contentMode} onChange={(v) => setContentMode(v as 'text' | 'html')} className="mb-4" />
        </Form.Item>
        {contentMode === 'text' ? (
          <Form.Item name="text_content" label="Content">
            <Input.TextArea size="large" rows={6} placeholder="Enter your email content..." />
          </Form.Item>
        ) : (
          <Form.Item name="html_content" label="Content">
            <ReactQuill theme="snow" modules={quillModules} placeholder="Write email HTML content here..." />
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" size="large" block loading={sendEmail.isPending} icon={<SendOutlined />} className="h-12 text-base font-semibold rounded-xl">Send Test Email</Button>
      </Form>
      {taskId && status && (
        <Alert
          type={status.status === 'sent' ? 'success' : status.status === 'failed' ? 'error' : 'info'}
          message={
            <div className="flex justify-between items-center">
              <span>Task ID: {status.task_id}</span>
              <Button icon={<CopyOutlined />} size="small" onClick={() => navigator.clipboard.writeText(status.task_id)}>Copy</Button>
            </div>
          }
          description={
            <div className="mt-2">
              <p>Status: <Badge status={status.status === 'sent' ? 'success' : status.status === 'failed' ? 'error' : 'processing'} text={status.status} /></p>
              {status.error_message && <p className="text-xs font-mono mt-2 bg-white/50 p-2 rounded">{status.error_message}</p>}
            </div>
          }
          showIcon
        />
      )}
    </div>
  )
}
