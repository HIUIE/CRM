import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Globe, CheckCircle2 } from 'lucide-react';
import Field from '../../components/ui/Field';
import { apiFetch, getErrorMessage } from '../../lib/api';

export default function BrandingTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [siteName, setSiteName] = useState('SmartTrade AI CRM');
  const [siteSlogan, setSiteSlogan] = useState('');
  const [siteLogo, setSiteLogo] = useState('');
  const [siteFavicon, setSiteFavicon] = useState('');
  const [savedSite, setSavedSite] = useState(false);
  const [uploadingBrand, setUploadingBrand] = useState(false);
  
  const queryClient = useQueryClient();

  useEffect(() => {
    apiFetch<{ siteName: string; siteSlogan: string; siteLogo: string; siteFavicon: string }>('/api/settings/basic')
      .then((basicData) => {
        setSiteName(basicData.siteName || 'SmartTrade AI CRM');
        setSiteSlogan(basicData.siteSlogan || '');
        setSiteLogo(basicData.siteLogo || '');
        setSiteFavicon(basicData.siteFavicon || '');
      })
      .catch(e => {
        setError(getErrorMessage(e, '读取配置失败'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

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

  if (loading) return <div className="p-8 text-sm text-slate-500 animate-pulse">正在读取站点配置...</div>;

  return (
    <div className="space-y-8 w-full">
      {error && <div className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 font-bold">{error}</div>}
      
      <div className="mb-6">
        <h2 className="flex items-center text-lg font-bold text-primary-navy dark:text-white">
          <Globe className="mr-2 h-5 w-5 text-primary-navy dark:text-tertiary-sage" />
          站点品牌
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">定制系统名称、Slogan 及视觉图标，塑造专业品牌形象。</p>
      </div>

      <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/50 p-6 transition-colors w-full">
        <div className="space-y-6 w-full">
          <div className="grid gap-8 lg:grid-cols-2">
            <Field label="站点名称" description="显示在侧边栏、浏览器标签页及通知中。">
              <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="如 SmartTrade AI CRM" className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy outline-none text-primary-navy dark:text-white" />
            </Field>
            <Field label="站点口号" description="显示在侧边栏 Logo 下方或欢迎页面。">
              <input value={siteSlogan} onChange={e => setSiteSlogan(e.target.value)} placeholder="如 专业的外贸业务管理专家" className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-950 p-3.5 text-sm focus:border-primary-navy outline-none text-primary-navy dark:text-white" />
            </Field>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 pt-2">
            <Field label="站点 Logo" description="建议 200x200px, 透明背景 PNG。">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-700 bg-surface dark:bg-navy-900 overflow-hidden relative group">
                  {siteLogo ? (
                    <>
                      <img src={siteLogo} alt="Logo" className="h-full w-full object-contain" />
                      <button onClick={() => setSiteLogo('')} className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all text-xs">清除</button>
                    </>
                  ) : (
                    <Globe size={24} className="text-slate-300" />
                  )}
                </div>
                <button onClick={() => uploadBrandFile('logo')} disabled={uploadingBrand} className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">
                  {uploadingBrand ? '上传中...' : '更改 Logo'}
                </button>
              </div>
            </Field>

            <Field label="Favicon 图标" description="浏览器标签页显示的小图标 (ICO/PNG)。">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-700 bg-surface dark:bg-navy-900 overflow-hidden relative group">
                  {siteFavicon ? (
                    <>
                      <img src={siteFavicon} alt="Favicon" className="h-10 w-10 object-contain" />
                      <button onClick={() => setSiteFavicon('')} className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all text-xs">清除</button>
                    </>
                  ) : (
                    <Globe size={20} className="text-slate-300" />
                  )}
                </div>
                <button onClick={() => uploadBrandFile('favicon')} disabled={uploadingBrand} className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all">
                  {uploadingBrand ? '上传中...' : '更改图标'}
                </button>
              </div>
            </Field>
          </div>

          <div className="flex items-center gap-3 pt-8 border-t border-slate-200/60 dark:border-navy-800/60">
            <button onClick={saveSiteSettings} className="btn-primary shadow-xl px-10 py-3.5">
              {savedSite ? <><CheckCircle2 className="mr-2 h-4 w-4" />品牌设置已保存</> : '保存品牌设置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
