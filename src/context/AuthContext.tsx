import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface User {
  id: number;
  username: string;
  role: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCurrentUser = async () => {
      try {
        const data = await apiFetch<{ user: User }>('/api/auth/me');
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

  const login = (userData: User) => {
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
