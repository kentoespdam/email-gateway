import { Collapse, Descriptions, Drawer, Tag, Alert } from 'antd';
import type { Transaction } from '../../api/types';

interface Props {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
}

export default function TransactionDetailDrawer({ transaction, open, onClose }: Props) {
  if (!transaction) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'success';
      case 'failed': return 'error';
      case 'queued': return 'processing';
      default: return 'default';
    }
  };

  return (
    <Drawer
      title={`Transaction: ${transaction.task_id}`}
      width={640}
      onClose={onClose}
      open={open}
    >
      <div style={{ marginBottom: 24 }}>
        <Tag color={getStatusColor(transaction.status)}>{transaction.status.toUpperCase()}</Tag>
      </div>

      {transaction.error_message && (
        <Alert
          message="Error Details"
          description={<pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{transaction.error_message}</pre>}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label="ID">{transaction.id}</Descriptions.Item>
        <Descriptions.Item label="Task ID">{transaction.task_id}</Descriptions.Item>
        <Descriptions.Item label="From">{transaction.from_address}</Descriptions.Item>
        <Descriptions.Item label="To">{transaction.to_addresses.join(', ')}</Descriptions.Item>
        <Descriptions.Item label="CC">{transaction.cc_addresses.join(', ') || '-'}</Descriptions.Item>
        <Descriptions.Item label="Attachments">{transaction.attachment_count}</Descriptions.Item>
        <Descriptions.Item label="Retries">{transaction.retry_count}</Descriptions.Item>
        <Descriptions.Item label="Created At">{transaction.created_at ? new Date(transaction.created_at).toLocaleString() : '-'}</Descriptions.Item>
        <Descriptions.Item label="Delivered At">{transaction.delivered_at ? new Date(transaction.delivered_at).toLocaleString() : '-'}</Descriptions.Item>
      </Descriptions>

      <Collapse ghost>
        <Collapse.Panel header="Raw JSON Data" key="1">
          <pre className="p-3 rounded text-xs font-mono overflow-x-auto bg-gray-100 text-gray-800 dark:bg-[#1f1f1f] dark:text-gray-200 border border-gray-200 dark:border-gray-700">
            {JSON.stringify(transaction, null, 2)}
          </pre>
        </Collapse.Panel>
      </Collapse>
    </Drawer>
  );
}
