import React, { useEffect, useState } from 'react';
import { FileDigit, DollarSign, Bell, CheckCircle2, Globe } from 'lucide-react';
import Field from '../../components/ui/Field';
import { apiFetch, getErrorMessage } from '../../lib/api';

export default function BusinessTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [orderNumberPrefix, setOrderNumberPrefix] = useState('ORD-');
  const [savedDocument, setSavedDocument] = useState(false);
  
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savedWebhook, setSavedWebhook] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<{ orderNumberPrefix: string }>('/api/settings/document').catch(() => ({ orderNumberPrefix: 'ORD-' })),
      apiFetch<{ webhookUrl: string }>('/api/settings/webhook').catch(() => ({ webhookUrl: '' })),
    ]).then(([documentData, webhookData]) => {
      setOrderNumberPrefix(documentData.orderNumberPrefix || 'ORD-');
      setWebhookUrl(webhookData.webhookUrl || '');
    }).catch(e => {
      setError(getErrorMessage(e, '读取配置失败'));
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const saveDocumentSettings = async () => {
    setError(''); setSavedDocument(false);
    try {
      await apiFetch('/api/settings/document', { method: 'POST', body: JSON.stringify({ orderNumberPrefix: orderNumberPrefix.trim() || 'ORD-' }) });
      setSavedDocument(true);
      setTimeout(() => setSavedDocument(false), 1800);
    } catch (e) { setError(getErrorMessage(e, '保存单据编码规则失败')); }
  };

  const saveWebhook = async () => {
    setError(''); setSavedWebhook(false);
    try {
      await apiFetch('/api/settings/webhook', { method: 'POST', body: JSON.stringify({ webhookUrl }) });
      setSavedWebhook(true);
      setTimeout(() => setSavedWebhook(false), 1800);
    } catch (e) { setError(getErrorMessage(e, '保存失败')); }
  };

  if (loading) return <div className="p-8 text-sm text-slate-500 animate-pulse">正在读取业务配置...</div>;

  return (
    <div className="space-y-10 max-w-4xl">
      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <section>
        <div className="mb-6">
          <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
            <FileDigit className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
            编码与币种
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">定义业务实体的唯一识别规则及默认交易单位。</p>
        </div>

        <div className="grid gap-6">
          <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <Field label="订单编号前缀" description="新生成的订单编号将以此开头。">
                <input
                  value={orderNumberPrefix}
                  onChange={(event) => setOrderNumberPrefix(event.target.value)}
                  placeholder="如 ORD- / PO-"
                  className="w-full max-w-xs rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
                />
              </Field>
              <button type="button" onClick={saveDocumentSettings} className="btn-primary shadow-md h-[46px] px-8">
                {savedDocument ? '规则已保存' : '保存规则'}
              </button>
            </div>
            <div className="mt-4 rounded-full bg-surface dark:bg-navy-900 border border-slate-200 dark:border-navy-700 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 inline-flex items-center gap-2">
              <Globe size={12} /> 实时预览：{orderNumberPrefix}{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}{String(new Date().getDate()).padStart(2, '0')}01
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-4">
              <DollarSign size={16} /> 默认结算币种
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">系统将自动为新建订单填充此币种，减少重复输入。</p>
            <div className="flex flex-wrap gap-3">
              {['USD', 'CNY', 'EUR', 'GBP', 'JPY'].map(currency => (
                <label key={currency} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 cursor-pointer hover:border-primary-navy transition-all">
                  <input type="radio" name="currency" defaultChecked={currency === 'USD'} className="accent-primary-navy" />
                  <span className="text-sm font-black text-primary-navy dark:text-white">{currency}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6">
          <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
            <Bell className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
            自动化通知
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">通过 Webhook 实时同步业务动态到外部通讯软件。</p>
        </div>

        <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6">
          <div className="flex flex-col gap-4">
            <Field label="企业微信机器人 Webhook 地址" description="当订单状态变更或有新订单时，自动推送到指定群组。">
              <div className="flex gap-3">
                <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." className="flex-1 rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 p-3.5 text-sm outline-none focus:border-primary-navy text-primary-navy dark:text-white font-mono" />
                <button onClick={saveWebhook} className="btn-primary shadow-md px-8">{savedWebhook ? '已保存' : '保存配置'}</button>
              </div>
            </Field>
          </div>
        </div>
      </section>
    </div>
  );
}
