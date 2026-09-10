import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../../pages/LoginPage'
import { mockApi, setupMockApi, renderApp } from '../../test-utils'
import { vi } from 'vitest'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form with username + password', () => {
    setupMockApi()
    renderApp(<LoginPage />)
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  it('calls login and navigates on success', async () => {
    setupMockApi({
      post: vi.fn().mockResolvedValue({ data: { id: 'u-1', username: 'admin' } }),
    })

    renderApp(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/username/i), 'admin')
    await userEvent.type(screen.getByLabelText(/password/i), 'pass1234')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    // Login POST must have been fired with the credentials.
    await vi.waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/admin/auth/login', {
        username: 'admin',
        password: 'pass1234',
      })
    })
  }, 15000)

  it('shows error message on login failure', async () => {
    setupMockApi({
      post: vi.fn().mockRejectedValue(new Error('bad')),
    })

    renderApp(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/username/i), 'admin')
    await userEvent.type(screen.getByLabelText(/password/i), 'pass1234')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    await screen.findByText(/invalid username or password/i)
  }, 15000)
})
