import { Card, Progress, Space, Typography, theme } from 'antd'
import React from 'react'

interface ChartProps {
  delivered: number
  queued: number
  failed: number
  total: number
}

export const TransactionChart: React.FC<ChartProps> = ({ delivered, queued, failed, total }) => {
  const { token } = theme.useToken()
  const percentDelivered = total > 0 ? (delivered / total) * 100 : 0

  return (
    <Card title="Status Breakdown" size="small" style={{ borderRadius: 8, height: '100%' }}>
      <Progress
        percent={percentDelivered}
        success={{ percent: percentDelivered }}
        status="active"
        strokeColor={token.colorSuccess}
      />
      <div style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">Delivery Progress</Typography.Text>
      </div>
      <Space wrap style={{ marginTop: 16 }}>
        <div style={{ padding: '4px 12px', background: token.colorSuccessBg, borderRadius: 4, color: token.colorSuccess, border: `1px solid ${token.colorSuccessBorder}` }}>Delivered: {delivered}</div>
        <div style={{ padding: '4px 12px', background: token.colorInfoBg, borderRadius: 4, color: token.colorInfo, border: `1px solid ${token.colorInfoBorder}` }}>Queued: {queued}</div>
        <div style={{ padding: '4px 12px', background: token.colorErrorBg, borderRadius: 4, color: token.colorError, border: `1px solid ${token.colorErrorBorder}` }}>Failed: {failed}</div>
      </Space>
    </Card>
  )
}
