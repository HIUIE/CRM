import React, { useMemo, useState } from 'react';
import { Check, Search, Trash, Plus, Clock, Upload, FileCheck, X } from 'lucide-react';
import { Field, AttachmentEditor } from './components';
import { asNumber, formatDateOnly } from './utils';
import type {
  AIAnalysisResult,
  CustomsFormState,
  FinanceFormState,
  FinanceType,
  FinanceStatus,
  FinanceCategory,
  LogisticsFormState,
  LogisticsStatus,
  OrderFormState,
  OrderStatus,
  PackingFormState,
  ProductionFormState,
  ProductionLogFormState,
  ProductionStatus,
  Partner,
} from './types';

// ==================== Order Edit Form ====================

export function OrderEditForm({
  orderForm,
  setOrderForm,
  deletedItemIds,
  setDeletedItemIds,
}: {
  orderForm: OrderFormState;
  setOrderForm: React.Dispatch<React.SetStateAction<OrderFormState>>;
  deletedItemIds: number[];
  setDeletedItemIds: React.Dispatch<React.SetStateAction<number[]>>;
}) {
  return (
    <div className="space-y-12">
      <section className="grid gap-10 sm:grid-cols-2">
        <Field label="业务状态">
          <select value={orderForm.status} onChange={e => setOrderForm({ ...orderForm, status: e.target.value as OrderStatus })} className="w-full bg-slate-50 dark:bg-navy-950 p-3 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm">
            <option value="draft">待受理</option>
            <option value="production">生产中</option>
            <option value="customs">报关中</option>
            <option value="shipping">物流中</option>
            <option value="completed">已结清</option>
          </select>
        </Field>
        <Field label="预期交期">
          <input type="date" value={orderForm.deliveryDate} onChange={e => setOrderForm({ ...orderForm, deliveryDate: e.target.value })} className="w-full bg-slate-50 dark:bg-navy-950 p-3 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm" />
        </Field>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-4">
          <h4 className="text-sm font-bold text-primary-navy dark:text-white tracking-tight">产品项目清单</h4>
          <button type="button" onClick={() => setOrderForm({ ...orderForm, items: [...orderForm.items, { clientKey: Math.random().toString(36).slice(2), productName: '', specification: '', quantity: '1', unit: 'pcs', unitPrice: '0', subtotal: '0', imageUrl: '' }] })} className="btn-primary text-xs px-5 py-2 rounded-md">+ 新增产品</button>
        </div>
        <div className="space-y-4">
          {orderForm.items.length === 0 && <div className="py-16 text-center border border-dashed border-slate-300 dark:border-navy-800 rounded-lg text-slate-400 text-xs font-bold tracking-tight">点击上方按钮添加产品明细</div>}
          {orderForm.items.map((item, idx) => (
            <div key={item.clientKey} className="relative p-5 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-navy-800 group hover:bg-white dark:hover:bg-navy-800 hover:border-primary-navy/30 dark:hover:border-tertiary-sage/30 transition-all shadow-sm">
              <button type="button" onClick={() => { if (item.id) setDeletedItemIds([...deletedItemIds, item.id]); setOrderForm({ ...orderForm, items: orderForm.items.filter((_, i) => i !== idx) }); }} className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-error text-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-10"><Trash size={12} /></button>
              <div className="grid gap-5 sm:grid-cols-12">
                <div className="sm:col-span-12"><Field label="产品名称/型号 *"><input required value={item.productName} onChange={e => { const next = [...orderForm.items]; next[idx].productName = e.target.value; setOrderForm({ ...orderForm, items: next }); }} placeholder="输入正式商业发票名称..." className="w-full bg-transparent p-1 text-sm font-bold text-primary-navy dark:text-white focus:outline-none border-b-2 border-slate-200 dark:border-navy-800 focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors" /></Field></div>
                <div className="sm:col-span-4"><Field label="配置规格"><input value={item.specification} onChange={e => { const next = [...orderForm.items]; next[idx].specification = e.target.value; setOrderForm({ ...orderForm, items: next }); }} placeholder="标准规格..." className="w-full bg-transparent p-1 text-sm font-bold text-secondary-slate dark:text-slate-400 focus:outline-none" /></Field></div>
                <div className="sm:col-span-4"><Field label="单位"><select value={item.unit} onChange={e => { const next = [...orderForm.items]; next[idx].unit = e.target.value; setOrderForm({ ...orderForm, items: next }); }} className="w-full bg-transparent p-1 text-sm font-bold text-primary-navy dark:text-white appearance-none focus:outline-none cursor-pointer"><option value="pcs">pcs (件)</option><option value="sets">sets (套)</option><option value="kg">kg (公斤)</option><option value="m">m (米)</option><option value="rolls">rolls (卷)</option></select></Field></div>
                <div className="sm:col-span-4"><Field label="单价 (USD)"><input type="number" step="0.0001" value={item.unitPrice} onChange={e => { const next = [...orderForm.items]; next[idx].unitPrice = e.target.value; next[idx].subtotal = String(asNumber(e.target.value) * asNumber(next[idx].quantity)); setOrderForm({ ...orderForm, items: next }); }} className="w-full bg-transparent p-1 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none data-field border-b border-slate-100 dark:border-navy-800" /></Field></div>
                <div className="sm:col-span-4"><Field label="数量"><input type="number" value={item.quantity} onChange={e => { const next = [...orderForm.items]; next[idx].quantity = e.target.value; next[idx].subtotal = String(asNumber(e.target.value) * asNumber(next[idx].unitPrice)); setOrderForm({ ...orderForm, items: next }); }} className="w-full bg-transparent p-1 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none data-field border-b border-slate-100 dark:border-navy-800 text-center" /></Field></div>
                <div className="sm:col-span-4 flex flex-col justify-end items-end"><div className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-tight mb-1">Row Total</div><div className="text-[18px] font-extrabold text-primary-navy dark:text-tertiary-sage data-field leading-none">USD {asNumber(item.subtotal).toLocaleString()}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-navy-800 pb-4"><h4 className="text-sm font-bold text-primary-navy dark:text-white tracking-tight">财务补差与运杂费</h4></div>
        <div className="grid gap-12 sm:grid-cols-2">
          <Field label="预估出口运费 (USD)"><input type="number" value={orderForm.freightAmount} onChange={e => setOrderForm({ ...orderForm, freightAmount: e.target.value })} className="w-full bg-transparent p-2 text-lg font-bold text-primary-navy dark:text-white focus:outline-none border-b-2 border-slate-200 dark:border-navy-800 focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors data-field" /></Field>
          <Field label="其他税杂补差 (USD)"><input type="number" value={orderForm.miscAmount} onChange={e => setOrderForm({ ...orderForm, miscAmount: e.target.value })} className="w-full bg-transparent p-2 text-lg font-bold text-primary-navy dark:text-white focus:outline-none border-b-2 border-slate-200 dark:border-navy-800 focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors data-field" /></Field>
        </div>
        <Field label="内部核心指令与备注"><textarea rows={6} value={orderForm.details} onChange={e => setOrderForm({ ...orderForm, details: e.target.value })} placeholder="输入包装协议、客户强制性要求、业务风险点等重要备注..." className="w-full bg-slate-50 dark:bg-navy-950 p-4 rounded-lg text-[14px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed focus:outline-none border border-slate-200 dark:border-navy-800 shadow-inner" /></Field>
      </section>
    </div>
  );
}

// ==================== Finance Form ====================

export function FinanceForm({
  financeForm,
  setFinanceForm,
  customerName,
  partners,
  isUploading,
  uploadProgress,
}: {
  financeForm: FinanceFormState;
  setFinanceForm: React.Dispatch<React.SetStateAction<FinanceFormState>>;
  customerName: string;
  partners: Partner[];
  isUploading: boolean;
  uploadProgress: number;
}) {
  const paymentPartners = useMemo(() => partners, [partners]);
  const selectedPartner = paymentPartners.find((p) => String(p.id) === financeForm.partnerId) || null;
  const handleTypeChange = (type: FinanceType) => {
    setFinanceForm({
      ...financeForm,
      type,
      partnerId: type === 'receipt' ? '' : financeForm.partnerId,
      target: type === 'receipt' ? customerName : financeForm.target,
      recordCategory: type === 'receipt' ? 'deposit' : (financeForm.recordCategory === 'deposit' || financeForm.recordCategory === 'balance' ? 'goods' : financeForm.recordCategory),
    });
  };

  return (
    <div className="space-y-12">
      <div className="grid gap-12 sm:grid-cols-2">
        <Field label="资产流转方向"><select value={financeForm.type} onChange={e=>handleTypeChange(e.target.value as FinanceType)} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm"><option value="receipt">资产流入：客户付款</option><option value="payment">资产流出：付给合作伙伴</option></select></Field>
        <div className="flex gap-4 items-end">
          <div className="w-24"><Field label="币种"><select value={financeForm.currency} onChange={e=>setFinanceForm({...financeForm, currency:e.target.value})} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm"><option value="USD">USD</option><option value="CNY">CNY</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="HKD">HKD</option></select></Field></div>
          <div className="flex-1"><Field label="计价金额"><input type="number" min="0.01" step="0.01" value={financeForm.amount} onChange={e=>setFinanceForm({...financeForm, amount:e.target.value})} placeholder="输入大于 0 的金额" className="w-full bg-transparent p-2 text-[32px] font-bold text-primary-navy dark:text-white data-field focus:outline-none border-b-2 border-slate-200 dark:border-navy-800 focus:border-primary-navy dark:focus:border-tertiary-sage transition-colors" /></Field></div>
        </div>
      </div>
      <div className="grid gap-12 sm:grid-cols-2">
        <Field label="账务核销状态"><select value={financeForm.status} onChange={e=>setFinanceForm({...financeForm, status:e.target.value as FinanceStatus})} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm"><option value="completed">已核销同步 (Closed)</option><option value="pending">待处理流水 (Pending)</option></select></Field>
        <Field label="款项所属分类"><select value={financeForm.recordCategory} onChange={e=>setFinanceForm({...financeForm, recordCategory:e.target.value as FinanceCategory})} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm"><option value="deposit">预付定金</option><option value="balance">尾款</option><option value="goods">货款</option><option value="freight">运费</option><option value="customs">报关费</option><option value="other">杂项其他</option></select></Field>
      </div>
      {financeForm.type === 'receipt' ? (
        <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/60 dark:bg-emerald-900/10 p-5">
          <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 tracking-tight">收款对象</div>
          <div className="mt-2 text-base font-black text-primary-navy dark:text-white">{customerName || '当前订单客户'}</div>
          <div className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">收款流水会自动使用订单客户，保存时不写入 partner_id。</div>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2">
          <Field label="付给合作伙伴"><select value={financeForm.partnerId} onChange={e=>{ const partner = paymentPartners.find(p => String(p.id) === e.target.value); setFinanceForm({...financeForm, partnerId:e.target.value, target: partner?.name || financeForm.target}); }} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm"><option value="">请选择合作伙伴...</option>{paymentPartners.map(p => <option key={p.id} value={p.id}>{p.name} · {p.partner_type}</option>)}</select></Field>
          <Field label="临时付款对象"><input value={financeForm.target} onChange={e=>setFinanceForm({...financeForm, target:e.target.value, partnerId:''})} placeholder={selectedPartner ? selectedPartner.name : '无档案时填写文本对象'} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
        </div>
      )}
      <Field label="备注说明"><textarea value={financeForm.remark} onChange={e=>setFinanceForm({...financeForm, remark:e.target.value})} placeholder="填写水单编号、付款备注或核销说明..." rows={3} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
      <div className="pt-8 border-t border-slate-100 dark:border-navy-800"><AttachmentEditor title="银行水单或支付凭证存档" attachments={financeForm.attachments} newFiles={financeForm.newFiles} onFilesSelected={fs=>setFinanceForm({...financeForm, newFiles:[...financeForm.newFiles,...fs.map(f=>({file:f,remark:''}))]})} onRemoveExisting={id=>setFinanceForm({...financeForm, attachments:financeForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setFinanceForm({...financeForm, newFiles:financeForm.newFiles.filter((_,i)=>i!==idx)})} isUploading={isUploading} uploadProgress={uploadProgress} /></div>
    </div>
  );
}

// ==================== Production Form ====================

export function ProductionForm({
  productionForm,
  setProductionForm,
  productionPartners,
  isUploading,
  uploadProgress,
}: {
  productionForm: ProductionFormState;
  setProductionForm: React.Dispatch<React.SetStateAction<ProductionFormState>>;
  productionPartners: Partner[];
  isUploading: boolean;
  uploadProgress: number;
}) {
  return (
    <div className="space-y-12">
      <div className="grid gap-8 sm:grid-cols-2">
        <Field label="指派制造供应商"><select value={productionForm.partnerId} onChange={e=>setProductionForm({...productionForm, partnerId:e.target.value})} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm"><option value="">请选择合作厂商...</option>{productionPartners.map(p=><option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}</select></Field>
        <Field label="实时生产节点状态"><select value={productionForm.productionStatus} onChange={e=>setProductionForm({...productionForm, productionStatus:e.target.value as ProductionStatus})} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm"><option value="not_started">待生产</option><option value="scheduled">已排产</option><option value="in_progress">生产中</option><option value="ready">已完工</option></select></Field>
        <Field label="指令下达日期"><input type="date" value={productionForm.orderDate} onChange={e => setProductionForm({ ...productionForm, orderDate: e.target.value })} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white data-field focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
        <Field label="合约预期交期"><input type="date" value={productionForm.estimatedDeliveryDate} onChange={e => setProductionForm({ ...productionForm, estimatedDeliveryDate: e.target.value })} className="w-full bg-[#F8FAFC] dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white data-field focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
      </div>
      <div className="pt-6 border-t border-slate-100 dark:border-navy-800">
        <AttachmentEditor
          title="生产计划单 / PO 文件"
          attachments={productionForm.photos}
          newFiles={productionForm.newPhotos}
          onFilesSelected={fs => setProductionForm({...productionForm, newPhotos: [...productionForm.newPhotos, ...fs.map(f=>({file:f,remark:''}))]})}
          onRemoveExisting={id => setProductionForm({...productionForm, photos: productionForm.photos.filter(a => a.id !== id)})}
          onRemovePending={idx => setProductionForm({...productionForm, newPhotos: productionForm.newPhotos.filter((_, i) => i !== idx)})}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        />
      </div>
    </div>
  );
}

// ==================== Production Log Form ====================

export function ProductionLogForm({
  productionLogForm,
  setProductionLogForm,
  isUploading,
  uploadProgress,
}: {
  productionLogForm: ProductionLogFormState;
  setProductionLogForm: React.Dispatch<React.SetStateAction<ProductionLogFormState>>;
  isUploading: boolean;
  uploadProgress: number;
}) {
  return (
    <div className="space-y-10">
      <div className="p-8 bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-200 dark:border-navy-800 flex gap-6 shadow-inner">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-navy dark:bg-tertiary-sage text-white shadow-lg"><Clock size={28} /></div>
        <div className="space-y-2 pt-1"><h5 className="text-[16px] font-bold text-primary-navy dark:text-white tracking-tight">记录生产进度更新</h5><p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">实时同步制造链路数据，确保持续的可追溯性。</p></div>
      </div>
      <div className="grid gap-10 sm:grid-cols-2">
        <Field label="生产记录日期"><input type="date" value={productionLogForm.logDate} onChange={e => setProductionLogForm({ ...productionLogForm, logDate: e.target.value })} className="w-full bg-white dark:bg-navy-950 py-2.5 px-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
      </div>
      <Field label="进度情况详细描述 *"><textarea rows={8} value={productionLogForm.content} onChange={e => setProductionLogForm({ ...productionLogForm, content: e.target.value })} placeholder="例如：车间 B 报线，主控板已完成 80% 贴片工作，预计明天下午进入组装环节..." className="w-full bg-slate-50 dark:bg-navy-950 p-5 rounded-lg text-sm font-bold text-primary-navy dark:text-white leading-relaxed focus:outline-none border border-slate-200 dark:border-navy-800 shadow-inner" /></Field>
      <div className="pt-8 border-t border-slate-100 dark:border-navy-800"><AttachmentEditor title="现场照片或测试报告附件" attachments={productionLogForm.attachments} newFiles={productionLogForm.newFiles} onFilesSelected={fs=>setProductionLogForm({...productionLogForm, newFiles:[...productionLogForm.newFiles,...fs.map(f=>({file:f,remark:''}))]})} onRemoveExisting={id=>setProductionLogForm({...productionLogForm, attachments:productionLogForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setProductionLogForm({...productionLogForm, newFiles:productionLogForm.newFiles.filter((_,i)=>i!==idx)})} isUploading={isUploading} uploadProgress={uploadProgress} /></div>
    </div>
  );
}

// ==================== Customs Form ====================

export function CustomsForm({
  customsForm,
  setCustomsForm,
  isUploading,
  uploadProgress,
}: {
  customsForm: CustomsFormState;
  setCustomsForm: React.Dispatch<React.SetStateAction<CustomsFormState>>;
  isUploading: boolean;
  uploadProgress: number;
}) {
  return (
    <div className="space-y-10">
      <div className="p-8 bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-200 dark:border-navy-800 flex gap-6 shadow-inner">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-navy dark:bg-tertiary-sage text-white shadow-lg"><FileCheck size={28} /></div>
        <div className="space-y-2 pt-1"><h5 className="text-[16px] font-bold text-primary-navy dark:text-white tracking-tight">报关与清关信息同步</h5><p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">更新海关申报单据与状态，确保出口合规性与时效追踪。</p></div>
      </div>
      <div className="grid gap-8 sm:grid-cols-2">
        <Field label="报关当前状态">
          <select value={customsForm.status} onChange={e=>setCustomsForm({...customsForm, status:e.target.value as any})} className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm cursor-pointer">
            <option value="not_started">未开始 (Pending)</option>
            <option value="preparing">资料准备中 (Preparing)</option>
            <option value="submitted">已提交申报 (Submitted)</option>
            <option value="inspected">海关查验中 (Inspected)</option>
            <option value="released">已放行/结关 (Released)</option>
          </select>
        </Field>
        <Field label="合作报关行"><input value={customsForm.brokerName} onChange={e=>setCustomsForm({...customsForm, brokerName:e.target.value})} placeholder="输入报关行全称..." className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm data-field" /></Field>
        <Field label="正式报关单号"><input value={customsForm.declarationNo} onChange={e=>setCustomsForm({...customsForm, declarationNo:e.target.value})} placeholder="输入 18 位海关报关单号..." className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm data-field" /></Field>
        <Field label="贸易方式分类"><select value={customsForm.tradeMode} onChange={e=>setCustomsForm({...customsForm, tradeMode:e.target.value})} className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm cursor-pointer"><option value="一般贸易">一般贸易 (0110)</option><option value="进料加工">进料加工 (0615)</option><option value="来料加工">来料加工 (0214)</option><option value="其他">其他类型</option></select></Field>
        <Field label="海关申报日期"><input type="date" value={customsForm.declarationDate} onChange={e=>setCustomsForm({...customsForm, declarationDate:e.target.value})} className="w-full bg-white dark:bg-navy-950 py-2.5 px-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
        <Field label="海关放行日期"><input type="date" value={customsForm.releaseDate} onChange={e=>setCustomsForm({...customsForm, releaseDate:e.target.value})} className="w-full bg-white dark:bg-navy-950 py-2.5 px-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
      </div>
      <div className="pt-8 border-t border-slate-100 dark:border-navy-800"><AttachmentEditor title="正式报关文件存档 (发票/装箱单/报关单扫描件)" attachments={customsForm.attachments} newFiles={customsForm.newFiles} onFilesSelected={fs=>setCustomsForm({...customsForm, newFiles:[...customsForm.newFiles,...fs.map(f=>({file:f,remark:''}))]})} onRemoveExisting={id=>setCustomsForm({...customsForm, attachments:customsForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setCustomsForm({...customsForm, newFiles:customsForm.newFiles.filter((_,i)=>i!==idx)})} isUploading={isUploading} uploadProgress={uploadProgress} /></div>
    </div>
  );
}

// ==================== Logistics Form ====================

export function LogisticsForm({
  logisticsForm,
  setLogisticsForm,
  forwarderPartners,
  isUploading,
  uploadProgress,
}: {
  logisticsForm: LogisticsFormState;
  setLogisticsForm: React.Dispatch<React.SetStateAction<LogisticsFormState>>;
  forwarderPartners: Partner[];
  isUploading: boolean;
  uploadProgress: number;
}) {
  const [forwarderQuery, setForwarderQuery] = useState('');
  const selectedForwarder = forwarderPartners.find((p) => String(p.id) === logisticsForm.freightForwarderPartnerId) || null;
  const filteredForwarders = useMemo(() => {
    const q = forwarderQuery.trim().toLowerCase();
    if (!q) return forwarderPartners;
    return forwarderPartners.filter((p) => [p.name, p.country, p.contact, p.contact_person].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [forwarderPartners, forwarderQuery]);

  return (
    <div className="space-y-10">
      <div className="flex gap-4 p-1.5 bg-slate-100 dark:bg-navy-950 rounded-lg">
        <button type="button" onClick={()=>setLogisticsForm({...logisticsForm, segmentType:'domestic'})} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${logisticsForm.segmentType==='domestic'?'bg-white dark:bg-navy-800 text-primary-navy dark:text-white shadow-md':'text-slate-500 dark:text-slate-400 hover:text-primary-navy dark:hover:text-white'}`}>国内运输轨迹</button>
        <button type="button" onClick={()=>setLogisticsForm({...logisticsForm, segmentType:'international'})} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${logisticsForm.segmentType==='international'?'bg-white dark:bg-navy-800 text-primary-navy dark:text-white shadow-md':'text-slate-500 dark:text-slate-400 hover:text-primary-navy dark:hover:text-white'}`}>国际/主线轨迹</button>
      </div>
      <div className="grid gap-10 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="货运代理 (Freight Forwarder)">
          <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-navy-800 px-3.5 py-2.5">
              <Search size={14} className="text-slate-300 dark:text-slate-600" />
              <input
                value={forwarderQuery}
                onChange={e => setForwarderQuery(e.target.value)}
                placeholder={selectedForwarder ? selectedForwarder.name : logisticsForm.freightForwarder || '搜索并选择货代合作伙伴...'}
                className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-primary-navy dark:text-white outline-none placeholder:text-slate-400"
              />
              {(selectedForwarder || logisticsForm.freightForwarder) && (
                <button type="button" onClick={() => { setLogisticsForm({ ...logisticsForm, freightForwarderPartnerId: '', freightForwarder: '' }); setForwarderQuery(''); }} className="rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-error dark:hover:bg-navy-800">
                  <X size={14} />
                </button>
              )}
            </div>
            {selectedForwarder && (
              <div className="flex items-center justify-between gap-3 bg-emerald-50/60 dark:bg-emerald-900/10 px-3.5 py-2.5 text-xs">
                <div className="min-w-0">
                  <div className="font-black text-primary-navy dark:text-white truncate">已选择：{selectedForwarder.name}</div>
                  <div className="mt-0.5 font-bold text-slate-400 truncate">{[selectedForwarder.country, selectedForwarder.contact_person || selectedForwarder.contact].filter(Boolean).join(' · ') || '货代合作伙伴'}</div>
                </div>
                <Check size={14} className="shrink-0 text-emerald-500" />
              </div>
            )}
            <div className="max-h-44 overflow-y-auto custom-scrollbar">
              {filteredForwarders.length > 0 ? filteredForwarders.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setLogisticsForm({ ...logisticsForm, freightForwarderPartnerId: String(p.id), freightForwarder: p.name }); setForwarderQuery(''); }}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-navy-900 ${String(p.id) === logisticsForm.freightForwarderPartnerId ? 'bg-slate-50 dark:bg-navy-900' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-black text-primary-navy dark:text-white">{p.name}</div>
                    <div className="mt-0.5 truncate text-[11px] font-bold text-slate-400">{[p.country, p.contact_person, p.contact].filter(Boolean).join(' · ') || '未补充国家/联系人'}</div>
                  </div>
                  {String(p.id) === logisticsForm.freightForwarderPartnerId && <Check size={14} className="shrink-0 text-emerald-500" />}
                </button>
              )) : (
                <div className="px-3.5 py-5 text-center text-xs font-bold text-slate-400">暂无匹配货代，可先在合作伙伴中添加 forwarder 类型伙伴</div>
              )}
            </div>
            {!selectedForwarder && logisticsForm.freightForwarder && (
              <div className="border-t border-amber-100 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-900/10 px-3.5 py-2 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                当前为历史文本记录：{logisticsForm.freightForwarder}。保存时将继续保留文本；选择上方伙伴后会转为结构化关联。
              </div>
            )}
            <div className="border-t border-slate-100 dark:border-navy-800 px-3.5 py-2">
              <input value={logisticsForm.freightForwarder} onChange={e=>setLogisticsForm({...logisticsForm, freightForwarder:e.target.value, freightForwarderPartnerId:''})} placeholder="或输入历史文本货代名称..." className="w-full bg-transparent text-[12px] font-bold text-slate-500 dark:text-slate-400 focus:outline-none" />
            </div>
          </div>
        </Field></div>
        <Field label="实际承运商 (Actual Carrier)"><input required value={logisticsForm.carrier} onChange={e=>setLogisticsForm({...logisticsForm, carrier:e.target.value})} placeholder="例如: 顺丰 / 马士基 / DHL..." className="w-full bg-white dark:bg-navy-950 py-2.5 px-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
        <Field label="主运单/提单识别码 *"><input required value={logisticsForm.trackingNo} onChange={e=>setLogisticsForm({...logisticsForm, trackingNo:e.target.value})} placeholder="请输入单号..." className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm data-field" /></Field>
        <Field label={logisticsForm.segmentType === 'domestic' ? '实际发货日期' : '预计离港日期'}><input type="date" value={logisticsForm.shippingDate} onChange={e=>setLogisticsForm({...logisticsForm, shippingDate:e.target.value})} className="w-full bg-white dark:bg-navy-950 py-2.5 px-3.5 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm" /></Field>
        <Field label="当前物流节点状态"><select value={logisticsForm.status} onChange={e=>setLogisticsForm({...logisticsForm, status:e.target.value as LogisticsStatus})} className="w-full bg-white dark:bg-navy-950 p-3.5 text-[14px] font-bold text-primary-navy dark:text-white appearance-none focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm cursor-pointer"><option value="preparing">01. 待起运 (Pre-shipment)</option><option value="shipped">02. 运输中 (In-transit)</option><option value="arrived">03. 已妥投 (Delivered)</option></select></Field>
        {logisticsForm.segmentType === 'domestic' && <div className="sm:col-span-2"><Field label="最终收货/卸货地址 *"><textarea rows={3} value={logisticsForm.recipientAddress} onChange={e=>setLogisticsForm({...logisticsForm, recipientAddress:e.target.value})} className="w-full bg-white dark:bg-navy-950 p-4 text-[14px] font-bold text-primary-navy dark:text-white focus:outline-none rounded-lg border border-slate-200 dark:border-navy-800 shadow-sm leading-relaxed" /></Field></div>}
      </div>
      <div className="pt-8 border-t border-slate-100 dark:border-navy-800"><AttachmentEditor title="运单扫描件或签收单存档" attachments={logisticsForm.attachments} newFiles={logisticsForm.newFiles} onFilesSelected={fs=>setLogisticsForm({...logisticsForm, newFiles:[...logisticsForm.newFiles,...fs.map(f=>({file:f,remark:''}))]})} onRemoveExisting={id=>setLogisticsForm({...logisticsForm, attachments:logisticsForm.attachments.filter(a=>a.id!==id)})} onRemovePending={idx=>setLogisticsForm({...logisticsForm, newFiles:logisticsForm.newFiles.filter((_,i)=>i!==idx)})} isUploading={isUploading} uploadProgress={uploadProgress} /></div>
    </div>
  );
}

// ==================== Packing Form ====================

export function PackingForm({
  packingForm,
  setPackingForm,
  onUploadPhoto,
}: {
  packingForm: PackingFormState;
  setPackingForm: React.Dispatch<React.SetStateAction<PackingFormState>>;
  onUploadPhoto: (idx: number, file: File) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-5">
        <div className="space-y-1"><h4 className="text-[16px] font-extrabold text-primary-navy dark:text-white tracking-tight">装箱明细数据维护</h4><p className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-tight">维护物理包装参数，支持一单多规格录入。</p></div>
        <button type="button" onClick={() => setPackingForm({ items: [...packingForm.items, { clientKey: Math.random().toString(36).slice(2), packageCount: '1', packageSize: '', grossWeight: '', netWeight: '' }] })} className="btn-primary text-xs px-6 py-2.5 rounded-lg">+ 新增包装组</button>
      </div>
      <div className="space-y-5">
        {packingForm.items.length === 0 && <div className="py-20 text-center border border-dashed border-slate-200 dark:border-navy-800 rounded-lg text-slate-400 font-bold tracking-tight">尚未添加任何装箱组</div>}
        {packingForm.items.map((item, idx) => (
          <div key={item.clientKey} className="relative p-6 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-navy-800 group shadow-inner">
            <button type="button" onClick={() => setPackingForm({ items: packingForm.items.filter((_, i) => i !== idx) })} className="absolute -right-2.5 -top-2.5 h-8 w-8 rounded-full bg-error text-white shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-30 hover:scale-110"><Trash size={14} /></button>
            <div className="grid gap-6 sm:grid-cols-4 items-end">
              <div className="sm:col-span-3">
                <div className="grid gap-4 grid-cols-4 font-bold">
                  <Field label="件数 (箱)"><input type="number" value={item.packageCount} onChange={e => { const next = [...packingForm.items]; next[idx].packageCount = e.target.value; setPackingForm({ items: next }); }} className="w-full bg-white dark:bg-navy-950 p-2.5 rounded-lg border border-slate-200 dark:border-navy-800 outline-none data-field text-primary-navy dark:text-white" /></Field>
                  <Field label="尺寸 (L*W*H)"><input value={item.packageSize} onChange={e => { const next = [...packingForm.items]; next[idx].packageSize = e.target.value; setPackingForm({ items: next }); }} placeholder="120x100x80" className="w-full bg-white dark:bg-navy-950 p-2.5 rounded-lg border border-slate-200 dark:border-navy-800 outline-none data-field text-primary-navy dark:text-white" /></Field>
                  <Field label="毛重 (kg)"><input value={item.grossWeight} onChange={e => { const next = [...packingForm.items]; next[idx].grossWeight = e.target.value; setPackingForm({ items: next }); }} className="w-full bg-white dark:bg-navy-950 p-2.5 rounded-lg border border-slate-200 dark:border-navy-800 outline-none data-field text-primary-navy dark:text-white" /></Field>
                  <Field label="净重 (kg)"><input value={item.netWeight} onChange={e => { const next = [...packingForm.items]; next[idx].netWeight = e.target.value; setPackingForm({ items: next }); }} className="w-full bg-white dark:bg-navy-950 p-2.5 rounded-lg border border-slate-200 dark:border-navy-800 outline-none data-field text-primary-navy dark:text-white" /></Field>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <label className="h-14 w-14 rounded-lg border-2 border-dashed border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 flex items-center justify-center cursor-pointer hover:border-primary-navy dark:hover:border-tertiary-sage hover:bg-slate-50 transition-all overflow-hidden shadow-sm">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <Upload size={20} className="text-slate-200 dark:text-navy-800" />}
                  <input type="file" className="hidden" onChange={e => e.target.files?.[0] && onUploadPhoto(idx, e.target.files[0])} />
                </label>
                <span className="text-xs font-extrabold text-slate-400 dark:text-slate-500 tracking-tight">箱体实拍</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== AI Analysis Content ====================

export function AIAnalysisContent({
  analyzing,
  aiResult,
}: {
  analyzing: boolean;
  aiResult: AIAnalysisResult | null;
}) {
  if (analyzing) {
    return (
      <div className="text-center py-48 flex flex-col items-center animate-in fade-in">
        <div className="h-16 w-16 border-[8px] border-slate-100 dark:border-navy-800 border-t-primary-navy dark:border-t-tertiary-sage rounded-full animate-spin mb-10 shadow-md" />
        <span className="text-xs font-extrabold text-primary-navy dark:text-tertiary-sage tracking-tight animate-pulse">核心引擎诊断中...</span>
      </div>
    );
  }

  if (!aiResult) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-1000">
      <div className="relative flex items-center justify-between overflow-hidden rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-navy-800 dark:bg-navy-900">
        <div>
          <h4 className="mb-3 text-xs font-extrabold tracking-tight text-slate-400">Consolidated Risk Score</h4>
          <p className="text-xl font-bold tracking-tight text-primary-navy dark:text-white">健康评估分值</p>
        </div>
        <div className={`pr-2 text-[96px] font-extrabold italic leading-none tracking-tighter data-field ${aiResult.score>=80?'text-success':aiResult.score>=60?'text-warning':'text-error'}`}>{aiResult.score}</div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-[20px] font-bold leading-snug tracking-tight text-primary-navy shadow-sm dark:border-navy-800 dark:bg-navy-950/50 dark:text-white">“{aiResult.summary}”</div>
      <section className="space-y-5 px-2">
        <div className="flex items-center gap-3 px-2"><div className="h-4 w-1 rounded-full bg-error" /><h5 className="text-[14px] font-extrabold tracking-tight text-primary-navy dark:text-white">识别到的关键异常与偏差</h5></div>
        <div className="space-y-4">
          {aiResult.risks.map((r, i) => <div key={i} className="rounded-lg border border-red-100 bg-white p-6 text-[16px] font-bold leading-relaxed text-slate-700 shadow-sm transition-all hover:border-red-200 dark:border-red-900/30 dark:bg-navy-900 dark:text-slate-300">“{r.content}”</div>)}
        </div>
      </section>
    </div>
  );
}
