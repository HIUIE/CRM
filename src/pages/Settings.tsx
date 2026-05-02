import React, { useState, Suspense, lazy } from 'react';
import { Layout, Briefcase, Users, BrainCircuit, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ImportModal from '../components/ui/ImportModal';

// 懒加载拆分出的 Settings 子组件
const BrandingTab = lazy(() => import('./settings/BrandingTab'));
const BusinessTab = lazy(() => import('./settings/BusinessTab'));
const TeamTab = lazy(() => import('./settings/TeamTab'));
const AiTab = lazy(() => import('./settings/AiTab'));
const SystemTab = lazy(() => import('./settings/SystemTab'));

export type SettingsTab = 'branding' | 'business' | 'team' | 'ai' | 'system';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<SettingsTab>('branding');
  const [importEntityType, setImportEntityType] = useState<'CUSTOMER' | 'ORDER' | null>(null);

  if (!isAdmin && activeTab !== 'branding') {
    setActiveTab('branding');
  }

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
      ]
    }
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] animate-page-in">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-8">
          <div className="space-y-1">
            <h1 className="text-xl font-black text-primary-navy dark:text-white tracking-tight px-4">系统设置</h1>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-tight px-4 uppercase">System Preferences</p>
          </div>

          <nav className="space-y-6">
            {categories.map((cat, idx) => {
              const visibleTabs = cat.tabs.filter(t => t.roles.includes(user?.role || 'user'));
              if (visibleTabs.length === 0) return null;

              return (
                <div key={idx} className="space-y-2">
                  <h3 className="px-4 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">{cat.title}</h3>
                  <div className="space-y-1">
                    {visibleTabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as SettingsTab)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                          activeTab === tab.id 
                            ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' 
                            : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-900/50'
                        }`}
                      >
                        <tab.icon size={16} className={activeTab === tab.id ? 'text-white' : 'text-slate-400'} />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="min-w-0">
          <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm transition-colors dark:border-navy-800 dark:bg-navy-900 sm:p-10 min-h-[600px]">
            <Suspense fallback={<Fallback />}>
              {activeTab === 'branding' && <BrandingTab />}
              {activeTab === 'business' && isAdmin && <BusinessTab />}
              {activeTab === 'team' && isAdmin && <TeamTab />}
              {activeTab === 'ai' && isAdmin && <AiTab />}
              {activeTab === 'system' && isAdmin && <SystemTab setImportEntityType={setImportEntityType} />}
            </Suspense>
          </div>
        </main>
      </div>

      <ImportModal
        isOpen={importEntityType !== null}
        onClose={() => setImportEntityType(null)}
        onSuccess={() => setImportEntityType(null)}
        entityType={importEntityType || 'CUSTOMER'}
      />
    </div>
  );
}

