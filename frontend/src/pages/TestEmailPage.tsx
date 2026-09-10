import { useState } from 'react'
import { Button, Form, Input, Select, Radio, message } from 'antd'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Editor } from '@tinymce/tinymce-react'
import api from '../api/client'
import type { ApiKey } from '../api/types'

export default function TestEmailPage() {
  const [form] = Form.useForm()
  const [contentMode, setContentMode] = useState<'text' | 'html'>('text')
  
  const { data: keys = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => (await api.get<ApiKey[]>('/admin/api-keys')).data,
  })

  const sendEmail = useMutation({
    mutationFn: async (payload: any) => await api.post('/admin/emails/test-send', payload),
    onSuccess: () => message.success('Email test sent successfully'),
    onError: () => message.error('Failed to send test email'),
  })

  const onFinish = (values: any) => {
    sendEmail.mutate(values)
  }

  return (
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
  )
}
