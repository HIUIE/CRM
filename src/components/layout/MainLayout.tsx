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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname.split('/')[1] || 'dashboard';

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return '业务控制台';
      case 'orders':
        return '订单工作台';
      case 'customers':
        return '客户档案';
      case 'partners':
        return '供应商 / 合作伙伴';
      case 'finance':
        return '财务流水';
      case 'logistics':
        return '物流与打包';
      case 'ai':
        return 'AI 智能向导';
      case 'settings':
        return '系统与 AI 配置';
      default:
        return 'SmartTrade AI CRM';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] gap-4 p-4">
        <aside className="hidden w-72 shrink-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex lg:flex-col">
          <div className="mb-8 flex items-center px-2">
            <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 font-bold text-white shadow-[0_6px_18px_rgba(37,99,235,0.35)]">
              ST
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900">SmartTrade AI</div>
              <div className="text-xs text-slate-400">单人内用 CRM MVP</div>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            <ul className="space-y-1">
              <NavItem icon={<LayoutDashboard />} label="控制台" path="/dashboard" currentPath={location.pathname} />
              <NavItem icon={<PackageSearch />} label="客户" path="/customers" currentPath={location.pathname} />
              <NavItem icon={<Building2 />} label="供应商/合作伙伴" path="/partners" currentPath={location.pathname} />
              <NavItem icon={<FileText />} label="订单" path="/orders" currentPath={location.pathname} />
              <NavItem icon={<DollarSign />} label="财务" path="/finance" currentPath={location.pathname} />
              <NavItem icon={<Truck />} label="物流" path="/logistics" currentPath={location.pathname} />
              <div className="mx-2 my-4 border-t border-slate-100" />
              <NavItem
                icon={<Bot />}
                label="AI Beta"
                path="/ai"
                currentPath={location.pathname}
                customClass="text-indigo-600 hover:bg-indigo-50"
              />
              <NavItem icon={<Settings />} label="系统设置" path="/settings" currentPath={location.pathname} />
            </ul>
          </nav>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center">
              <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">{user?.name}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{user?.role}</div>
              </div>
            </div>
            <button
              onClick={() => void logout()}
              className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </button>
          </div>
        </aside>

        <main className="flex min-h-screen flex-1 flex-col">
          <header className="mb-4 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{getTitle()}</h1>
              <p className="mt-1 text-sm text-slate-500">
                先把客户、订单、财务、物流这条主链跑通，其他能力逐步补齐。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/orders?create=1')}
                className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition-colors hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                新建订单
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-3xl">{<Outlet />}</div>
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
        className={`flex w-full items-center rounded-2xl px-3 py-3 text-sm font-medium transition-colors ${
          isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
        } ${customClass}`}
      >
        <span className="mr-3 flex h-5 w-5 items-center justify-center">{icon}</span>
        {label}
      </button>
    </li>
  );
}
