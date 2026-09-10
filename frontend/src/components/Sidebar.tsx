import React from 'react'
import { Menu, Drawer, Button, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined,
  KeyOutlined,
  TeamOutlined,
  FileTextOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { Space } from 'antd'

export interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

type MenuItem = Required<MenuProps>['items'][number]

const MENU_ITEMS: MenuItem[] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/api-keys', icon: <KeyOutlined />, label: 'API Keys' },
  { key: '/users', icon: <TeamOutlined />, label: 'Users' },
  { key: '/logs', icon: <FileTextOutlined />, label: 'Logs' },
  { key: '/test-email', icon: <MailOutlined />, label: 'Test Email' },
]

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { mode } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
  }

  const handleMobileMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
    onCloseMobile()
  }

  const themeMode = mode === 'dark' ? 'dark' : 'light'

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside
        aria-label="Desktop Sidebar"
        className={`hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141414] ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand / Header */}
        <div
          className={`h-16 flex items-center border-b border-gray-200 dark:border-gray-800 px-4 transition-all duration-200 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {collapsed ? (
            <Tooltip title="Email Gateway" placement="right">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <MailOutlined className="text-xl" />
              </div>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <MailOutlined className="text-lg" />
              </div>
              <span className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate">
                Email Gateway
              </span>
            </div>
          )}

          {!collapsed && (
            <Button
              type="text"
              size="small"
              icon={<MenuFoldOutlined />}
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            />
          )}
        </div>

        {/* Semantic Navigation */}
        <nav aria-label="Main Navigation" className="flex-1 overflow-y-auto py-3 px-2">
          <Menu
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[location.pathname]}
            items={MENU_ITEMS}
            onClick={handleMenuClick}
            theme={themeMode}
            style={{ borderRight: 0, background: 'transparent' }}
          />
        </nav>

        {/* Desktop Footer with Expand button when collapsed */}
        {collapsed && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 flex justify-center">
            <Tooltip title="Expand sidebar" placement="right">
              <Button
                type="text"
                size="small"
                icon={<MenuUnfoldOutlined />}
                onClick={onToggleCollapse}
                aria-label="Expand sidebar"
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              />
            </Tooltip>
          </div>
        )}
      </aside>

      {/* Mobile Drawer */}
      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={onCloseMobile}
        width={260}
        styles={{
          body: { padding: 0 },
          header: { padding: '12px 16px' },
        }}
        title={
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <MailOutlined className="text-base" />
            </div>
            <span className="font-semibold text-base text-gray-900 dark:text-gray-100">
              Email Gateway
            </span>
          </div>
        }
      >
        <nav aria-label="Mobile Navigation" className="py-2 px-2 flex-1">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={MENU_ITEMS}
            onClick={handleMobileMenuClick}
            theme={themeMode}
            style={{ borderRight: 0, background: 'transparent' }}
          />
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <Space className="text-gray-700 dark:text-gray-300 text-sm">
            <UserOutlined />
            <span>Profile</span>
          </Space>
          <Button type="link" onClick={() => navigate('/login')} className="text-red-500">
            Logout
          </Button>
        </div>
      </Drawer>
    </>
  )
}
