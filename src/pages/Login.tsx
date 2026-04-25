import React, { useState } from 'react';
import { Globe, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, getErrorMessage } from '../lib/api';
import type { AuthUser } from '../types/auth';

interface LoginResponse {
  user: AuthUser;
}

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const data = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      login(data.user);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '登录失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background dark:bg-navy-950 p-4 transition-colors">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="relative bg-blue-600 dark:bg-navy-800 p-8 text-center">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-white/10 blur-2xl" />
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/30 bg-white/20 backdrop-blur-sm">
            <Globe className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase">SmartTrade AI CRM</h1>
          <p className="mt-2 text-sm text-blue-100 dark:text-slate-400">面向小团队协作的外贸订单与流程工作台</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {error ? (
              <div className="rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
                {error}
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">登录账号</label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 py-3 pl-10 pr-4 text-sm text-primary-navy dark:text-white transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-emerald-500/50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 py-3 pl-10 pr-4 text-sm text-primary-navy dark:text-white transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-emerald-500/50"
                  required
                />
              </div>
            </div>

            <button
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-xl bg-blue-600 dark:bg-tertiary-sage py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 dark:hover:bg-emerald-700 shadow-lg disabled:cursor-not-allowed disabled:opacity-70 active:scale-95"
            >
              {isSubmitting ? '登录中...' : '登录系统'}
            </button>

            <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
              请输入管理员分配的账号和密码。首次部署默认管理员仅保留在初始化说明中，不在登录页公开展示。
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
