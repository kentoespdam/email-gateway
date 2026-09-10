import { useState } from 'react'
import { Button, Typography, message } from 'antd'
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
    <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Typography.Text code className="whitespace-nowrap font-mono text-xs">
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
    </div>
  )
}
