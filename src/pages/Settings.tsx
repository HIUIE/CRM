import React, { useState, Suspense, lazy } from 'react';
import { Settings as SettingsIcon, Database, Layout, BrainCircuit, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ImportModal from '../components/ui/ImportModal';

// 懒加载拆分出的 Settings 子组件
const GeneralTab = lazy(() => import('./settings/GeneralTab'));
const DataTab = lazy(() => import('./settings/DataTab'));
const TeamTab = lazy(() => import('./settings/TeamTab'));
const AiTab = lazy(() => import('./settings/AiTab'));
const UpdateTab = lazy(() => import('./settings/UpdateTab'));

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'general' | 'data' | 'interface' | 'ai' | 'update'>('general');
  const [importEntityType, setImportEntityType] = useState<'CUSTOMER' | 'ORDER' | null>(null);

  if (!isAdmin && activeTab !== 'general') {
    setActiveTab('general');
  }

  const Fallback = () => <div className="p-12 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 animate-page-in">
      <div className="flex bg-white dark:bg-navy-900 p-1 rounded-lg border border-slate-200 dark:border-navy-800 w-fit transition-colors flex-wrap">
        <button onClick={() => setActiveTab('general')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><SettingsIcon size={16} /> 常规配置</button>
        {isAdmin && (
          <>
            <button onClick={() => setActiveTab('data')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'data' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><Database size={16} /> 数据管理</button>
            <button onClick={() => setActiveTab('interface')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'interface' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><Layout size={16} /> 团队管理</button>
            <button onClick={() => setActiveTab('ai')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ai' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><BrainCircuit size={16} /> AI 配置</button>
            <button onClick={() => setActiveTab('update')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'update' ? 'bg-primary-navy dark:bg-tertiary-sage text-white shadow-md' : 'text-secondary-slate dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'}`}><RefreshCw size={16} /> 版本更新</button>
          </>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-8 shadow-sm transition-colors">
        <Suspense fallback={<Fallback />}>
          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'data' && isAdmin && <DataTab setImportEntityType={setImportEntityType} />}
          {activeTab === 'interface' && isAdmin && <TeamTab />}
          {activeTab === 'ai' && isAdmin && <AiTab />}
          {activeTab === 'update' && isAdmin && <UpdateTab />}
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
