/** Shared API response types (mirror of backend Pydantic schemas). */

export interface ApiKey {
  id: string
  client_name: string
  allowed_from_addresses: string[]
  is_active: boolean
  expires_at: string | null
  created_at: string | null
  key_token: string
}

/** Create response only: key_token is shown exactly once. */
export interface ApiKeyCreated extends ApiKey {
  key_token: string
}

export interface Transaction {
  id: string
  task_id: string
  from_address: string
  to_addresses: string[]
  cc_addresses: string[]
  subject: string
  attachment_count: number
  status: 'queued' | 'sent' | 'failed'
  error_message: string | null
  retry_count: number
  created_at: string | null
  delivered_at: string | null
}

export interface TransactionPage {
  items: Transaction[]
  total_count: number
  page: number
  page_size: number
}
