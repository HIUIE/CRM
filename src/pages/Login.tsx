import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';
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
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-900 transition-all duration-700">
      {/* Background patterns */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-navy rounded-full blur-[120px]" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-tertiary-sage rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] rounded-[24px] bg-white p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all animate-in fade-in zoom-in-95 duration-500 mx-4">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-lg bg-slate-50 shadow-inner border border-slate-100 overflow-hidden p-2">
            <img src="/logo.png" alt="SmartTrade" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-primary-navy uppercase">SmartTrade AI CRM</h1>
          <p className="mt-2 text-[13px] font-medium text-slate-500">统一化外贸业务管理与 AI 协同平台</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 animate-in shake duration-300">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">登录账号</label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入用户名"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-primary-navy transition-all focus:bg-white focus:ring-2 focus:ring-primary-navy/5 outline-none font-medium"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">访问密码</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-primary-navy transition-all focus:bg-white focus:ring-2 focus:ring-primary-navy/5 outline-none font-medium"
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
            <p className="text-[11px] font-medium text-slate-400">
              Verdana Health System · v2.0
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
