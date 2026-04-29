import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requireRole?: string;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function AuthGuard({ children, requireRole, fallback = null, redirectTo }: AuthGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div data-testid="auth-loading">Loading...</div>;
  }

  if (!user) {
    if (redirectTo) return <Navigate to={redirectTo} replace />;
    return <>{fallback}</>;
  }

  if (requireRole && user.role !== requireRole) {
    if (redirectTo) return <Navigate to={redirectTo} replace />;
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
