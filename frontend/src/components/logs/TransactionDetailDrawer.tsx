import { Collapse, Descriptions, Drawer, Tag, Alert } from 'antd'
import type { DescriptionsProps, CollapseProps } from 'antd'
import type { Transaction } from '../../api/types'

interface Props {
  transaction: Transaction | null
  open: boolean
  onClose: () => void
}

export default function TransactionDetailDrawer({ transaction, open, onClose }: Props) {
  if (!transaction) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'success'
      case 'failed': return 'error'
      case 'queued': return 'processing'
      default: return 'default'
    }
  }

  const items: DescriptionsProps['items'] = [
    { key: 'id', label: 'ID', children: transaction.id },
    { key: 'task_id', label: 'Task ID', children: transaction.task_id },
    { key: 'from', label: 'From', children: transaction.from_address },
    { key: 'to', label: 'To', children: (transaction.to_addresses || []).join(', ') },
    { key: 'cc', label: 'CC', children: (transaction.cc_addresses || []).join(', ') || '-' },
    { key: 'attachments', label: 'Attachments', children: transaction.attachment_count },
    { key: 'retries', label: 'Retries', children: transaction.retry_count },
    { key: 'created_at', label: 'Created At', children: transaction.created_at ? new Date(transaction.created_at).toLocaleString() : '-' },
    { key: 'delivered_at', label: 'Delivered At', children: transaction.delivered_at ? new Date(transaction.delivered_at).toLocaleString() : '-' },
  ]

  const collapseItems: CollapseProps['items'] = [
    {
      key: '1',
      label: 'Raw JSON Data',
      children: (
        <pre className="p-3 rounded text-xs font-mono overflow-x-auto bg-gray-100 text-gray-800 dark:bg-[#1f1f1f] dark:text-gray-200 border border-gray-200 dark:border-gray-700">
          {JSON.stringify(transaction, null, 2)}
        </pre>
      ),
    },
  ]

  return (
    <Drawer
      title={`Transaction: ${transaction.task_id}`}
      width={typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 580}
      styles={{ wrapper: { maxWidth: '100vw' } }}
      onClose={onClose}
      open={open}
    >
      <div style={{ marginBottom: 24 }}>
        <Tag color={getStatusColor(transaction.status)}>{transaction.status.toUpperCase()}</Tag>
      </div>

      {transaction.error_message && (
        <Alert
          message="Error Details"
          description={<pre className="whitespace-pre-wrap font-mono text-xs break-all overflow-x-auto">{transaction.error_message}</pre>}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }} items={items.map(item => ({
        ...item,
        children: <div className="break-all">{item.children}</div>
      }))} />

      <Collapse ghost items={collapseItems} />
    </Drawer>
  )
}
