import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../useAuth'
import { mockApi, setupMockApi } from '../../test-utils'
import { vi } from 'vitest'

function Probe() {
  const { user, isLoading } = useAuth()
  return (
    <div>
      <span data-testid="user-id">{user?.id ?? 'none'}</span>
      <span data-testid="loading">{String(isLoading)}</span>
    </div>
  )
}

function withRouter(ui: React.ReactNode) {
  return <MemoryRouter>{ui}</MemoryRouter>
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches /admin/auth/me on mount and exposes user', async () => {
    setupMockApi({
      get: vi.fn().mockResolvedValue({
        data: { id: 'u-1', username: 'admin', created_at: null },
      }),
    })

    render(withRouter(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    ))

    expect(screen.getByTestId('loading').textContent).toBe('true')
    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('u-1')
    })
    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(mockApi.get).toHaveBeenCalledWith('/admin/auth/me')
  })

  it('sets user to null when /admin/auth/me fails', async () => {
    setupMockApi({
      get: vi.fn().mockRejectedValue(new Error('unauthorized')),
    })

    render(withRouter(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    ))

    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('none')
    })
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('login posts credentials and logout posts logout', async () => {
    setupMockApi({
      get: vi.fn().mockRejectedValue(new Error('unauthorized')),
      post: vi.fn().mockResolvedValue({
        data: { id: 'u-2', username: 'bob', created_at: null },
      }),
    })

    let ctx: ReturnType<typeof useAuth> | null = null
    function Capture() {
      ctx = useAuth()
      return null
    }

    render(withRouter(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    ))

    await waitFor(() => {
      expect(ctx).not.toBeNull()
    })

    await ctx!.login({ username: 'bob', password: 'secret123' })
    expect(mockApi.post).toHaveBeenCalledWith('/admin/auth/login', {
      username: 'bob',
      password: 'secret123',
    })

    ctx!.logout()
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/admin/auth/logout')
    })
  })
})
