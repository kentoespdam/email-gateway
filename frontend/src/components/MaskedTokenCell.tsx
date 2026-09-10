import { useState } from 'react'
import { Button, Space, Typography, message } from 'antd'
import { EyeOutlined, EyeInvisibleOutlined, CopyOutlined } from '@ant-design/icons'

interface MaskedTokenCellProps {
  token: string
}

export function MaskedTokenCell({ token }: MaskedTokenCellProps) {
  const [visible, setVisible] = useState(false)

  if (!token) return <>-</>

  const masked = token.length > 8 
    ? `${token.slice(0, 4)}••••••••${token.slice(-4)}`
    : '••••••••'

  return (
    <Space>
      <Typography.Text code>
        {visible ? token : masked}
      </Typography.Text>
      <Button
        type="text"
        size="small"
        icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        onClick={() => setVisible(!visible)}
      />
      <Button
        type="text"
        size="small"
        icon={<CopyOutlined />}
        onClick={() => {
          navigator.clipboard
            .writeText(token)
            .then(() => {
              void message.success('Token copied to clipboard')
            })
            .catch(() => {
              void message.error('Failed to copy to clipboard')
            })
        }}
      />
    </Space>
  )
}
