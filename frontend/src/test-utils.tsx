import { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, App as AntdApp } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { render, type RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'
import api from './api/client'
import { AuthProvider } from './hooks/useAuth'

/**
 * The api client is globally mocked in src/test-setup.ts
 * (vi.mock('./api/client')), so this import resolves to the mock.
 * Cast is required because the runtime shape differs from the axios type.
 */
export const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

/** Reset all mock call history, apply safe defaults, then per-test overrides. */
export function setupMockApi(overrides: Partial<typeof mockApi> = {}) {
  mockApi.get.mockReset().mockRejectedValue(new Error('api.get not mocked'))
  mockApi.post.mockReset().mockRejectedValue(new Error('api.post not mocked'))
  mockApi.patch.mockReset().mockRejectedValue(new Error('api.patch not mocked'))
  mockApi.delete.mockReset().mockRejectedValue(new Error('api.delete not mocked'))
  Object.assign(mockApi, overrides)
  return mockApi
}

/** Render helper: MemoryRouter + ConfigProvider + QueryClient + AuthProvider. */
export function renderApp(ui: ReactNode, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={['/']}>
      {/* motion:false = official antd recommendation for tests; jsdom never fires
          animationend, so leave-animations would leave stale DOM behind. */}
      <ConfigProvider theme={{ token: { colorPrimary: '#1677ff', motion: false } }}>
        <AntdApp>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>{ui}</AuthProvider>
          </QueryClientProvider>
        </AntdApp>
      </ConfigProvider>
    </MemoryRouter>,
    options,
  )
}
