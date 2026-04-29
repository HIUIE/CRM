import React, { useState } from 'react';
import { Download, Upload, PackageSearch, FileDigit, DatabaseBackup, CheckCircle2 } from 'lucide-react';
import { apiDownload, getErrorMessage } from '../../lib/api';

const EXPORT_FORMATS = [
  {
    id: 'xlsx',
    title: 'Excel 工作簿（推荐）',
    desc: '单个 XLSX 文件，包含 12 个 Sheet：订单、商品明细、财务流水、物流、报关、生产、装箱、客户、合作伙伴、任务、客户跟进、订单跟进。带自动筛选和表头样式。',
    icon: <FileDigit size={20} />,
  },
  {
    id: 'customer-archive',
    title: '客户订单归档（ZIP）',
    desc: '按客户分目录、按订单分子目录导出，含订单摘要、商品明细、财务流水、物流、报关、生产、装箱及附件原文件。',
    icon: <Download size={20} />,
  },
  {
    id: 'zip-csv',
    title: 'CSV 表格导出',
    desc: '所有订单、客户、财务、物流等核心数据导出为 CSV 表格文件，适合 Excel 分析处理。',
    icon: <FileDigit size={20} />,
  },
];

export default function DataTab({ setImportEntityType }: { setImportEntityType: (type: 'CUSTOMER' | 'ORDER') => void }) {
  const [error, setError] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'customer-archive' | 'zip-csv'>('xlsx');
  const [exporting, setExporting] = useState(false);

  const exportData = async () => {
    setError(''); setUserMessage(''); setExporting(true);
    try {
      const url = exportFormat === 'xlsx' ? '/api/settings/export/xlsx' : `/api/settings/export?format=${exportFormat}`;
      await apiDownload(url);
      const labels: Record<string, string> = { 'xlsx': 'Excel 工作簿', 'customer-archive': '客户订单归档', 'zip-csv': 'CSV 表格' };
      setUserMessage(`${labels[exportFormat] || '数据'}导出已开始下载`);
    } catch (e) {
      setError(getErrorMessage(e, '导出数据失败'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {userMessage && <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{userMessage}</div>}

      <div className="mb-10">
        <div className="mb-6">
          <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
            <Upload className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
            数据导入
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">批量导入客户或订单数据，支持 XLSX、CSV 及系统备份 ZIP。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={() => setImportEntityType('CUSTOMER')} className="flex items-start gap-4 p-5 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 hover:border-primary-navy transition-all text-left">
            <div className="p-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage text-white shrink-0"><PackageSearch size={20} /></div>
            <div>
              <div className="text-sm font-bold text-primary-navy dark:text-white mb-1">导入客户数据</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">从 XLSX/CSV 文件中批量导入客户资料，支持自动匹配字段。</div>
            </div>
          </button>
          <button onClick={() => setImportEntityType('ORDER')} className="flex items-start gap-4 p-5 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 hover:border-primary-navy transition-all text-left">
            <div className="p-2 rounded-lg bg-primary-navy dark:bg-tertiary-sage text-white shrink-0"><FileDigit size={20} /></div>
            <div>
              <div className="text-sm font-bold text-primary-navy dark:text-white mb-1">导入订单数据</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">从 XLSX/CSV 文件中批量导入订单，需确保客户名称匹配已有客户。</div>
            </div>
          </button>
        </div>

        <div className="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800 flex items-start gap-3">
          <DatabaseBackup size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">也支持上传系统导出的 ZIP 备份包直接还原，系统会自动识别客户和订单数据。</p>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-navy-800 pt-10">
        <div className="mb-6">
          <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
            <Download className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
            数据导出
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">选择导出格式，一键归档业务数据。</p>
        </div>

        <div className="space-y-4 mb-8">
          {EXPORT_FORMATS.map(fmt => (
            <div key={fmt.id} onClick={() => setExportFormat(fmt.id as typeof exportFormat)} className={`flex items-start gap-4 p-5 rounded-lg border cursor-pointer transition-all ${exportFormat === fmt.id ? 'border-primary-navy bg-primary-navy/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <div className={`p-2 rounded-lg ${exportFormat === fmt.id ? 'bg-primary-navy text-white' : 'bg-slate-100 text-slate-500'}`}>{fmt.icon}</div>
              <div className="flex-1">
                <div className="text-sm font-bold text-primary-navy dark:text-white">{fmt.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{fmt.desc}</div>
              </div>
              {exportFormat === fmt.id && <CheckCircle2 size={18} className="text-primary-navy shrink-0 mt-1" />}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 p-5 rounded-lg bg-slate-50 dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800">
          <div className="flex-1">
            <div className="text-sm font-bold text-primary-navy dark:text-white">仅管理员可操作</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">导出包包含所有业务数据，请妥善保管。</div>
          </div>
          <button type="button" onClick={exportData} disabled={exporting} className="btn-primary shadow-md disabled:opacity-60">
            <Download className="mr-2 h-4 w-4" />
            {exporting ? '正在导出...' : `立即导出`}
          </button>
        </div>
      </div>
    </div>
  );
}
