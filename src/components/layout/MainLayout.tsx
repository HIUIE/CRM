import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  Truck,
  PackageSearch,
  Building2,
  Bot,
  Settings,
  Plus,
  LogOut,
  CircleHelp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname.split('/')[1] || 'dashboard';
  const isOrderDetail = /^\/orders\/[^/]+$/.test(location.pathname);

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard': return '业务控制台';
      case 'orders': return '订单台';
      case 'customers': return '客户档案';
      case 'partners': return '合作伙伴';
      case 'finance': return '财务流水';
      case 'logistics': return '物流打包';
      case 'ai': return 'AI 向导';
      case 'settings': return '系统配置';
      case 'help': return '帮助中心';
      default: return 'SmartTrade AI CRM';
    }
  };

  return (
    <div className="min-h-screen bg-background text-primary-navy">
      <div className="mx-auto flex min-h-screen w-full gap-2 p-2 items-start">
        <aside className="sticky top-2 hidden h-[calc(100vh-16px)] w-[190px] shrink-0 flex-col rounded-lg border border-slate-200 bg-white px-4 py-5 shadow-sm lg:flex">
          <div className="mb-8 flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-navy text-white shadow-sm font-bold">
              ST
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold tracking-tight text-primary-navy truncate">SmartTrade</div>
              <div className="text-[10px] font-medium text-secondary-slate leading-none">Management</div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
            <ul className="space-y-1">
              <NavItem icon={<LayoutDashboard size={18} />} label="控制台" path="/dashboard" currentPath={location.pathname} />
              <NavItem icon={<PackageSearch size={18} />} label="客户" path="/customers" currentPath={location.pathname} />
              <NavItem icon={<Building2 size={18} />} label="伙伴" path="/partners" currentPath={location.pathname} />
              <NavItem icon={<FileText size={18} />} label="订单" path="/orders" currentPath={location.pathname} />
              <NavItem icon={<DollarSign size={18} />} label="财务" path="/finance" currentPath={location.pathname} />
              <NavItem icon={<Truck size={18} />} label="物流" path="/logistics" currentPath={location.pathname} />
              <div className="mx-2 my-4 border-t border-slate-100" />
              <NavItem
                icon={<Bot size={18} />}
                label="AI 向导"
                path="/ai"
                currentPath={location.pathname}
                customClass="text-tertiary-sage hover:bg-emerald-50"
              />
            </ul>
          </nav>

          <div className="mt-auto pt-4">
            <ul className="space-y-1 border-t border-slate-100 pt-4 list-none p-0 m-0">
              {user?.role === 'admin' && (
                <NavItem icon={<Settings size={18} />} label="配置" path="/settings" currentPath={location.pathname} />
              )}
              <NavItem icon={<CircleHelp size={18} />} label="帮助" path="/help" currentPath={location.pathname} />
            </ul>
          </div>

          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[11px] font-bold text-primary-navy border border-slate-200">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-primary-navy truncate">{user?.name}</div>
                <div className="text-[10px] text-secondary-slate truncate">{user?.role === 'admin' ? '管理员' : '业务员'}</div>
              </div>
            </div>
            <button
              onClick={() => void logout()}
              className="flex w-full items-center justify-center rounded-md bg-white border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-secondary-slate hover:text-error hover:border-error transition-colors shadow-sm"
            >
              <LogOut size={14} className="mr-2" />
              退出
            </button>
          </div>
        </aside>

        <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
          {!isOrderDetail && (
            <header className="mb-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-6 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-primary-navy">{getTitle()}</h1>
                <p className="text-xs text-secondary-slate mt-0.5">稳定推进团队日常协作与订单流转。</p>
              </div>
              <button
                onClick={() => navigate('/orders?create=1')}
                className="inline-flex items-center rounded-md bg-primary-navy px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-sm btn-transition"
              >
                <Plus size={16} className="mr-1.5" />
                新建订单
              </button>
            </header>
          )}

          <div className="flex-1">
            {<Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  path,
  currentPath,
  customClass = '',
}: {
  icon: React.ReactNode;
  label: string;
  path: string;
  currentPath: string;
  customClass?: string;
}) {
  const navigate = useNavigate();
  const isActive = currentPath === path || (path === '/dashboard' && currentPath === '/');

  return (
    <li>
      <button
        onClick={() => navigate(path)}
        className={`flex w-full items-center rounded-md px-3 py-2 text-xs font-bold transition-all group ${
          isActive 
            ? 'bg-slate-100 text-primary-navy shadow-sm' 
            : 'text-secondary-slate hover:bg-slate-50 hover:text-primary-navy'
        } ${customClass}`}
      >
        <span className={`mr-3 flex items-center justify-center shrink-0 ${isActive ? 'text-primary-navy' : 'text-slate-400 opacity-70'}`}>{icon}</span>
        <span className="truncate tracking-wide">{label}</span>
      </button>
    </li>
  );
}
