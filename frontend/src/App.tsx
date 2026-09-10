import { useState } from 'react'
import { Space, Badge, Button } from 'antd'
import { UserOutlined, MenuOutlined } from '@ant-design/icons'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeToggle } from './components/common/ThemeToggle'
import { Sidebar } from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ApiKeysPage from './pages/ApiKeysPage'
import UsersPage from './pages/UsersPage'
import LogsPage from './pages/LogsPage'
import TestEmailPage from './pages/TestEmailPage'

function Shell() {
  const { user, isLoading, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Skip Link Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:font-medium focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Skip to main content
      </a>

      {/* Sidebar Component */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 px-3 sm:px-4 md:px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141414] transition-colors duration-200 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex items-center justify-center text-gray-700 dark:text-gray-200 min-h-[44px] min-w-[44px]"
              aria-label="Open navigation menu"
            />
            <Badge
              status="processing"
              color="#52c41a"
              text={
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Gateway Online
                </span>
              }
            />
          </div>

          <Space size="middle">
            <ThemeToggle />
            <Space className="text-gray-700 dark:text-gray-300 text-sm hidden sm:flex">
              <UserOutlined />
              <span>{user.username}</span>
            </Space>
            <Button
              type="link"
              onClick={logout}
              className="text-red-500 hover:text-red-600 p-0 min-h-[44px]"
            >
              Logout
            </Button>
          </Space>
        </header>

        {/* Content Area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 overflow-y-auto outline-none"
        >
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/test-email" element={<TestEmailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
