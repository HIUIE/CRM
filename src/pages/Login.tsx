import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, getErrorMessage } from '../lib/api';
import { useSiteBrand } from '../hooks/useSiteBrand';
import type { AuthUser } from '../types/auth';

interface LoginResponse {
  user: AuthUser;
}

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: brand } = useSiteBrand();
  const siteName = brand?.siteName || 'SmartTrade AI CRM';
  const siteSlogan = brand?.siteSlogan || '';
  const siteLogo = brand?.siteLogo || '/logo.png';
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
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 transition-colors duration-700 dark:bg-navy-950">
      {/* Background patterns */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60 dark:opacity-30">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-slate-200 blur-[120px] dark:bg-navy-800" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-emerald-100 blur-[120px] dark:bg-emerald-900/20" />
      </div>

      <div className="relative z-10 mx-4 w-full max-w-[420px] rounded-2xl border border-slate-200 bg-surface p-10 shadow-xl transition-all animate-in fade-in zoom-in-95 duration-500 dark:border-navy-800 dark:bg-navy-900">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-lg bg-slate-50 dark:bg-navy-950 shadow-inner border border-slate-100 dark:border-navy-800 overflow-hidden p-2">
            <img src={siteLogo} alt={siteName} className="h-full w-full object-contain" />
          </div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-primary-navy dark:text-white">{siteName}</h1>
          <p className="mt-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">{siteSlogan || '统一化外贸业务管理与 AI 协同平台'}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-100 dark:border-red-800/30 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400 animate-in shake duration-300">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-tight ml-1">登录账号</label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入用户名"
                className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 py-3.5 pl-11 pr-4 text-sm text-primary-navy dark:text-white transition-all focus:bg-surface focus:ring-2 focus:ring-primary-navy/5 dark:focus:bg-navy-900 dark:focus:ring-tertiary-sage/10 outline-none font-medium"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-tight ml-1">访问密码</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 py-3.5 pl-11 pr-4 text-sm text-primary-navy dark:text-white transition-all focus:bg-surface focus:ring-2 focus:ring-primary-navy/5 dark:focus:bg-navy-900 dark:focus:ring-tertiary-sage/10 outline-none font-medium"
                required
              />
            </div>
          </div>

          <button
            disabled={isSubmitting}
            className="btn-primary w-full mt-4 shadow-xl shadow-primary-navy/20 active:scale-95"
          >
            {isSubmitting ? '验证授权中...' : '立即登录'}
          </button>

          <div className="pt-6 text-center">
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Verdana Health System · v2.0
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
