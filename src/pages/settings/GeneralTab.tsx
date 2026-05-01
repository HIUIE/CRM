import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Globe, FileDigit, DollarSign, Bell, CheckCircle2 } from 'lucide-react';
import Field from '../../components/ui/Field';
import { apiFetch, getErrorMessage } from '../../lib/api';

export default function GeneralTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [siteName, setSiteName] = useState('SmartTrade AI CRM');
  const [siteSlogan, setSiteSlogan] = useState('');
  const [siteLogo, setSiteLogo] = useState('');
  const [siteFavicon, setSiteFavicon] = useState('');
  const [savedSite, setSavedSite] = useState(false);
  const [uploadingBrand, setUploadingBrand] = useState(false);
  
  const [orderNumberPrefix, setOrderNumberPrefix] = useState('ORD-');
  const [savedDocument, setSavedDocument] = useState(false);
  
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savedWebhook, setSavedWebhook] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<{ siteName: string; siteSlogan: string; siteLogo: string; siteFavicon: string }>('/api/settings/basic'),
      apiFetch<{ orderNumberPrefix: string }>('/api/settings/document').catch(() => ({ orderNumberPrefix: 'ORD-' })),
      apiFetch<{ webhookUrl: string }>('/api/settings/webhook').catch(() => ({ webhookUrl: '' })),
    ]).then(([basicData, documentData, webhookData]) => {
      setSiteName(basicData.siteName || 'SmartTrade AI CRM');
      setSiteSlogan(basicData.siteSlogan || '');
      setSiteLogo(basicData.siteLogo || '');
      setSiteFavicon(basicData.siteFavicon || '');
      setOrderNumberPrefix(documentData.orderNumberPrefix || 'ORD-');
      setWebhookUrl(webhookData.webhookUrl || '');
    }).catch(e => {
      setError(getErrorMessage(e, '读取配置失败'));
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const queryClient = useQueryClient();
  const saveSiteSettings = async () => {
    setError(''); setSavedSite(false);
    try {
      await apiFetch('/api/settings/basic', { method: 'POST', body: JSON.stringify({ siteName, siteSlogan, siteLogo, siteFavicon }) });
      setSavedSite(true);
      await queryClient.invalidateQueries({ queryKey: ['site-brand'] });
      setTimeout(() => setSavedSite(false), 1800);
    } catch (e) { setError(getErrorMessage(e, '保存站点设置失败')); }
  };

  const uploadBrandFile = async (type: 'logo' | 'favicon') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/x-icon,.ico';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingBrand(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const result = await apiFetch<{ url: string }>('/api/settings/brand/upload', { method: 'POST', body: fd });
        if (type === 'logo') setSiteLogo(result.url); else setSiteFavicon(result.url);
      } catch (e) { setError(getErrorMessage(e, '上传失败')); } finally { setUploadingBrand(false); }
    };
    input.click();
  };

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

  if (loading) return <div className="p-8 text-sm text-slate-500 animate-pulse">正在读取常规配置...</div>;

  return (
    <div className="space-y-8 max-w-4xl">
      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      
      {/* Site Brand Settings */}
      <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
        <h3 className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-4">
          <Globe size={16} /> 站点基本设置
        </h3>
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="站点名称">
              <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="如 SmartTrade AI CRM" className="w-full max-w-md rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy outline-none text-primary-navy dark:text-white" />
            </Field>
            <Field label="站点口号">
              <input value={siteSlogan} onChange={e => setSiteSlogan(e.target.value)} placeholder="如 专业的外贸业务管理专家" className="w-full max-w-md rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy outline-none text-primary-navy dark:text-white" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="站点 Logo（建议 200×200px PNG）">
              <div className="flex items-center gap-3">
                {siteLogo && (
                  <div className="relative group">
                    <img src={siteLogo} alt="Logo" className="h-12 w-12 rounded-lg object-contain border border-slate-200 dark:border-navy-700 bg-white" />
                    <button onClick={() => setSiteLogo('')} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all">✕</button>
                  </div>
                )}
                <button onClick={() => uploadBrandFile('logo')} disabled={uploadingBrand} className="rounded-lg border border-slate-200 dark:border-navy-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800 transition-all disabled:opacity-50">
                  {uploadingBrand ? '上传中...' : '选择图片'}
                </button>
              </div>
            </Field>
            <Field label="Favicon（建议 32×32px ICO/PNG）">
              <div className="flex items-center gap-3">
                {siteFavicon && (
                  <div className="relative group">
                    <img src={siteFavicon} alt="Favicon" className="h-8 w-8 rounded object-contain border border-slate-200 dark:border-navy-700 bg-white" />
                    <button onClick={() => setSiteFavicon('')} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all">✕</button>
                  </div>
                )}
                <button onClick={() => uploadBrandFile('favicon')} disabled={uploadingBrand} className="rounded-lg border border-slate-200 dark:border-navy-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800 transition-all disabled:opacity-50">
                  {uploadingBrand ? '上传中...' : '选择文件'}
                </button>
              </div>
            </Field>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveSiteSettings} className="btn-primary shadow-md">
              {savedSite ? <><CheckCircle2 className="mr-2 h-4 w-4" />已保存</> : '保存站点设置'}
            </button>
          </div>
        </div>
      </div>

      {/* Order Number Prefix */}
      <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
        <h3 className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-4">
          <FileDigit size={16} /> 单据编码规则
        </h3>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <Field label="订单编号前缀">
            <input
              value={orderNumberPrefix}
              onChange={(event) => setOrderNumberPrefix(event.target.value)}
              placeholder="如 ORD- / PO-"
              className="w-full max-w-xs rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-all outline-none text-primary-navy dark:text-white"
            />
          </Field>
          <button type="button" onClick={saveDocumentSettings} className="btn-primary shadow-md">
            {savedDocument ? <><CheckCircle2 className="mr-2 h-4 w-4" />已保存</> : '保存编码规则'}
          </button>
        </div>
        <div className="mt-4 rounded-full bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 inline-flex items-center gap-2">
          <Globe size={12} /> 预览：{orderNumberPrefix}{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}{String(new Date().getDate()).padStart(2, '0')}01
        </div>
      </div>

      {/* Currency Settings */}
      <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
        <h3 className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-4">
          <DollarSign size={16} /> 默认业务币种
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-medium">系统将使用以下币种作为新建订单和财务记录的默认选项。</p>
        <div className="flex flex-wrap gap-3">
          {['USD', 'CNY', 'EUR', 'GBP', 'JPY'].map(currency => (
            <div key={currency} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 cursor-pointer hover:border-primary-navy dark:hover:border-tertiary-sage transition-all">
              <input type="radio" name="currency" defaultChecked={currency === 'USD'} className="accent-primary-navy dark:accent-tertiary-sage" />
              <span className="text-sm font-bold text-primary-navy dark:text-white">{currency}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Notification */}
      <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors">
        <h3 className="flex items-center gap-2 text-sm font-bold text-primary-navy dark:text-white mb-4">
          <Bell size={16} /> 消息通知（企业微信机器人）
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">配置后，新订单创建时将自动推送通知到企业微信群。</p>
        <div className="flex gap-3 items-end">
          <div className="flex-1 max-w-xl">
            <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-3.5 text-sm outline-none focus:border-primary-navy data-field text-primary-navy dark:text-white" />
          </div>
          <button onClick={saveWebhook} className="btn-primary shadow-md shrink-0">{savedWebhook ? '已保存' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}
