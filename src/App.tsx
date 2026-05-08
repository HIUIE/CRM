/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/ui/ErrorBoundary';
import VersionGuard from './components/VersionGuard';
import { Toaster } from 'sonner';
import { lazyRetry } from './lib/lazyRetry';

// --- Lazy-loaded pages for code splitting ---
const DashboardView = lazy(lazyRetry(() => import('./pages/Dashboard')));
const AIAssistantView = lazy(lazyRetry(() => import('./pages/AIAssistant')));
const OrderDetailPage = lazy(lazyRetry(() => import('./pages/OrderDetail')));
const SettingsView = lazy(lazyRetry(() => import('./pages/Settings')));
const HelpCenterPage = lazy(lazyRetry(() => import('./pages/HelpCenter')));
const LoginScreen = lazy(lazyRetry(() => import('./pages/Login')));
const OrdersView = lazy(lazyRetry(() => import('./components/OrdersView')));
const FinanceView = lazy(lazyRetry(() => import('./components/FinanceView')));
const LogisticsView = lazy(lazyRetry(() => import('./components/LogisticsView')));
const CustomersView = lazy(lazyRetry(() => import('./components/CustomersView')));
const CustomerDetailPage = lazy(lazyRetry(() => import('./pages/CustomerDetail')));
const AuditLogsPage = lazy(lazyRetry(() => import('./pages/AuditLogs')));
const PartnersView = lazy(lazyRetry(() => import('./components/PartnersView')));
const PartnerDetailPage = lazy(lazyRetry(() => import('./pages/PartnerDetail')));
const TasksView = lazy(lazyRetry(() => import('./pages/Tasks')));

// --- Loading Placeholder ---
function PageLoader() {
  return (
    <div className="flex h-[400px] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-navy border-t-transparent dark:border-tertiary-sage dark:border-t-transparent" />
        <div className="text-[11px] font-bold text-slate-400 tracking-tight animate-pulse">正在进入工作舱...</div>
      </div>
    </div>
  );
}

// Redirect old customer detail URLs to new /customers/detail/:id
function CustomerRedirect() {
  const { id } = useParams();
  return <Navigate to={`/customers/detail/${String(id).toLowerCase()}`} replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950 font-sans text-[11px] font-bold tracking-tight text-slate-400">系统初始化中...</div>;

  return (
    <ErrorBoundary>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<PageLoader />}>
        <VersionGuard />
      <Routes>
        <Route path="/login" element={!user ? <LoginScreen /> : <Navigate to="/" />} />
        
        <Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/orders" element={<OrdersView />} />
          <Route path="/orders/:orderNo" element={<OrderDetailPage />} />
          <Route path="/finance" element={<FinanceView />} />
          <Route path="/logistics" element={<LogisticsView />} />
          <Route path="/tasks" element={<TasksView />} />
          <Route path="/customers" element={<CustomersView />} />
          <Route path="/customers/:id" element={<CustomerRedirect />} />
          <Route path="/customers/detail/:id" element={<CustomerDetailPage />} />
          <Route path="/partners" element={<PartnersView />} />
          <Route path="/partners/detail/:id" element={<PartnerDetailPage />} />
          <Route path="/ai" element={<AIAssistantView />} />
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/audit" element={user?.role === 'admin' ? <AuditLogsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/settings" element={user?.role === 'admin' ? <SettingsView /> : <Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
