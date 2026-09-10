import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom does not implement window.matchMedia; antd's responsive observer needs it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // deprecated
      removeListener: () => {}, // deprecated
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// jsdom lacks ResizeObserver; needed by antd Popconfirm/Tooltip positioning.
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(window as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverMock
}

// Mock the shared axios api client for every test file (registered before all imports).
vi.mock('./api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))
