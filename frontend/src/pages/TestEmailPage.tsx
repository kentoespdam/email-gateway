import { useState } from 'react'
import { Button, Form, Input, Select, Radio, message, Card, Descriptions, Badge } from 'antd'
import { useQuery, useMutation } from '@tanstack/react-query'
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

  const { data: status, isFetching } = useQuery({
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

    // Map 'to' input to 'to' array for payload matching EmailPayload schema
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
          <Select
            options={keys.map((k) => ({ value: k.id, label: k.client_name }))}
          />
        </Form.Item>
        <Form.Item name="from_address" label="From Address" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="to" label="To (comma-separated)" rules={[{ required: true }]}>
          <Select mode="tags" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="subject" label="Subject" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="content_mode" label="Content Mode" initialValue="text">
          <Radio.Group onChange={(e) => setContentMode(e.target.value)}>
            <Radio.Button value="text">Text</Radio.Button>
            <Radio.Button value="html">HTML</Radio.Button>
          </Radio.Group>
        </Form.Item>
        {contentMode === 'text' ? (
          <Form.Item name="text_content" label="Content">
            <Input.TextArea rows={6} />
          </Form.Item>
        ) : (
          <Form.Item name="html_content" label="Content">
            <ReactQuill
              theme="snow"
              modules={quillModules}
              placeholder="Write email HTML content here..."
            />
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" loading={sendEmail.isPending} className="w-full sm:w-auto h-11 text-base font-medium">Send Test Email</Button>
      </Form>
      {taskId && status && (
        <Card title="Status" extra={isFetching && 'Polling...'}>
          <Descriptions
            column={1}
            items={[
              { key: 'task_id', label: 'Task ID', children: status.task_id },
              {
                key: 'status',
                label: 'Status',
                children: (
                  <Badge
                    status={status.status === 'sent' ? 'success' : status.status === 'failed' ? 'error' : 'processing'}
                    text={status.status}
                  />
                ),
              },
              { key: 'error', label: 'Error', children: status.error_message || '-' },
            ]}
          />
        </Card>
      )}
    </div>
  )
}
