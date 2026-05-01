import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useNavigateWithTransition } from '../lib/transition';
import {
  Building2, MapPin, Phone, Package, Wallet, Clock,
  ArrowLeft, Star, Mail, Globe, Truck, DollarSign,
  Factory, ShieldCheck, Hash, Calendar, BarChart3, Edit
} from 'lucide-react';
import { apiFetch, getErrorMessage } from '../lib/api';
import Chip from '../components/ui/Chip';
import EmptyStateBoard from '../components/ui/EmptyStateBoard';
import Toast from '../components/ui/Toast';
import { Drawer } from '../components/ui/Drawer';
import Field from '../components/ui/Field';
import CountrySelect from '../components/ui/CountrySelect';
import { formatDateOnly } from '../features/order-detail/utils';
import type { PartnerType } from '../types/crm';

interface PartnerDetail {
  partner: {
    id: number;
    name: string;
    partner_type: string;
    country?: string;
    contact?: string;
    contact_person?: string;
    address?: string;
    rating?: number;
    payment_terms?: string;
    remark?: string;
    created_at: string;
    created_by_name?: string;
  };
  orders: Array<{
    id: number;
    display_id: string;
    status: string;
    total_amount: number;
    product_summary?: string;
    created_at: string;
    linkType: 'production' | 'finance' | 'logistics';
    production_status?: string;
    estimated_delivery_date?: string;
  }>;
  financeRecords: Array<{
    id: number;
    order_id?: number;
    type: string;
    amount: number;
    currency?: string;
    status: string;
    created_at: string;
    order_display_id?: string;
  }>;
  summary: {
    totalOrders: number;
    thisMonthCount: number;
    lastMonthCount: number;
    totalFinanceAmount: number;
    productionCount: number;
    logisticsCount?: number;
  };
}

type PartnerForm = {
  name: string;
  partnerType: PartnerType;
  country: string;
  contact: string;
  contactPerson: string;
  address: string;
  rating: number;
  paymentTerms: string;
  remark: string;
};

type TabKey = 'orders' | 'finance';

const PARTNER_TYPE_LABELS: Record<string, string> = {
  factory: '工厂',
  forwarder: '货代',
  customs_broker: '报关行',
  other: '其他',
};

const PARTNER_TYPE_ICONS: Record<string, React.ReactNode> = {
  factory: <Factory size={16} />,
  forwarder: <Truck size={16} />,
  customs_broker: <ShieldCheck size={16} />,
  other: <Building2 size={16} />,
};

function getStatusMeta(status: string) {
  const map: Record<string, { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' | 'error' }> = {
    production: { label: '生产中', tone: 'warning' },
    customs: { label: '报关中', tone: 'warning' },
    shipping: { label: '发货中', tone: 'info' },
    completed: { label: '已完成', tone: 'success' },
    draft: { label: '待受理', tone: 'neutral' },
  };
  return map[status] || { label: status, tone: 'neutral' as const };
}

export default function PartnerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigateWithTransition();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('orders');
  const [toast, setToast] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [formError, setFormError] = useState('');
  const [savingPartner, setSavingPartner] = useState(false);

  const { data, isLoading, error: queryError } = useQuery<PartnerDetail>({
    queryKey: ['partner-detail', id],
    queryFn: () => apiFetch<PartnerDetail>(`/api/partners/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
  });
  const loading = isLoading;
  const error = queryError ? getErrorMessage(queryError, '读取伙伴画像失败') : '';
  const [form, setForm] = useState<PartnerForm>({ name: '', partnerType: 'factory', country: '', contact: '', contactPerson: '', address: '', rating: 3, paymentTerms: '', remark: '' });
  const [initialForm, setInitialForm] = useState<PartnerForm>({ name: '', partnerType: 'factory', country: '', contact: '', contactPerson: '', address: '', rating: 3, paymentTerms: '', remark: '' });
  const isFormDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  if (loading) return <div className="flex h-screen w-full items-center justify-center p-8 text-sm text-slate-500 animate-pulse tracking-tight font-bold">正在加载伙伴数据...</div>;
  if (error || !data) return <div className="p-8 m-4 rounded-lg bg-red-50 text-red-600 border border-red-100 font-bold text-center">{error || '伙伴不存在'}</div>;

  const { partner, orders, financeRecords, summary } = data;
  const overviewItems = getOverviewItems(partner.partner_type, summary);

  const openEdit = () => {
    const nextForm = {
      name: partner.name || '',
      partnerType: (partner.partner_type as PartnerType) || 'factory',
      country: partner.country || '',
      contact: partner.contact || '',
      contactPerson: partner.contact_person || '',
      address: partner.address || '',
      rating: partner.rating || 3,
      paymentTerms: partner.payment_terms || '',
      remark: partner.remark || '',
    };
    setForm(nextForm);
    setInitialForm(nextForm);
    setFormError('');
    setShowEdit(true);
  };

  const handleSavePartner = async () => {
    if (!form.name.trim()) {
      setFormError('伙伴名称为必填项');
      return;
    }
    setSavingPartner(true);
    setFormError('');
    try {
      await apiFetch(`/api/partners/${partner.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          partnerType: form.partnerType,
          country: form.country.trim(),
          contact: form.contact.trim(),
          contactPerson: form.contactPerson.trim(),
          address: form.address.trim(),
          rating: form.rating,
          paymentTerms: form.paymentTerms.trim(),
          remark: form.remark.trim(),
        }),
      });
      setToast('伙伴资料已更新');
      setTimeout(() => setToast(''), 3000);
      setShowEdit(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['partner-detail', id] }),
        queryClient.invalidateQueries({ queryKey: ['partners'] }),
      ]);
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, '保存伙伴失败'));
    } finally {
      setSavingPartner(false);
    }
  };

  return (
    <div className="flex flex-col animate-page-in">
      {/* Header */}
      <header className="sticky top-0 z-[60] -mx-2 -mt-2 mb-4 flex items-center justify-between border-b border-slate-100 dark:border-navy-800 bg-surface/95 dark:bg-navy-950/95 px-6 py-4 backdrop-blur-md transition-colors shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/partners')}
            className="group flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-navy-800 text-slate-400 hover:border-primary-navy transition-all shadow-sm bg-surface dark:bg-navy-900"
            title="返回伙伴列表"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <Link to="/partners" className="text-slate-400 tracking-tight hover:text-primary-navy dark:hover:text-white transition-colors">合作伙伴</Link>
            <span className="text-slate-200 dark:text-navy-800">/</span>
            <span className="text-primary-navy dark:text-white truncate max-w-[200px] flex items-center gap-2">
              {PARTNER_TYPE_ICONS[partner.partner_type]} {partner.name}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-2">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr] items-start pb-12">
          {/* Left: Profile Sidebar */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:z-10">
            {/* Partner Card */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-sm dark:border-navy-800 dark:bg-navy-900">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-8 text-center dark:border-navy-800 dark:bg-navy-950/50">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-surface dark:bg-navy-900 text-slate-700 shadow-sm dark:border-navy-700 dark:text-slate-200">
                  <Building2 size={32} />
                </div>
                <h2 className="text-lg font-black tracking-tight text-primary-navy dark:text-white">{partner.name}</h2>
                <div className="mt-2">
                  <Chip tone={partner.partner_type === 'factory' ? 'info' : partner.partner_type === 'forwarder' ? 'warning' : 'neutral'}>
                    {PARTNER_TYPE_LABELS[partner.partner_type] || partner.partner_type}
                  </Chip>
                </div>
                {partner.rating && (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={14} className={i < partner.rating! ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-navy-700'} />
                    ))}
                  </div>
                )}
                <button type="button" onClick={openEdit} className="btn-secondary mt-5 px-4 py-2 text-xs">
                  <Edit size={13} /> 编辑基本信息
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                {partner.contact_person && (
                  <DetailRow icon={<Phone size={14} />} label="联系人" value={partner.contact_person} />
                )}
                {partner.contact && (
                  <DetailRow icon={<Mail size={14} />} label="联系方式" value={partner.contact} />
                )}
                {partner.country && (
                  <DetailRow icon={<Globe size={14} />} label="国家/地区" value={partner.country} />
                )}
                {partner.address && (
                  <DetailRow icon={<MapPin size={14} />} label="地址" value={partner.address} />
                )}
                {partner.payment_terms && (
                  <DetailRow icon={<DollarSign size={14} />} label="付款条款" value={partner.payment_terms} />
                )}
                <DetailRow icon={<Calendar size={14} />} label="建档时间" value={formatDateOnly(partner.created_at)} />
                {partner.created_by_name && (
                  <DetailRow icon={<Building2 size={14} />} label="创建人" value={partner.created_by_name} />
                )}
              </div>
            </div>

            {/* Summary Card */}
            <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm p-6">
              <h3 className="text-xs font-black text-primary-navy dark:text-white tracking-tight mb-4 flex items-center gap-2">
                <BarChart3 size={14} /> 合作概览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {overviewItems.map((item) => (
                  <div key={item.label} className="text-center p-3 rounded-lg bg-slate-50/50 dark:bg-navy-950/50">
                    <div className={`text-2xl font-black ${item.color}`}>{item.value}</div>
                    <div className="text-[9px] font-bold text-slate-400 tracking-tight mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-navy-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 tracking-tight">累计往来金额</span>
                  <span className="text-sm font-black text-primary-navy dark:text-white">
                    ${summary.totalFinanceAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {partner.remark && (
              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm p-6">
                <h3 className="text-xs font-black text-primary-navy dark:text-white tracking-tight mb-2">备注</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{partner.remark}</p>
              </div>
            )}
          </div>

          {/* Right: Main Content */}
          <div className="space-y-6 min-w-0">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100/50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-800 shadow-inner w-fit">
              <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')}>
                <Package size={14} /> 关联订单 ({orders.length})
              </TabButton>
              <TabButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')}>
                <Wallet size={14} /> 财务流水 ({financeRecords.length})
              </TabButton>
            </div>

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800">
                  <h3 className="text-xs font-black text-primary-navy dark:text-white tracking-tight">关联订单</h3>
                </div>
                {orders.length === 0 ? (
                  <div className="p-12">
                    <EmptyStateBoard title="暂无关联订单" description="该伙伴尚未与任何订单关联。" icon={Package} />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-navy-950/80 backdrop-blur text-xs font-bold tracking-tight text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                        <tr>
                          <th className="px-6 py-4 text-left">订单号</th>
                          <th className="px-6 py-4 text-left">关联类型</th>
                          <th className="px-6 py-4 text-left">状态</th>
                          <th className="px-6 py-4 text-right">金额</th>
                          <th className="px-6 py-4 text-left">产品摘要</th>
                          <th className="px-6 py-4 text-left">日期</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                        {orders.map((o) => (
                          <tr
                            key={o.id}
                            onClick={() => navigate(`/orders/${o.display_id.toLowerCase()}${o.linkType === 'finance' ? '?section=finance' : o.linkType === 'production' ? '?section=production' : o.linkType === 'logistics' ? '?section=logistics' : ''}`)}
                            className="group hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                          >
                            <td className="px-6 py-4">
                              <span className="font-bold text-primary-navy dark:text-tertiary-sage data-field text-sm">
                                <Link to={`/orders/${o.display_id.toLowerCase()}${o.linkType === 'finance' ? '?section=finance' : o.linkType === 'production' ? '?section=production' : o.linkType === 'logistics' ? '?section=logistics' : ''}`} className="hover:underline">{o.display_id}</Link>
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <Chip tone={o.linkType === 'production' ? 'info' : o.linkType === 'logistics' ? 'success' : 'warning'}>
                                {o.linkType === 'production' ? '生产' : o.linkType === 'logistics' ? '物流' : '财务'}
                              </Chip>
                            </td>
                            <td className="px-6 py-4">
                              <Chip tone={getStatusMeta(o.status).tone}>{getStatusMeta(o.status).label}</Chip>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-primary-navy dark:text-white data-field">
                              ${Number(o.total_amount).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm max-w-[200px] truncate">
                              {o.product_summary || '—'}
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-500 text-xs font-bold">
                              {formatDateOnly(o.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Finance Tab */}
            {activeTab === 'finance' && (
              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800">
                  <h3 className="text-xs font-black text-primary-navy dark:text-white tracking-tight">财务流水</h3>
                </div>
                {financeRecords.length === 0 ? (
                  <div className="p-12">
                    <EmptyStateBoard title="暂无财务流水" description="该伙伴尚未关联任何财务记录。" icon={Wallet} />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-navy-950/80 backdrop-blur text-xs font-bold tracking-tight text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-navy-800">
                        <tr>
                          <th className="px-6 py-4 text-left">类型</th>
                          <th className="px-6 py-4 text-right">金额</th>
                          <th className="px-6 py-4 text-left">货币</th>
                          <th className="px-6 py-4 text-left">关联订单</th>
                          <th className="px-6 py-4 text-left">日期</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                        {financeRecords.map((r) => (
                          <tr
                            key={r.id}
                            onClick={() => { if (r.order_display_id) navigate(`/orders/${r.order_display_id.toLowerCase()}?section=finance`); }}
                            className={`group transition-colors ${r.order_display_id ? 'hover:bg-slate-50 dark:hover:bg-navy-800 cursor-pointer' : 'hover:bg-slate-50 dark:hover:bg-navy-800'}`}
                          >
                            <td className="px-6 py-4">
                              <Chip tone={r.type === 'receipt' ? 'success' : 'error'}>
                                {r.type === 'receipt' ? '收款' : '付款'}
                              </Chip>
                            </td>
                            <td className="px-6 py-4 text-right font-bold data-field"
                              style={{ color: r.type === 'receipt' ? '#059669' : '#DC2626' }}>
                              {r.type === 'receipt' ? '+' : '-'}${Number(r.amount).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-bold">{r.currency || 'USD'}</td>
                            <td className="px-6 py-4">
                              {r.order_display_id ? (
                                <span className="font-bold text-primary-navy dark:text-tertiary-sage data-field text-sm">
                                  <Link to={`/orders/${r.order_display_id.toLowerCase()}?section=finance`} className="group-hover:underline">{r.order_display_id}</Link>
                                </span>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-500 text-xs font-bold">
                              {formatDateOnly(r.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Drawer
        isOpen={showEdit}
        onClose={() => { if (!savingPartner) setShowEdit(false); }}
        title={`编辑伙伴档案：${partner.name}`}
        isDirty={isFormDirty}
        isBusy={savingPartner}
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { if (!savingPartner) setShowEdit(false); }} disabled={savingPartner} className="rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all disabled:opacity-50">取消</button>
            <button type="button" disabled={savingPartner} onClick={() => void handleSavePartner()} className="btn-primary shadow-md active:scale-95 disabled:opacity-60">{savingPartner ? '保存中...' : '保存修改'}</button>
          </div>
        }
      >
        <div className="space-y-6">
          {formError ? <div className="rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{formError}</div> : null}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="伙伴名称 *"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" /></Field></div>
            <Field label="伙伴类型 *"><select value={form.partnerType} onChange={(event) => setForm({ ...form, partnerType: event.target.value as PartnerType })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none appearance-none cursor-pointer text-primary-navy dark:text-white"><option value="factory">工厂 / 供应商</option><option value="forwarder">货代</option><option value="customs_broker">报关行</option><option value="other">其他合作方</option></select></Field>
            <Field label="国家 / 地区"><CountrySelect value={form.country} onChange={(val) => setForm({ ...form, country: val })} /></Field>
            <Field label="合作星级"><div className="flex gap-2 py-2">{[1, 2, 3, 4, 5].map(star => <button type="button" key={star} onClick={() => setForm({ ...form, rating: star })} className="transition-all hover:scale-110"><Star size={20} fill={form.rating >= star ? '#EAB308' : 'none'} color={form.rating >= star ? '#EAB308' : '#CBD5E1'} /></button>)}</div></Field>
            <Field label="主要联系人"><input value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" /></Field>
            <Field label="联系电话/邮箱"><input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" /></Field>
            <div className="sm:col-span-2"><Field label="详细地址"><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" /></Field></div>
            <div className="sm:col-span-2"><Field label="结算条件"><input value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} placeholder="例如：月结30天..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white" /></Field></div>
            <div className="sm:col-span-2"><Field label="备注说明"><textarea value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} placeholder="备用联系人或特殊条款..." className="w-full rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 px-4 py-3 text-sm focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors outline-none text-primary-navy dark:text-white min-h-[80px]" rows={3} /></Field></div>
          </div>
        </div>
      </Drawer>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

function getOverviewItems(partnerType: string, summary: PartnerDetail['summary']) {
  const common = [
    { label: '累计订单', value: summary.totalOrders, color: 'text-primary-navy dark:text-white' },
    { label: '累计往来', value: `$${summary.totalFinanceAmount.toLocaleString()}`, color: 'text-primary-navy dark:text-white' },
  ];
  if (partnerType === 'factory') {
    return [
      { label: '生产安排', value: summary.productionCount, color: 'text-tertiary-sage' },
      { label: '本月生产', value: summary.thisMonthCount, color: 'text-primary-navy dark:text-white' },
      { label: '上月生产', value: summary.lastMonthCount, color: 'text-slate-500 dark:text-slate-400' },
      common[1],
    ];
  }
  if (partnerType === 'forwarder') {
    return [
      { label: '物流委托', value: summary.logisticsCount || 0, color: 'text-tertiary-sage' },
      common[0],
      { label: '本月协作', value: summary.thisMonthCount, color: 'text-primary-navy dark:text-white' },
      common[1],
    ];
  }
  if (partnerType === 'customs_broker') {
    return [
      { label: '报关协作', value: summary.totalOrders, color: 'text-tertiary-sage' },
      { label: '财务记录', value: summary.totalFinanceAmount ? '已关联' : '暂无', color: 'text-primary-navy dark:text-white' },
      { label: '本月业务', value: summary.thisMonthCount, color: 'text-primary-navy dark:text-white' },
      common[1],
    ];
  }
  return [
    common[0],
    { label: '物流委托', value: summary.logisticsCount || 0, color: 'text-tertiary-sage' },
    { label: '生产安排', value: summary.productionCount, color: 'text-primary-navy dark:text-white' },
    common[1],
  ];
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-slate-400 tracking-tight">{label}</div>
        <div className="text-sm font-bold text-primary-navy dark:text-white mt-0.5 break-all">{value}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all tracking-tight ${
        active
          ? 'bg-primary-navy dark:bg-navy-900 text-white shadow-sm'
          : 'text-slate-500 dark:text-slate-400 hover:text-primary-navy dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
