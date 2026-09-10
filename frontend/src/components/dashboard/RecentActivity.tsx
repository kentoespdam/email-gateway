import { Card, List, Badge, Typography } from 'antd'
import React from 'react'
import type { Transaction } from '../../api/types'

interface ActivityProps {
  transactions: Transaction[]
}

export const RecentActivity: React.FC<ActivityProps> = ({ transactions }) => {
  return (
    <Card title="Recent Activity" size="small" style={{ borderRadius: 8, height: '100%' }}>
      <List
        size="small"
        dataSource={transactions.slice(0, 5)}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography.Text ellipsis style={{ maxWidth: '60%' }}>{item.subject}</Typography.Text>
                  <Badge
                    status={item.status === 'sent' ? 'success' : item.status === 'failed' ? 'error' : 'processing'}
                    text={item.status}
                  />
                </div>
              }
              description={(item.to_addresses || []).join(', ')}
            />
          </List.Item>
        )}
      />
    </Card>
  )
}
