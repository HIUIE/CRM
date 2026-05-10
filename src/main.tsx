import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import ErrorBoundary from './components/ui/ErrorBoundary.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { queryClient } from './lib/query.ts';
import { installRuntimeRecovery } from './lib/runtimeRecovery.ts';
import './index.css';

// Global Day.js Configuration
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/zh-cn';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('zh-cn');
dayjs.tz.setDefault("Asia/Shanghai");

installRuntimeRecovery();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
