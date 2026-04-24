/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
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
import PartnersView from './components/PartnersView';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">加载中...</div>;

  return (
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
        <Route path="/partners" element={<PartnersView />} />
        <Route path="/ai" element={<AIAssistantView />} />
        <Route path="/help" element={<HelpCenterPage />} />
        <Route path="/settings" element={user?.role === 'admin' ? <SettingsView /> : <Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
