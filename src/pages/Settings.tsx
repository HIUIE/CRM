import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Layout, Briefcase, Users, BrainCircuit, ShieldCheck, Loader2, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ImportModal from '../components/ui/ImportModal';
import { lazyRetry } from '../lib/lazyRetry';

// 懒加载拆分出的 Settings 子组件
const BrandingTab = lazy(lazyRetry(() => import('./settings/BrandingTab')));
const BusinessTab = lazy(lazyRetry(() => import('./settings/BusinessTab')));
const TeamTab = lazy(lazyRetry(() => import('./settings/TeamTab')));
const AiTab = lazy(lazyRetry(() => import('./settings/AiTab')));
const SystemTab = lazy(lazyRetry(() => import('./settings/SystemTab')));
const AboutTab = lazy(lazyRetry(() => import('./settings/AboutTab')));

export type SettingsTab = 'branding' | 'business' | 'team' | 'ai' | 'system' | 'about';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<SettingsTab>('branding');
  const [importEntityType, setImportEntityType] = useState<'CUSTOMER' | 'ORDER' | null>(null);

  useEffect(() => {
    if (!isAdmin && activeTab !== 'branding') {
      setActiveTab('branding');
    }
  }, [activeTab, isAdmin]);

  const Fallback = () => <div className="p-12 flex justify-center text-slate-400"><Loader2 className="animate-spin text-primary-navy dark:text-tertiary-sage" /></div>;

  const categories = [
    {
      title: '基础管理',
      tabs: [
        { id: 'branding', label: '站点个性化', icon: Layout, roles: ['admin', 'user'] },
        { id: 'team', label: '团队与权限', icon: Users, roles: ['admin'] },
      ]
    },
    {
      title: '业务配置',
      tabs: [
        { id: 'business', label: '规则与流程', icon: Briefcase, roles: ['admin'] },
        { id: 'ai', label: 'AI 助手配置', icon: BrainCircuit, roles: ['admin'] },
      ]
    },
    {
      title: '系统工具',
      tabs: [
        { id: 'system', label: '数据与维护', icon: ShieldCheck, roles: ['admin'] },
        { id: 'about', label: '关于与版本', icon: Info, roles: ['admin', 'user'] },
      ]
    }
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] animate-page-in space-y-6">
      {/* Modern Tab Navigation */}
      <div className="border-b border-slate-200 dark:border-navy-800">
        <nav className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1 -mb-px">
          {categories.flatMap(cat => cat.tabs).filter(t => t.roles.includes(user?.role || 'user')).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-black transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-primary-navy dark:border-tertiary-sage text-primary-navy dark:text-white bg-slate-50/50 dark:bg-navy-950/30' 
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50/30 dark:hover:bg-navy-950/10'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'text-primary-navy dark:text-tertiary-sage' : 'text-slate-300 dark:text-slate-600'} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area - 100% Width */}
      <main className="w-full">
        <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm transition-colors dark:border-navy-800 dark:bg-navy-900 sm:p-10 min-h-[600px]">
          <Suspense fallback={<Fallback />}>
            <div className="w-full">
              {activeTab === 'branding' && <BrandingTab />}
              {activeTab === 'business' && isAdmin && <BusinessTab />}
              {activeTab === 'team' && isAdmin && <TeamTab />}
              {activeTab === 'ai' && isAdmin && <AiTab />}
              {activeTab === 'system' && isAdmin && <SystemTab setImportEntityType={setImportEntityType} />}
              {activeTab === 'about' && <AboutTab />}
            </div>
          </Suspense>
        </div>
      </main>

      <ImportModal
        isOpen={importEntityType !== null}
        onClose={() => setImportEntityType(null)}
        onSuccess={() => setImportEntityType(null)}
        entityType={importEntityType || 'CUSTOMER'}
      />
    </div>
  );
}
