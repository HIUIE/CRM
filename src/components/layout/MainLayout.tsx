import React, { useEffect, useState } from 'react';
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
  Sun,
  Moon,
  Wallet,
  Search,
  Filter,
  ChevronDown,
  History,
  Printer,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CommandPalette } from '../ui/CommandPalette';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const activeTab = location.pathname.split('/')[1] || 'dashboard';
  const isDetailPage = /^\/orders\/[^/]+$/.test(location.pathname) || /^\/customers\/detail\/[^/]+$/.test(location.pathname) || location.pathname === '/audit';

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'dashboard': return { title: '业务控制台', subtitle: '实时掌握业务全局，快速处理关键任务', actionLabel: '新建订单', actionPath: '/orders?create=1' };
      case 'orders': return { title: '订单台', subtitle: '稳定推进团队日常协作与订单流转。', actionLabel: '新建订单', actionPath: '/orders?create=1' };
      case 'customers': return { title: '客户档案', subtitle: '统一管理客户资料，沉淀高价值商业线索。', actionLabel: '新建客户', actionPath: '/customers?create=1' };
      case 'partners': return { title: '合作伙伴', subtitle: '管理供应商与物流伙伴，优化供应链协同。', actionLabel: '新增伙伴', actionPath: '/partners?create=1' };
      case 'finance': return { title: '财务流水', subtitle: '监控收支状态，保障业务资金链安全。', actionLabel: '录入收支', actionPath: '/finance?create=1' };
      case 'logistics': return { title: '物流打包', subtitle: '追踪货运状态，确保交付流程准时合规。', actionLabel: '创建物流', actionPath: '/logistics?create=1' };
      case 'ai': return { title: 'AI 向导', subtitle: '利用智能化引擎，挖掘数据背后的增长机会。', actionLabel: '发起咨询', actionPath: '/ai' };
      case 'settings': return { title: '系统配置', subtitle: '定制化业务规则，管理团队协作权限。', actionLabel: '保存配置', actionPath: '#' };
      case 'help': return { title: '帮助中心', subtitle: '获取系统操作指南，解决业务流程疑惑。', actionLabel: '联系支持', actionPath: '#' };
      case 'audit': return { title: '操作审计日志', subtitle: '追溯全站核心实体的生命周期与数据变动', actionLabel: '导出报告', actionPath: 'print' };
      default: return { title: 'SmartTrade AI CRM', subtitle: '专业的外贸业务管理专家。', actionLabel: '返回首页', actionPath: '/dashboard' };
    }
  };

  const headerInfo = getHeaderInfo();

  const handleHeaderAction = () => {
    if (headerInfo.actionPath === 'print') {
      window.print();
    } else if (headerInfo.actionPath !== '#') {
      navigate(headerInfo.actionPath);
    }
  };

  return (
    <div className="h-screen w-screen bg-background dark:bg-navy-950 text-primary-navy dark:text-white transition-colors duration-300 overflow-hidden">
      <div className="flex h-full w-full gap-2 p-2 items-stretch">
        <aside className="h-full w-[190px] shrink-0 flex flex-col rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-4 py-5 shadow-sm transition-colors z-[100]">
          <div className="mb-8 flex items-center gap-3 px-1 shrink-0">
            <img src="/logo.png" alt="SmartTrade AI CRM" className="h-9 w-9 rounded-lg object-contain" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold tracking-tight text-primary-navy dark:text-white truncate">SmartTrade</div>
              <div className="text-[10px] font-medium text-secondary-slate dark:text-slate-400 leading-none">Management</div>
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
              <div className="mx-2 my-4 border-t border-slate-100 dark:border-navy-800" />
              <NavItem
                icon={<Bot size={18} />}
                label="AI 向导"
                path="/ai"
                currentPath={location.pathname}
                customClass="text-tertiary-sage dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              />
            </ul>
          </nav>

          <div className="mt-auto pt-4 space-y-1 shrink-0">
            <ul className="space-y-1 border-t border-slate-100 dark:border-navy-800 pt-4 list-none p-0 m-0">
              <li>
                <button
                  type="button"
                  onClick={() => setIsDark(!isDark)}
                  className="flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-xs font-bold text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white transition-all"
                >
                  <span className="mr-3 flex items-center justify-center shrink-0 opacity-70">
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                  </span>
                  <span className="truncate tracking-wide">{isDark ? '浅色模式' : '深色模式'}</span>
                </button>
              </li>
              {user?.role === 'admin' && (
                <NavItem icon={<Settings size={18} />} label="配置" path="/settings" currentPath={location.pathname} />
              )}
              <NavItem icon={<CircleHelp size={18} />} label="帮助" path="/help" currentPath={location.pathname} />
              {user?.role === 'admin' && (
                <NavItem icon={<History size={18} />} label="审计" path="/audit" currentPath={location.pathname} />
              )}
            </ul>
          </div>

          <div className="mt-5 relative shrink-0">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50 p-3 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-navy-800 text-[11px] font-bold text-primary-navy dark:text-white border border-slate-200 dark:border-navy-700 shadow-sm">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-xs font-bold text-primary-navy dark:text-white truncate max-w-[80px]">{user?.name}</div>
                  <div className="text-[10px] text-secondary-slate dark:text-slate-400 truncate">{user?.role === 'admin' ? '管理员' : '业务员'}</div>
                </div>
              </div>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full mb-2 w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-lg animate-in fade-in zoom-in-95 duration-200 z-50">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    void logout();
                  }}
                  className="flex w-full items-center px-4 py-3 text-[11px] font-bold text-secondary-slate dark:text-slate-300 hover:text-error hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                >
                  <LogOut size={14} className="mr-2" />
                  退出登录
                </button>
              </div>
            )}
            {/* Click outside overlay for user menu */}
            {showUserMenu && (
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            )}
          </div>
        </aside>

        <main className="flex h-full flex-1 flex-col min-w-0 overflow-hidden">
          <CommandPalette />
          {!isDetailPage && (
            <header className="mb-2 flex flex-col gap-3 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 px-6 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between transition-colors shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-primary-navy dark:text-white uppercase tracking-tight">{headerInfo.title}</h1>
                  <p className="text-xs text-secondary-slate dark:text-slate-400 mt-0.5">{headerInfo.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-400 hover:text-primary-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-navy-600 transition-colors shadow-sm text-[11px] font-bold"
                >
                  <Search size={14} />
                  <span className="hidden sm:inline">全局搜索 <kbd className="font-sans border rounded px-1 ml-1 opacity-70">⌘K</kbd></span>
                </button>
                <button className="p-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-400 hover:text-primary-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-navy-600 transition-colors shadow-sm" title="高级筛选">
                  <Filter size={16} />
                </button>
                
                <div className="w-[1px] h-6 bg-slate-200 dark:bg-navy-800 mx-1"></div>

                {activeTab === 'dashboard' && (
                  <>
                    <button onClick={() => navigate('/finance')} className="px-4 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors flex items-center gap-2 tracking-wide uppercase"><Wallet size={14} /> 收款</button>
                    <button onClick={() => navigate('/logistics')} className="px-4 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors flex items-center gap-2 tracking-wide uppercase"><Truck size={14} /> 创建物流</button>
                  </>
                )}
                <button
                  onClick={handleHeaderAction}
                  className={`inline-flex items-center rounded-md px-5 py-2 text-[11px] font-bold transition-all shadow-sm btn-transition tracking-wide uppercase ${
                    headerInfo.actionPath === 'print'
                      ? 'bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                      : 'bg-primary-navy dark:bg-tertiary-sage text-white hover:bg-slate-800 dark:hover:bg-emerald-700'
                  }`}
                >
                  {headerInfo.actionPath === 'print' ? <Printer size={16} className="mr-1.5" /> : <Plus size={16} className="mr-1.5" />}
                  {headerInfo.actionLabel}
                </button>
              </div>
            </header>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar">
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
            ? 'bg-slate-100 dark:bg-navy-800 text-primary-navy dark:text-white shadow-sm' 
            : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white'
        } ${customClass}`}
      >
        <span className={`mr-3 flex items-center justify-center shrink-0 ${isActive ? 'text-primary-navy dark:text-tertiary-sage' : 'text-slate-400 dark:text-slate-500 opacity-70'}`}>{icon}</span>
        <span className="truncate tracking-wide">{label}</span>
      </button>
    </li>
  );
}
