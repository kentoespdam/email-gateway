import { Card, Statistic, Space } from 'antd'
import React from 'react'

interface MetricCardProps {
  title: string
  value: string | number
  prefixIcon?: React.ReactNode
  color?: string
  suffix?: string
  subtext?: string
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, prefixIcon, color, suffix, subtext }) => {
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space size={8}>
          <span style={{ color }}>{prefixIcon}</span>
          <span style={{ fontSize: 14, color: '#888' }}>{title}</span>
        </Space>
        <Statistic value={value} suffix={suffix} valueStyle={{ fontSize: 24, fontWeight: 'bold' }} />
        {subtext && <div style={{ fontSize: 12, color: '#aaa' }}>{subtext}</div>}
      </Space>
    </Card>
  )
}
