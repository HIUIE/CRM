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

  const Fallback = () => <div className="p-12 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 animate-page-in">
      <div className="flex w-fit flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm transition-colors dark:border-navy-800 dark:bg-navy-900">
        <button 
          onClick={() => setActiveTab('branding')} 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'branding' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}
        >
          <Layout size={16} /> 站点品牌
        </button>
        
        {isAdmin && (
          <>
            <button 
              onClick={() => setActiveTab('business')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'business' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}
            >
              <Briefcase size={16} /> 业务规则
            </button>
            <button 
              onClick={() => setActiveTab('team')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'team' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}
            >
              <Users size={16} /> 团队管理
            </button>
            <button 
              onClick={() => setActiveTab('ai')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'ai' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}
            >
              <BrainCircuit size={16} /> AI 智能
            </button>
            <button 
              onClick={() => setActiveTab('system')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'system' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}
            >
              <ShieldCheck size={16} /> 系统维护
            </button>
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-navy-800 dark:bg-navy-900 sm:p-8">
        <Suspense fallback={<Fallback />}>
          {activeTab === 'branding' && <BrandingTab />}
          {activeTab === 'business' && isAdmin && <BusinessTab />}
          {activeTab === 'team' && isAdmin && <TeamTab />}
          {activeTab === 'ai' && isAdmin && <AiTab />}
          {activeTab === 'system' && isAdmin && <SystemTab setImportEntityType={setImportEntityType} />}
        </Suspense>
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

