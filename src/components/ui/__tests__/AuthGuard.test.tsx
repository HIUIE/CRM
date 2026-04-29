import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthGuard } from '../AuthGuard';
import * as AuthContext from '../../../context/AuthContext';
import '@testing-library/jest-dom';

// Mock the useAuth hook
vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('AuthGuard Component', () => {
  const mockUseAuth = vi.mocked(AuthContext.useAuth);

  const renderWithRouter = (ui: React.ReactNode) => {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders loading state when auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, login: vi.fn(), logout: vi.fn() });
    
    renderWithRouter(
      <AuthGuard>
        <div data-testid="protected-content">Content</div>
      </AuthGuard>
    );
    
    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders fallback when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() });
    
    renderWithRouter(
      <AuthGuard fallback={<div data-testid="fallback">Access Denied</div>}>
        <div data-testid="protected-content">Content</div>
      </AuthGuard>
    );
    
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated and redirectTo is set', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() });
    
    renderWithRouter(
      <AuthGuard redirectTo="/login">
        <div data-testid="protected-content">Content</div>
      </AuthGuard>
    );
    
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('renders children when user is authenticated and no specific role is required', () => {
    mockUseAuth.mockReturnValue({ 
      user: { id: 1, username: 'test', name: 'Test', role: 'user' }, 
      loading: false, login: vi.fn(), logout: vi.fn() 
    });
    
    renderWithRouter(
      <AuthGuard>
        <div data-testid="protected-content">Secret Content</div>
      </AuthGuard>
    );
    
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('renders fallback when user lacks required role', () => {
    mockUseAuth.mockReturnValue({ 
      user: { id: 1, username: 'user', name: 'User', role: 'user' }, 
      loading: false, login: vi.fn(), logout: vi.fn() 
    });
    
    renderWithRouter(
      <AuthGuard requireRole="admin" fallback={<div data-testid="unauthorized">Unauthorized</div>}>
        <div data-testid="protected-content">Admin Content</div>
      </AuthGuard>
    );
    
    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders children when user has required role', () => {
    mockUseAuth.mockReturnValue({ 
      user: { id: 1, username: 'admin', name: 'Admin', role: 'admin' }, 
      loading: false, login: vi.fn(), logout: vi.fn() 
    });
    
    renderWithRouter(
      <AuthGuard requireRole="admin">
        <div data-testid="protected-content">Admin Content</div>
      </AuthGuard>
    );
    
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
