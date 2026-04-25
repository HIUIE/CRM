/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';

// --- Static Imports for ALL pages ---
import DashboardView from './pages/Dashboard';
import AIAssistantView from './pages/AIAssistant';
import OrderDetailPage from './pages/OrderDetail';
import SettingsView from './pages/Settings';
import HelpCenterPage from './pages/HelpCenter';
import LoginScreen from './pages/Login';
import OrdersView from './components/OrdersView';
import FinanceView from './components/FinanceView';
import LogisticsView from './components/LogisticsView';
import CustomersView from './components/CustomersView';
import CustomerDetailPage from './pages/CustomerDetail';
import AuditLogsPage from './pages/AuditLogs';
import PartnersView from './components/PartnersView';

// --- Loading Placeholder ---
function PageLoader() {
  return (
    <div className="flex h-[400px] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-navy border-t-transparent dark:border-tertiary-sage dark:border-t-transparent" />
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">正在进入工作舱...</div>
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950 font-sans text-[11px] font-bold uppercase tracking-widest text-slate-400">系统初始化中...</div>;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={!user ? <LoginScreen /> : <Navigate to="/" />} />
        
        <Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/orders" element={<OrdersView />} />
          <Route path="/orders/:orderNo" element={<OrderDetailPage />} />
          <Route path="/finance" element={<FinanceView />} />
          <Route path="/logistics" element={<LogisticsView />} />
          <Route path="/customers" element={<CustomersView />} />
          <Route path="/customers/:id" element={<CustomerRedirect />} />
          <Route path="/customers/detail/:id" element={<CustomerDetailPage />} />
          <Route path="/partners" element={<PartnersView />} />
          <Route path="/ai" element={<AIAssistantView />} />
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/audit" element={user?.role === 'admin' ? <AuditLogsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/settings" element={user?.role === 'admin' ? <SettingsView /> : <Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}
