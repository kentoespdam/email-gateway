import { useState } from 'react'
import { Button, Form, Input, Select, Radio, message, Card, Descriptions, Badge, Space } from 'antd'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Editor } from '@tinymce/tinymce-react'
import api from '../api/client'
import type { ApiKey } from '../api/types'

export default function TestEmailPage() {
  const [form] = Form.useForm()
  const [contentMode, setContentMode] = useState<'text' | 'html'>('text')
  const [taskId, setTaskId] = useState<string | null>(null)

  const { data: keys = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => (await api.get<ApiKey[]>('/admin/api-keys')).data,
  })

  const { data: status, isFetching } = useQuery({
    queryKey: ['email-status', taskId],
    queryFn: async () => (await api.get(`/api/v1/emails/${taskId}`)).data,
    enabled: !!taskId,
    refetchInterval: (query) => (query.state.data?.status === 'queued' ? 2000 : false),
  })

  const sendEmail = useMutation({
    mutationFn: async (payload: any) => await api.post('/api/v1/emails/send', payload),
    onSuccess: (res) => {
      message.success('Email test submitted')
      setTaskId(res.data.task_id)
    },
    onError: () => message.error('Failed to submit email test'),
  })

  const onFinish = (values: any) => {
    sendEmail.mutate(values)
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="api_key_id" label="API Key" rules={[{ required: true }]}>
          <Select>
            {keys.map((k) => <Select.Option key={k.id} value={k.id}>{k.client_name}</Select.Option>)}
          </Select>
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
            <Editor
              apiKey="no-api-key"
              init={{
                height: 300,
                menubar: false,
                plugins: ['link', 'image', 'lists'],
                toolbar: 'undo redo | formatselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat'
              }}
            />
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" loading={sendEmail.isPending}>Send Test Email</Button>
      </Form>
      {taskId && status && (
        <Card title="Status" extra={isFetching && 'Polling...'}>
          <Descriptions column={1}>
            <Descriptions.Item label="Task ID">{status.task_id}</Descriptions.Item>
            <Descriptions.Item label="Status"><Badge status={status.status === 'sent' ? 'success' : status.status === 'failed' ? 'error' : 'processing'} text={status.status} /></Descriptions.Item>
            <Descriptions.Item label="Error">{status.error_message || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </Space>
  )
}
