import React, { useState } from 'react';
import { Database, RefreshCw, Layers } from 'lucide-react';
import DataTab from './DataTab';
import UpdateTab from './UpdateTab';

type SubTab = 'data' | 'update';

export default function SystemTab({ setImportEntityType }: { setImportEntityType: (type: 'CUSTOMER' | 'ORDER') => void }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('data');

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
          <Layers className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
          系统与维护
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">管理系统底层资产，包括数据的生命周期归档及系统版本迭代。</p>
      </div>

      <div className="flex items-center gap-2 p-1 w-fit rounded-xl bg-slate-100 dark:bg-navy-950/80 border border-slate-200 dark:border-navy-800">
        <button
          onClick={() => setActiveSubTab('data')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black transition-all ${activeSubTab === 'data' ? 'bg-surface dark:bg-navy-800 text-primary-navy dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
        >
          <Database size={14} /> 数据管理
        </button>
        <button
          onClick={() => setActiveSubTab('update')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black transition-all ${activeSubTab === 'update' ? 'bg-surface dark:bg-navy-800 text-primary-navy dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
        >
          <RefreshCw size={14} /> 版本更新
        </button>
      </div>

      <div className="pt-4">
        {activeSubTab === 'data' ? (
          <DataTab setImportEntityType={setImportEntityType} />
        ) : (
          <UpdateTab />
        )}
      </div>
    </div>
  );
}
