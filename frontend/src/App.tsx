import { Layout, Menu } from 'antd'
import { KeyOutlined, FileTextOutlined, TeamOutlined, UserOutlined, MailOutlined } from '@ant-design/icons'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import ApiKeysPage from './pages/ApiKeysPage'
import UsersPage from './pages/UsersPage'
import LogsPage from './pages/LogsPage'
import TestEmailPage from './pages/TestEmailPage'

const { Header, Sider, Content } = Layout

const MENU_ITEMS = [
  { key: '/api-keys', icon: <KeyOutlined />, label: 'API Keys' },
  { key: '/users', icon: <TeamOutlined />, label: 'Users' },
  { key: '/logs', icon: <FileTextOutlined />, label: 'Logs' },
  { key: '/test-email', icon: <MailOutlined />, label: 'Test Email' },
]

function Shell() {
  const { user, isLoading, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <div style={{ color: '#fff', padding: 16, fontWeight: 600 }}>Email Gateway</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={MENU_ITEMS}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <UserOutlined />
          <span>{user.username}</span>
          <a onClick={logout}>Logout</a>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/api-keys" replace />} />
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
