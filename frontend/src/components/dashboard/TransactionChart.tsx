import { Card, Progress, Space, Typography } from 'antd'
import React from 'react'

interface ChartProps {
  delivered: number
  queued: number
  failed: number
  total: number
}

export const TransactionChart: React.FC<ChartProps> = ({ delivered, queued, failed, total }) => {
  const percentDelivered = total > 0 ? (delivered / total) * 100 : 0


  return (
    <Card title="Status Breakdown" size="small" style={{ borderRadius: 8, height: '100%' }}>
      <Progress
        percent={percentDelivered}
        success={{ percent: percentDelivered }}
        status="active"
        strokeColor="#52c41a"
      />
      <div style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">Delivery Progress</Typography.Text>
      </div>
      <Space wrap style={{ marginTop: 16 }}>
        <div style={{ padding: '4px 12px', background: '#f6ffed', borderRadius: 4, color: '#52c41a' }}>Delivered: {delivered}</div>
        <div style={{ padding: '4px 12px', background: '#e6f7ff', borderRadius: 4, color: '#1890ff' }}>Queued: {queued}</div>
        <div style={{ padding: '4px 12px', background: '#fff2f0', borderRadius: 4, color: '#ff4d4f' }}>Failed: {failed}</div>
      </Space>
    </Card>
  )
}
