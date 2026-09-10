import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, theme } from 'antd'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ThemeContextProvider, useTheme } from './context/ThemeContext'

const queryClient = new QueryClient()

const ThemedConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mode } = useTheme();
  return (
    <ConfigProvider
      theme={{
        algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { borderRadius: 8, colorPrimary: '#1677ff' },
      }}
    >
      {children}
    </ConfigProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeContextProvider>
      <ThemedConfigProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </ThemedConfigProvider>
    </ThemeContextProvider>
  </StrictMode>,
)
