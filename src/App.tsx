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

// --- Lazy-loaded pages for code splitting ---
const DashboardView = lazy(() => import('./pages/Dashboard'));
const AIAssistantView = lazy(() => import('./pages/AIAssistant'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetail'));
const SettingsView = lazy(() => import('./pages/Settings'));
const HelpCenterPage = lazy(() => import('./pages/HelpCenter'));
const LoginScreen = lazy(() => import('./pages/Login'));
const OrdersView = lazy(() => import('./components/OrdersView'));
const FinanceView = lazy(() => import('./components/FinanceView'));
const LogisticsView = lazy(() => import('./components/LogisticsView'));
const CustomersView = lazy(() => import('./components/CustomersView'));
const CustomerDetailPage = lazy(() => import('./pages/CustomerDetail'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogs'));
const PartnersView = lazy(() => import('./components/PartnersView'));
const PartnerDetailPage = lazy(() => import('./pages/PartnerDetail'));
const TasksView = lazy(() => import('./pages/Tasks'));

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
  return <Navigate to={`/customers/detail/${id}`} replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950 font-sans text-[11px] font-bold tracking-tight text-slate-400">系统初始化中...</div>;

  return (
    <ErrorBoundary>
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
