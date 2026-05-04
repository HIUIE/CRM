import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { toast } from 'sonner';
import { Landmark, Save } from 'lucide-react';

export default function FinanceTab() {
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1, CNY: 7.2, EUR: 0.92 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates : any = async () => {
    try {
      const data = await apiFetch<{ rates: Record<string, number> }>('/api/settings/finance');
      setRates(data.rates);
    } catch (err) {
      toast.error('读取汇率失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave : any = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/settings/finance', {
        method: 'POST',
        body: JSON.stringify({ rates }),
      });
      toast.success('汇率设置已保存');
    } catch (err) {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">正在加载汇率配置...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(rates).map(([currency, rate]) => (
          <div key={currency} className="p-5 rounded-2xl border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900/50">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              1 USD 兑换 {currency}
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xl font-black text-primary-navy dark:text-white">{currency}</span>
              <input
                type="number"
                step="0.0001"
                value={rate}
                disabled={currency === 'USD'}
                onChange={(e) => setRates({ ...rates, [currency]: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl px-4 py-2.5 text-sm font-bold text-primary-navy dark:text-white outline-none focus:ring-2 focus:ring-primary-navy/10 transition-all disabled:opacity-50"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary-navy dark:bg-white text-white dark:text-primary-navy rounded-xl text-sm font-black hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? '正在保存...' : '保存财务配置'}
        </button>
      </div>
      
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 flex items-start gap-3">
        <Landmark className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
          汇率将影响订单详情页中的利润自动换算结果。建议根据财务部门提供的月度基准汇率定期更新。
        </div>
      </div>
    </div>
  );
}
