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
} from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import { WorkSection, EmptyStateBoard, LightActionButton } from './components';
import { asNumber, asText, STAGE_STEPS } from './utils';
import type {
  CustomerInfo,
  FinanceRecord,
  OrderInfo,
  OrderItem,
  PackingRecord,
  ProductionPlan,
  SectionKey,
} from './types';

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
}) {
  return (
    <header ref={headerRef} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-6 shadow-sm mt-0 transition-colors">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between border-b border-[#F1F5F9] dark:border-navy-800 pb-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-secondary-slate dark:text-slate-400 uppercase tracking-widest leading-none">
              <Link to="/orders" className="hover:text-primary-navy dark:hover:text-tertiary-sage transition-colors">订单管理</Link>
              <ChevronRight size={12} className="opacity-30" />
              <span className="text-primary-navy dark:text-tertiary-sage data-field" style={{ viewTransitionName: 'order-id' }}>{order.display_id}</span>
            </div>
            <h1 className="text-2xl font-bold text-primary-navy dark:text-white tracking-tight truncate mb-4 hover:text-blue-600 cursor-pointer transition-colors" onClick={() => navigate(`/customers/${customer.display_id}`)}>
              {asText(customer.name, '未命名客户')}
            </h1>
            <div className="flex flex-wrap gap-4 text-xs font-bold text-secondary-slate dark:text-slate-400 uppercase tracking-widest">
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
        <div className="rounded-md bg-[#F8FAFC] dark:bg-navy-950/50 border border-slate-100 dark:border-navy-800 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {STAGE_STEPS.map((s, i) => (
              <button key={s.key} onClick={() => scrollToSection(s.target)} className={`flex-1 min-w-[130px] flex items-center gap-3 px-4 py-2 rounded transition-all ${s.key === order.status ? 'bg-white dark:bg-navy-800 shadow-md ring-1 ring-slate-200 dark:ring-navy-700' : 'opacity-40 hover:opacity-100'}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i <= stageIndex ? 'bg-primary-navy dark:bg-tertiary-sage text-white' : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'}`}>{i + 1}</span>
                <span className={`text-xs font-bold uppercase tracking-widest ${s.key === order.status ? 'text-primary-navy dark:text-white' : 'text-secondary-slate dark:text-slate-400'}`}>{s.label}</span>
              </button>
            ))}
          </div>
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
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm">
          <table className="min-w-full text-left text-xs font-medium">
            <thead className="bg-slate-50 dark:bg-navy-950 font-bold uppercase tracking-widest border-b border-slate-200 dark:border-navy-800 data-field text-xs text-secondary-slate dark:text-slate-400">
              <tr><th className="px-5 py-4">产品名称</th><th className="px-5 py-4 text-center">规格/型号</th><th className="px-5 py-4 text-center">数量</th><th className="px-5 py-4 text-center">单位</th><th className="px-5 py-4 text-right">单价 (USD)</th><th className="px-5 py-4 text-right">总价 (USD)</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800 font-medium tracking-tight">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                  <td className="px-5 py-4 font-bold text-primary-navy dark:text-white uppercase">{asText(item.product_name)}</td>
                  <td className="px-5 py-4 text-center text-secondary-slate dark:text-slate-400 text-xs data-field uppercase font-bold">{asText(item.specification, '通用')}</td>
                  <td className="px-5 py-4 text-center font-bold text-primary-navy dark:text-white data-field">{item.quantity}</td>
                  <td className="px-5 py-4 text-center text-secondary-slate dark:text-slate-400 font-bold">{item.unit || 'pcs'}</td>
                  <td className="px-5 py-4 text-right text-secondary-slate dark:text-slate-400 data-field font-bold">{asNumber(item.unit_price).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right font-bold text-primary-navy dark:text-tertiary-sage data-field text-sm">USD {asNumber(item.subtotal).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#F1F5F9] dark:bg-navy-950 border-t border-slate-200 dark:border-navy-800">
              <tr className="text-secondary-slate dark:text-slate-400">
                <td colSpan={5} className="px-5 py-3 text-right text-xs uppercase tracking-widest">商品小计 (Subtotal)</td>
                <td className="px-5 py-3 text-right text-sm font-bold data-field">USD {itemsTotal.toLocaleString()}</td>
              </tr>
              {freightAmount > 0 && (
                <tr className="text-secondary-slate dark:text-slate-400">
                  <td colSpan={5} className="px-5 py-3 text-right text-xs uppercase tracking-widest">运费估算 (Freight)</td>
                  <td className="px-5 py-3 text-right text-sm font-bold data-field">USD {freightAmount.toLocaleString()}</td>
                </tr>
              )}
              {miscAmount > 0 && (
                <tr className="text-secondary-slate dark:text-slate-400">
                  <td colSpan={5} className="px-5 py-3 text-right text-xs uppercase tracking-widest">其他杂费 (Misc)</td>
                  <td className="px-5 py-3 text-right text-sm font-bold data-field">USD {miscAmount.toLocaleString()}</td>
                </tr>
              )}
              <tr className="text-primary-navy dark:text-white font-extrabold border-t border-slate-200 dark:border-navy-700">
                <td colSpan={5} className="px-5 py-5 text-right text-xs uppercase tracking-widest">合计总值 (Grand Total)</td>
                <td className="px-5 py-5 text-right text-xl data-field text-primary-navy dark:text-tertiary-sage">USD {grandTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <EmptyStateBoard title="暂无商品明细" description="尚未录入任何货物信息。请立即初始化本单的货物清单数据，以便后续核算。" icon={Package} actionLabel="+ 初始化货物清单" onAction={openOrderDrawer} />
      )}
    </WorkSection>
  );
}
