import React from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  MapPin,
  Mail,
  Edit3,
  DollarSign,
  Factory,
  ShieldCheck,
  Truck,
  Printer,
  Trash,
  FileText,
  Plus,
  Package,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import { WorkSection, EmptyStateBoard, LightActionButton } from './components';
import { asNumber, asText, formatDateOnly, formatIncoterm, formatTransportMode, STAGE_STEPS } from './utils';
import type {
  CustomerInfo,
  FinanceRecord,
  LogisticsRecord,
  OrderInfo,
  OrderItem,
  PackingRecord,
  ProductionPlan,
  SectionKey,
} from './types';

function formatMoney(amount: number, currency = 'USD') {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getProductionOverview(plan: ProductionPlan | null) {
  if (!plan) return { label: '未排产', detail: '等待同步生产', tone: 'warning' as const, progress: 0 };
  switch (plan.productionStatus) {
    case 'ready': return { label: '已完工', detail: plan.partnerName || '生产完成', tone: 'success' as const, progress: 100 };
    case 'in_progress': return { label: '生产中', detail: plan.partnerName || '工厂生产中', tone: 'info' as const, progress: 60 };
    case 'scheduled': return { label: '已排产', detail: plan.partnerName || '等待开工', tone: 'info' as const, progress: 20 };
    default: return { label: '未开始', detail: plan.partnerName || '等待生产', tone: 'warning' as const, progress: 0 };
  }
}

function getLogisticsOverview(hasAnyLogistics: boolean) {
  return hasAnyLogistics
    ? { label: '已发运', detail: '查看运输轨迹', tone: 'success' as const }
    : { label: '未发运', detail: '待录入运单', tone: 'warning' as const };
}

function toneClasses(tone: 'success' | 'warning' | 'error' | 'info' | 'neutral') {
  switch (tone) {
    case 'success': return 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-900/40';
    case 'warning': return 'text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-900/40';
    case 'error': return 'text-red-600 bg-red-50 border-red-100 dark:text-red-300 dark:bg-red-900/20 dark:border-red-900/40';
    case 'info': return 'text-sky-600 bg-sky-50 border-sky-100 dark:text-sky-300 dark:bg-sky-900/20 dark:border-sky-900/40';
    default: return 'text-slate-500 bg-slate-50 border-slate-100 dark:text-slate-300 dark:bg-navy-800 dark:border-navy-700';
  }
}

function OverviewMetric({ label, value, helper, icon, tone = 'neutral', onClick }: { label: string; value: React.ReactNode; helper: string; icon: React.ReactNode; tone?: 'success' | 'warning' | 'error' | 'info' | 'neutral'; onClick?: () => void }) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tracking-tight">{label}</span>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${toneClasses(tone)}`}>{icon}</span>
      </div>
      <div className="mt-3 text-lg font-black text-primary-navy dark:text-white data-field truncate">{value}</div>
      <div className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500 truncate">{helper}</div>
    </>
  );
  if (onClick) {
    return <button type="button" onClick={onClick} className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50/60 dark:bg-navy-950/40 p-4 text-left transition-all hover:bg-surface dark:hover:bg-navy-900 hover:border-slate-200 dark:hover:border-navy-700">{content}</button>;
  }
  return <div className="rounded-lg border border-slate-100 dark:border-navy-800 bg-slate-50/60 dark:bg-navy-950/40 p-4">{content}</div>;
}

function TradeSignal({ label, value, helper, icon, onClick }: { label: string; value: React.ReactNode; helper: string; icon: React.ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-surface text-slate-500 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400">{icon}</span>
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-black text-primary-navy dark:text-white data-field">{value}</div>
      <div className="mt-1 truncate text-xs font-bold text-slate-400 dark:text-slate-500">{helper}</div>
    </>
  );
  if (onClick) {
    return <button type="button" onClick={onClick} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-left transition-all hover:border-slate-200 hover:bg-surface dark:border-navy-800 dark:bg-navy-950/40 dark:hover:border-navy-700 dark:hover:bg-navy-900">{body}</button>;
  }
  return <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 dark:border-navy-800 dark:bg-navy-950/40">{body}</div>;
}

export function OrderHeaderSection({
  headerRef,
  order,
  customer,
  stageIndex,
  navigate,
  scrollToSection,
  openOrderDrawer,
  openFinanceDrawer,
  openProductionDrawer,
  openCustomsDrawer,
  openLogisticsDrawer,
  handleExportPdf,
  setIsDeleteModalOpen,
  user,
  items,
  financeRecords,
  productionPlan,
  hasAnyLogistics,
  packingRecords,
  logisticsRecords,
}: {
  headerRef: React.RefObject<HTMLDivElement | null>;
  order: OrderInfo;
  customer: CustomerInfo;
  stageIndex: number;
  navigate: (path: string) => void;
  scrollToSection: (section: string) => void;
  openOrderDrawer: () => void;
  openFinanceDrawer: () => void;
  openProductionDrawer: () => void;
  openCustomsDrawer: () => void;
  openLogisticsDrawer: () => void;
  handleExportPdf: () => void;
  setIsDeleteModalOpen: (v: boolean) => void;
  user?: { name?: string; role?: string } | null;
  items: OrderItem[];
  financeRecords: FinanceRecord[];
  productionPlan: ProductionPlan | null;
  hasAnyLogistics: boolean;
  packingRecords: PackingRecord[];
  logisticsRecords: LogisticsRecord[];
}) {
  const orderTotal = asNumber(order.total_amount) || items.reduce((sum, item) => sum + asNumber(item.subtotal), 0);
  const paidUsd = financeRecords
    .filter((record) => record.type === 'receipt' && record.status === 'completed' && record.currency === 'USD')
    .reduce((sum, record) => sum + asNumber(record.amount), 0);
  const outstandingUsd = Math.max(orderTotal - paidUsd, 0);
  const collectionRate = orderTotal > 0 ? Math.min(Math.round((paidUsd / orderTotal) * 100), 100) : 0;
  const productionMeta = getProductionOverview(productionPlan);
  const logisticsMeta = getLogisticsOverview(hasAnyLogistics);
  const openTasks = financeRecords.filter((record) => record.status === 'pending').length + (productionPlan ? 0 : 1) + (hasAnyLogistics ? 0 : 1);
  const riskTone = outstandingUsd > 0 || openTasks > 0 ? 'warning' : 'success';
  const primaryLogistics = logisticsRecords.find((record) => record.segmentType === 'international') || logisticsRecords[0];
  const incotermRecord = logisticsRecords.find((record) => record.segmentType === 'international' && formatIncoterm(record.incoterm, '') !== '') || logisticsRecords.find((record) => formatIncoterm(record.incoterm, '') !== '');
  const incoterm = formatIncoterm(incotermRecord?.incoterm);
  const transportMode = formatTransportMode(primaryLogistics?.transportMode, '待确认');
  const etd = primaryLogistics?.etd || primaryLogistics?.shippingDate || productionPlan?.estimatedDeliveryDate || order.deliveryDate;
  const eta = primaryLogistics?.eta;

  return (
    <header ref={headerRef} className="bg-surface dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-6 shadow-sm mt-0 transition-colors">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between border-b border-slate-100 dark:border-navy-800 pb-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-secondary-slate dark:text-slate-400 tracking-tight leading-none">
              <Link to="/orders" className="hover:text-primary-navy dark:hover:text-tertiary-sage transition-colors">订单管理</Link>
              <ChevronRight size={12} className="opacity-30" />
              <span className="text-primary-navy dark:text-tertiary-sage data-field" style={{ viewTransitionName: 'order-id' }}>{order.display_id}</span>
            </div>
            <h1 className="text-2xl font-bold text-primary-navy dark:text-white tracking-tight truncate mb-4 hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate(`/customers/${customer.display_id}`)}>
              {asText(customer.name, '未命名客户')}
            </h1>
            <div className="flex flex-wrap gap-4 text-xs font-bold text-secondary-slate dark:text-slate-400 tracking-tight">
              <span className="flex items-center gap-1.5"><MapPin size={12} className="text-tertiary-sage" />{asText(customer.country)}</span>
              <span className="flex items-center gap-1.5"><Mail size={12} className="text-info dark:text-blue-400" />{asText(customer.contact)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Tooltip text="订单已结清，清单不可修改。" disabled={order.status !== 'completed'}>
              <button disabled={order.status === 'completed'} onClick={openOrderDrawer} className="btn-primary text-xs px-5 py-2"><Edit3 size={14} /> 编辑清单</button>
            </Tooltip>
            <button onClick={() => openFinanceDrawer()} className="btn-secondary text-xs px-4 py-2"><DollarSign size={14} className="text-slate-400" /> 录入收支</button>
            <Tooltip text="需先确认清单并核销定金收据后解锁生产同步。" disabled={items.length > 0 && financeRecords.some(r => r.type === 'receipt' && r.recordCategory === 'deposit' && r.status === 'completed')}>
              <button disabled={!(items.length > 0 && financeRecords.some(r => r.type === 'receipt' && r.recordCategory === 'deposit' && r.status === 'completed'))} onClick={openProductionDrawer} className="btn-secondary text-xs px-4 py-2"><Factory size={14} className="text-slate-400" /> 同步生产</button>
            </Tooltip>
            <Tooltip text="需先完成装箱单录入或至少有一条发运记录后开启报关。" disabled={hasAnyLogistics || packingRecords.length > 0}>
              <button disabled={!(hasAnyLogistics || packingRecords.length > 0)} onClick={openCustomsDrawer} className="btn-secondary text-xs px-4 py-2"><ShieldCheck size={14} className="text-slate-400" /> 更新报关</button>
            </Tooltip>
            <Tooltip text="需待生产环节进入'进行中'或'已完工'状态后方可安排发运。" disabled={productionPlan?.productionStatus === 'ready' || productionPlan?.productionStatus === 'in_progress'}>
              <button disabled={!(productionPlan?.productionStatus === 'ready' || productionPlan?.productionStatus === 'in_progress')} onClick={() => openLogisticsDrawer()} className="btn-secondary text-xs px-4 py-2"><Truck size={14} className="text-slate-400" /> 创建物流</button>
            </Tooltip>
            <div className="h-6 w-px bg-slate-100 dark:bg-navy-800 mx-4 hidden sm:block" />
            <button onClick={handleExportPdf} className="btn-secondary text-xs px-4 py-2"><Printer size={14} className="text-slate-400" /> 导出 PDF</button>
            {user?.role === 'admin' && (
              <button onClick={() => setIsDeleteModalOpen(true)} className="btn-destructive text-xs px-4 py-2"><Trash size={14} /> 删除订单</button>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewMetric label="订单总额" value={`${formatMoney(orderTotal)}${incoterm !== '待确认' ? ` (${incoterm})` : ''}`} helper={`${items.length} 个商品 · 回款 ${collectionRate}%`} icon={<DollarSign size={16} />} tone="neutral" onClick={() => scrollToSection('items')} />
          <OverviewMetric label="已收 / 未收" value={`${formatMoney(paidUsd)} / ${formatMoney(outstandingUsd)}`} helper={outstandingUsd > 0 ? '仍有尾款待核销' : '回款已覆盖订单金额'} icon={<Wallet size={16} />} tone={outstandingUsd > 0 ? 'warning' : 'success'} onClick={() => scrollToSection('finance')} />
          <OverviewMetric label="生产状态" value={productionMeta.label} helper={`${productionMeta.detail} · ${productionMeta.progress}%`} icon={<Factory size={16} />} tone={productionMeta.tone} onClick={() => scrollToSection('production')} />
          <OverviewMetric label="物流状态" value={logisticsMeta.label} helper={logisticsMeta.detail} icon={<Truck size={16} />} tone={logisticsMeta.tone} onClick={() => scrollToSection('logistics')} />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <TradeSignal label="贸易术语" value={incoterm} helper={incotermRecord ? '来源于国际段物流记录' : '贸易术语待物流记录确认'} icon={<Truck size={13} />} onClick={() => scrollToSection('logistics')} />
          <TradeSignal label="运输方式" value={transportMode} helper={primaryLogistics ? '已维护物流方式' : '运输方式待物流记录确认'} icon={<Truck size={13} />} onClick={() => scrollToSection('logistics')} />
          <TradeSignal label="付款条件" value={customer.paymentTerms || '待维护'} helper={outstandingUsd > 0 ? '财务需关注尾款风险' : '当前回款风险较低'} icon={<Wallet size={13} />} onClick={() => scrollToSection('finance')} />
          <TradeSignal label="预计离港 / 到港 (ETD/ETA)" value={`${formatDateOnly(etd, 'ETD 待定')} / ${formatDateOnly(eta, 'ETA 待定')}`} helper={primaryLogistics?.vesselVoyage || '上船/到港时间锚点'} icon={<CalendarDays size={13} />} onClick={() => scrollToSection('logistics')} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-md bg-slate-50/50 dark:bg-navy-950/40 border border-slate-100 dark:border-navy-800 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {STAGE_STEPS.map((s, i) => (
                <button key={s.key} onClick={() => scrollToSection(s.target)} className={`flex-1 min-w-[130px] flex items-center gap-3 px-4 py-2 rounded transition-all ${s.key === order.status ? 'bg-surface dark:bg-navy-800 shadow-sm ring-1 ring-slate-200 dark:ring-navy-700' : 'opacity-60 hover:opacity-100 hover:bg-surface dark:hover:bg-navy-900'}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i <= stageIndex ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'}`}>{i + 1}</span>
                  <span className={`text-xs font-bold tracking-tight ${s.key === order.status ? 'text-primary-navy dark:text-white' : 'text-secondary-slate dark:text-slate-400'}`}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => scrollToSection(openTasks > 0 ? 'finance' : 'followups')} className="rounded-md border border-slate-100 dark:border-navy-800 bg-slate-50/60 dark:bg-navy-950/40 px-4 py-3 text-left transition-all hover:bg-surface dark:hover:bg-navy-900">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">当前风险 / 下一步</span>
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${toneClasses(riskTone)}`}>{riskTone === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}</span>
            </div>
            <div className="mt-2 text-sm font-black text-primary-navy dark:text-white">{riskTone === 'success' ? '暂无明显阻塞' : `${openTasks} 项需要跟进`}</div>
            <div className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500">{outstandingUsd > 0 ? '优先核对回款与交付节点' : '继续维护跟进记录'}</div>
          </button>
        </div>
      </div>
    </header>
  );
}

export function ItemsSection({
  sectionRef,
  collapsed,
  onToggle,
  items,
  openOrderDrawer,
  grandTotal,
  itemsTotal = 0,
  freightAmount = 0,
  miscAmount = 0,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>;
  collapsed: boolean;
  onToggle: () => void;
  items: OrderItem[];
  openOrderDrawer: () => void;
  grandTotal: number;
  itemsTotal?: number;
  freightAmount?: number;
  miscAmount?: number;
}) {
  return (
    <WorkSection ref={sectionRef} section="items" title="商品明细" icon={<FileText size={16} />} collapsed={collapsed} onToggle={onToggle} action={items.length ? <LightActionButton onClick={openOrderDrawer} className="!text-xs !px-3"><Plus size={12} className="mr-1" /> 编辑清单</LightActionButton> : null}>
      {items.length ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 bg-surface dark:bg-navy-900 shadow-sm">
          <table className="min-w-full text-left text-xs font-medium">
            <thead className="bg-slate-50 dark:bg-navy-950 font-bold tracking-tight border-b border-slate-200 dark:border-navy-800 data-field text-xs text-secondary-slate dark:text-slate-400">
              <tr><th className="px-5 py-4">产品名称</th><th className="px-5 py-4 text-center">规格/型号</th><th className="px-5 py-4 text-center">HS Code</th><th className="px-5 py-4 text-center">数量</th><th className="px-5 py-4 text-center">单位</th><th className="px-5 py-4 text-right">单价 (USD)</th><th className="px-5 py-4 text-right">总价 (USD)</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800 font-medium tracking-tight">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                  <td className="px-5 py-4 font-bold text-primary-navy dark:text-white">{asText(item.product_name)}</td>
                  <td className="px-5 py-4 text-center text-secondary-slate dark:text-slate-400 text-xs data-field font-bold">{asText(item.specification, '通用')}</td>
                  <td className="px-5 py-4 text-center text-secondary-slate dark:text-slate-400 text-xs data-field font-bold">{asText(item.hsCode || item.hs_code, '待补充')}</td>
                  <td className="px-5 py-4 text-center font-bold text-primary-navy dark:text-white data-field">{item.quantity}</td>
                  <td className="px-5 py-4 text-center text-secondary-slate dark:text-slate-400 font-bold">{item.unit || 'pcs'}</td>
                  <td className="px-5 py-4 text-right text-secondary-slate dark:text-slate-400 data-field font-bold">{asNumber(item.unit_price).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right font-bold text-primary-navy dark:text-tertiary-sage data-field text-sm">USD {asNumber(item.subtotal).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-navy-950/50 border-t border-slate-200 dark:border-navy-800">
              <tr className="text-secondary-slate dark:text-slate-400">
                <td colSpan={6} className="px-5 py-3 text-right text-xs tracking-tight">商品小计 (Subtotal)</td>
                <td className="px-5 py-3 text-right text-sm font-bold data-field">USD {itemsTotal.toLocaleString()}</td>
              </tr>
              {freightAmount > 0 && (
                <tr className="text-secondary-slate dark:text-slate-400">
                  <td colSpan={6} className="px-5 py-3 text-right text-xs tracking-tight">运费估算 (Freight)</td>
                  <td className="px-5 py-3 text-right text-sm font-bold data-field">USD {freightAmount.toLocaleString()}</td>
                </tr>
              )}
              {miscAmount > 0 && (
                <tr className="text-secondary-slate dark:text-slate-400">
                  <td colSpan={6} className="px-5 py-3 text-right text-xs tracking-tight">其他杂费 (Misc)</td>
                  <td className="px-5 py-3 text-right text-sm font-bold data-field">USD {miscAmount.toLocaleString()}</td>
                </tr>
              )}
              <tr className="text-primary-navy dark:text-white font-extrabold border-t border-slate-200 dark:border-navy-700">
                <td colSpan={6} className="px-5 py-5 text-right text-xs tracking-tight">合计总值 (Grand Total)</td>
                <td className="px-5 py-5 text-right text-xl data-field text-primary-navy dark:text-tertiary-sage">USD {grandTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <EmptyStateBoard title="暂无商品明细" description="请录入产品名称、规格、数量、单价和图片，后续财务、生产、装箱与利润核算都会基于清单展开。" icon={Package} actionLabel="+ 初始化货物清单" onAction={openOrderDrawer} />
      )}
    </WorkSection>
  );
}
