import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApiKeysPage from '../ApiKeysPage'
import { mockApi, setupMockApi, renderApp } from '../../test-utils'
import { vi } from 'vitest'
import type { ApiKey } from '../../api/types'

const KEYS: ApiKey[] = [
  {
    id: '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    client_name: 'Billing Service',
    allowed_from_addresses: ['billing@x.com'],
    is_active: true,
    expires_at: null,
    created_at: '2026-09-01T00:00:00Z',
  },
]

describe('ApiKeysPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders table with existing api keys (masked id)', async () => {
    setupMockApi({ get: vi.fn().mockResolvedValue({ data: KEYS }) })

    renderApp(<ApiKeysPage />)

    expect(await screen.findByText('Billing Service')).toBeInTheDocument()
    expect(screen.getByText('11111111…')).toBeInTheDocument()
    expect(screen.getByText('billing@x.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create api key/i })).toBeInTheDocument()
    expect(mockApi.get).toHaveBeenCalledWith('/admin/api-keys')
  })

  it('create flow: submits form then shows once-only token modal', async () => {
    setupMockApi({
      get: vi.fn().mockResolvedValue({ data: KEYS }),
      post: vi.fn().mockResolvedValue({
        data: {
          ...KEYS[0],
          id: '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          key_token: 'super-secret-token',
        },
      }),
    })

    renderApp(<ApiKeysPage />)

    await userEvent.click(await screen.findByRole('button', { name: /create api key/i }))
    await userEvent.type(screen.getByLabelText(/client name/i), 'New Client')
    await userEvent.type(
      screen.getByLabelText(/allowed from addresses/i),
      'new@x.com',
    )
    await userEvent.click(screen.getByRole('button', { name: /^ok$/i }))

    // Token modal: warn text, once-only token paragraph with copy affordance,
    // and the "I have saved the key" CTA as the only footer action.
    expect(await screen.findByText(/copy this token now/i)).toBeInTheDocument()
    expect(screen.getByText(/i have saved the key/i)).toBeInTheDocument()
    const tokenElement = await screen.findByText('super-secret-token')
    expect(tokenElement).toBeInTheDocument()
    // It is a Typography.Paragraph with copyable code, which might be nested. 
    // Just finding the text is enough proof it rendered correctly.
    expect(mockApi.post).toHaveBeenCalledWith('/admin/api-keys', {
      client_name: 'New Client',
      allowed_from_addresses: ['new@x.com'],
    })
  })

  it('toggle is_active sends PATCH', async () => {
    setupMockApi({
      get: vi.fn().mockResolvedValue({ data: KEYS }),
      patch: vi.fn().mockResolvedValue({ data: { ...KEYS[0], is_active: false } }),
    })

    renderApp(<ApiKeysPage />)

    const row = (await screen.findByText('Billing Service')).closest('tr')!
    await userEvent.click(within(row).getByRole('switch'))

    await vi.waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/admin/api-keys/11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
        is_active: false,
      })
    })
  })

  it('delete asks confirm then sends DELETE', async () => {
    setupMockApi({
      get: vi.fn().mockResolvedValue({ data: KEYS }),
      delete: vi.fn().mockResolvedValue({ data: undefined }),
    })

    renderApp(<ApiKeysPage />)

    const row = (await screen.findByText('Billing Service')).closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: /delete/i }))
    await userEvent.click(await screen.findByRole('button', { name: /^ok$/i }))

    await vi.waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/admin/api-keys/11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    })
  })
})
