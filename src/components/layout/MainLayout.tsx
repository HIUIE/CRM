import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  Truck,
  PackageSearch,
  Building2,
  Bot,
  Settings,
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
  CheckCircle2,
  Bell,
  Menu,
  X as XIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { CommandPalette } from '../ui/CommandPalette';
import { NotificationDrawer } from '../ui/NotificationDrawer';
import { Drawer } from '../ui/Drawer';
import AIAssistantFloating from '../ui/AIAssistantFloating';
import { apiFetch } from '../../lib/api';
import { useSiteBrand } from '../../hooks/useSiteBrand';

export default function MainLayout() {
  const { user, logout } = useAuth();
  useSocket(); // Initialize global socket connection
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { data: brand } = useSiteBrand();
  const siteName = brand?.siteName || 'SmartTrade AI CRM';
  const siteLogo = brand?.siteLogo || '/logo.png';
  const isAdmin = user?.role === 'admin';
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const data = await apiFetch<{ count: number }>('/api/notifications/unread-count');
        setUnreadCount(data.count);
      } catch (e) {}
    };
    if (user) {
      void fetchUnread();
      const timer = setInterval(fetchUnread, 30000);
      return () => clearInterval(timer);
    }
  }, [user]);

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

  // 标准详情页识别：隐藏全局头部
  const isDetailPage = /^\/(orders|customers|partners|tasks|audit)\/detail\/[^/]+$/.test(location.pathname) ||
                       /^\/orders\/[^/]+$/.test(location.pathname) ||
                       /^\/(audit|tasks)$/.test(location.pathname);

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'dashboard': return { title: '业务控制台', subtitle: '实时掌握业务全局，快速处理关键任务', actionLabel: '新建订单', actionPath: '#dashboard-create-order' };
      case 'orders': return {
        title: '订单列表',
        subtitle: '稳定推进团队日常协作与订单流转。',
        actionLabel: '新建订单',
        actionPath: '/orders?create=1',
      };
      case 'customers': return {
        title: '客户档案',
        subtitle: '统一管理客户资料，沉淀高价值商业线索。',
        actionLabel: '新建客户',
        actionPath: '/customers?create=1',
      };
      case 'partners': return { title: '合作伙伴', subtitle: '管理供应商与物流伙伴，优化供应链协同。', actionLabel: '新增伙伴', actionPath: '/partners?create=1' };
      case 'finance': return { title: '财务流水', subtitle: '监控收支状态，保障业务资金链安全。', actionLabel: '录入收支', actionPath: '/finance?create=1' };
      case 'logistics': return { title: '物流打包', subtitle: '追踪货运状态，确保交付流程准时合规。', actionLabel: '创建物流', actionPath: '/logistics?create=1' };
      case 'tasks': return { title: '团队协同', subtitle: '跨部门高效协作，确保任务不落地。', actionLabel: '指派任务', actionPath: '/tasks?create=1' };
      case 'ai': return { title: 'AI 向导', subtitle: '利用智能化引擎，挖掘数据背后的增长机会。', actionLabel: '发起咨询', actionPath: '/ai' };
      case 'settings': return { title: '系统配置', subtitle: '定制化业务规则，管理团队协作权限。', actionLabel: '保存配置', actionPath: '#' };
      case 'help': return { title: '帮助中心', subtitle: '获取系统操作指南，解决业务流程疑惑。', actionLabel: '联系支持', actionPath: '#' };
      case 'audit': return { title: '操作审计日志', subtitle: '追溯全站核心实体的生命周期与数据变动', actionLabel: '导出报告', actionPath: 'print' };
      default: return { title: siteName, subtitle: '专业的外贸业务管理专家。', actionLabel: '返回首页', actionPath: '/dashboard' };
    }
  };

  const headerInfo = getHeaderInfo();

  const handleHeaderAction = () => {
    if (headerInfo.actionPath === 'print') {
      window.print();
    } else if (headerInfo.actionPath === '#dashboard-create-order') {
      window.dispatchEvent(new CustomEvent('dashboard:create-order'));
    } else if (headerInfo.actionPath !== '#') {
      navigate(headerInfo.actionPath);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F0F2F5] dark:bg-navy-950 text-primary-navy dark:text-white transition-colors duration-300">
      <NotificationDrawer isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* 1. 固定侧边栏 - position: fixed, 脱离文档流 */}
      <aside className={`fixed left-0 top-0 flex h-screen w-[240px] flex-col border-r border-slate-200 bg-white shadow-sm transition-all duration-300 dark:border-navy-800 dark:bg-navy-900 z-50 px-6 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo 区域：pt-8 pb-6 mb-8 确保与主导航视觉隔离 */}
        <div className="pt-8 pb-6 mb-8 border-b border-slate-50 dark:border-navy-800/50">
          <Link to="/" className="flex items-center gap-3 group">
            <img src={siteLogo} alt={siteName} className="h-8 w-8 rounded-lg object-contain shadow-md" />
            <div className="min-w-0">
              <div className="text-sm font-black leading-none tracking-tight text-primary-navy dark:text-white">{siteName}</div>
              <div className="mt-1 text-[9px] font-bold tracking-tight text-slate-400">Management</div>
            </div>
          </Link>
        </div>

        {/* 主导航：无额外水平 padding，继承 aside px-6 */}
        <nav className="flex-1 space-y-1">
          <ul className="space-y-1.5">
            <NavItem icon={<LayoutDashboard size={18} />} label="业务控制台" path="/dashboard" currentPath={location.pathname} />
            <NavItem icon={<PackageSearch size={18} />} label="客户档案" path="/customers" currentPath={location.pathname} />
            <NavItem icon={<Building2 size={18} />} label="合作伙伴" path="/partners" currentPath={location.pathname} />
            <NavItem icon={<FileText size={18} />} label="订单列表" path="/orders" currentPath={location.pathname} />
            <NavItem icon={<CheckCircle2 size={18} />} label="团队协同" path="/tasks" currentPath={location.pathname} />
            <NavItem icon={<DollarSign size={18} />} label="财务流水" path="/finance" currentPath={location.pathname} />
            <NavItem icon={<Truck size={18} />} label="物流打包" path="/logistics" currentPath={location.pathname} />
            <div className="mx-2 my-6 border-t border-slate-100 dark:border-navy-800" />
            <NavItem
              icon={<Bot size={18} />}
              label="AI 向导"
              path="/ai"
              currentPath={location.pathname}
              customClass="text-tertiary-sage dark:text-emerald-400"
            />
          </ul>
        </nav>

        {/* 底部菜单：排序 操作审计 -> 帮助中心 -> 深色模式 -> 系统配置 */}
        <div className="mt-auto pt-4 space-y-1 pb-2 list-none">
          {isAdmin && <NavItem icon={<History size={18} />} label="操作审计" path="/audit" currentPath={location.pathname} />}
          <NavItem icon={<CircleHelp size={18} />} label="帮助中心" path="/help" currentPath={location.pathname} />
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex w-full items-center rounded-md px-3 py-2 text-xs font-bold transition-all text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 hover:text-primary-navy dark:hover:text-white"
          >
            <span className="mr-3 flex items-center justify-center shrink-0 text-slate-400 dark:text-slate-500 opacity-70">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </span>
            <span className="truncate tracking-wide">{isDark ? '浅色模式' : '深色模式'}</span>
          </button>
          {isAdmin && <NavItem icon={<Settings size={18} />} label="系统配置" path="/settings" currentPath={location.pathname} />}
        </div>

        {/* 用户卡片 + 向上弹出下拉菜单 */}
        <div className="relative py-4 border-t border-slate-50 dark:border-navy-800">
           {showUserMenu && (
             <div className="absolute bottom-full left-0 right-0 mb-2 z-[100]">
               <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-lg overflow-hidden">
                 <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-700">
                   <div className="text-xs font-bold tracking-tight text-slate-500 dark:text-slate-400">当前账号</div>
                   <div className="text-sm font-black text-primary-navy dark:text-white mt-0.5">{user?.name}</div>
                 </div>
                 <button
                   onClick={() => { logout(); setShowUserMenu(false); }}
                   className="flex w-full items-center gap-3 px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                 >
                   <LogOut size={16} />
                   退出系统
                 </button>
               </div>
             </div>
           )}
           <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full rounded-lg bg-slate-50 dark:bg-navy-950/50 p-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-navy-800 transition-all border border-slate-100 dark:border-navy-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white shadow-lg">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0 text-left">
                  <div className="truncate text-[11px] font-black text-primary-navy dark:text-white">{user?.name}</div>
                  <div className="mt-0.5 text-[9px] font-bold leading-none tracking-tight text-slate-400">{user?.role}</div>
                </div>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>
        </div>
      </aside>

      {/* 2. 主内容区 - margin-left 避开固定侧边栏，自然撑开文档流 */}
      <main className="lg:ml-[240px] min-h-screen flex flex-col relative">
        {/* Mobile header with hamburger */}
        <div className="sticky top-0 z-40 flex items-center justify-between bg-white/80 dark:bg-navy-950/90 backdrop-blur-md border-b border-slate-200 dark:border-navy-800 px-4 py-3 lg:hidden">
          <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNotifications(true)} className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all relative">
              <Bell size={18} />
              {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-error text-white text-[8px] font-bold flex items-center justify-center">{unreadCount}</span>}
            </button>
            <span className="text-xs font-bold text-primary-navy dark:text-white truncate max-w-[120px]">{siteName}</span>
          </div>
        </div>
        <CommandPalette />
        {!isDetailPage && (
          <header className="sticky top-0 z-40 bg-white/80 dark:bg-navy-950/90 backdrop-blur-md border-b border-slate-200 dark:border-navy-800 px-8 py-5 flex items-center justify-between transition-all shrink-0">
            <div>
              <h1 className="text-lg font-black tracking-tight text-primary-navy dark:text-white">{headerInfo.title}</h1>
              <p className="mt-0.5 text-[10px] font-bold tracking-tight text-slate-400">{headerInfo.subtitle}</p>
            </div>
            <div className="flex items-center gap-4">
               <button onClick={() => setShowNotifications(true)} className="p-2.5 rounded-lg border border-slate-200 dark:border-navy-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm">
                  <Bell size={18} />
               </button>
               <button onClick={handleHeaderAction} className="rounded-lg bg-slate-900 px-6 py-2.5 text-xs font-black tracking-tight text-white shadow-xl transition-all active:scale-95 dark:bg-tertiary-sage">
                  {headerInfo.actionLabel}
               </button>
            </div>
          </header>
        )}

        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Outlet />
        </div>
      </main>
      <AIAssistantFloating />
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
  const isActive = currentPath === path || (path === '/dashboard' && currentPath === '/') || currentPath.startsWith(path + '/');

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
