import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { AuthUser } from '../types/auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCurrentUser = async () => {
      try {
        const data = await apiFetch<{ user: AuthUser }>('/api/auth/me');
        if (mounted) {
          setUser(data.user);
        }
      } catch (_error) {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const handleUnauthorized = () => {
      setUser(null);
      setLoading(false);
    };

    window.addEventListener('app:unauthorized', handleUnauthorized);
    loadCurrentUser();

    return () => {
      mounted = false;
      window.removeEventListener('app:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = (userData: AuthUser) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (_error) {
      // Always clear local auth state, even if the server session is already gone.
    } finally {
      setUser(null);
    }
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
