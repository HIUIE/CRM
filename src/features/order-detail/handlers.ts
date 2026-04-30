import React from 'react';
import { apiFetch, apiUpload, apiUploadSimple, getErrorMessage } from '../../lib/api';
import type {
  OrderFormState,
  FinanceFormState,
  ProductionFormState,
  ProductionLogFormState,
  CustomsFormState,
  LogisticsFormState,
  PackingFormState,
  PackingRecord,
  OrderInfo,
  CustomerInfo,
  ProductionPlan,
  OrderDetailResponse,
  AttachmentMeta,
  ProductionStatus,
  InspectionStatus,
} from './types';

// ==================== Order ====================

export async function handleSaveOrder(
  e: React.FormEvent,
  deps: {
    orderForm: OrderFormState;
    deletedItemIds: number[];
    order: OrderInfo | null | undefined;
    setSaving: (v: boolean) => void;
    showToast: (msg: string) => void;
    closeDrawer: () => void;
    loadDetail: (opts?: { showLoading?: boolean }) => Promise<void>;
    setDrawerError: (msg: string) => void;
  }
) {
  const { orderForm, deletedItemIds, order, setSaving, showToast, closeDrawer, loadDetail, setDrawerError } = deps;
  e.preventDefault(); setSaving(true);
  try {
    const payload = { ...orderForm, customerId: Number(orderForm.customerId), totalAmount: Number(orderForm.totalAmount), freightAmount: Number(orderForm.freightAmount), miscAmount: Number(orderForm.miscAmount), deletedItemIds };
    await apiFetch(`/api/orders/${order?.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    showToast('同步成功'); closeDrawer();
    void loadDetail({ showLoading: false });
  } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
};

// ==================== Finance ====================

export async function handleSaveFinance(
  e: React.FormEvent,
  deps: {
    financeForm: FinanceFormState;
    order: OrderInfo | null | undefined;
    customer: CustomerInfo | null | undefined;
    setSaving: (v: boolean) => void;
    showToast: (msg: string) => void;
    closeDrawer: () => void;
    loadDetail: (opts?: { showLoading?: boolean }) => Promise<void>;
    setDrawerError: (msg: string) => void;
    setIsUploading: (v: boolean) => void;
    setUploadProgress: (v: number) => void;
  }
) {
  const { financeForm, order, customer, setSaving, showToast, closeDrawer, loadDetail, setDrawerError, setIsUploading, setUploadProgress } = deps;
  e.preventDefault(); setSaving(true);
  try {
    let newAtts: AttachmentMeta[] = [];
    if (financeForm.newFiles.length) {
      setIsUploading(true); setUploadProgress(0);
      const fd = new FormData();
      fd.append('customerId', String(customer?.id));
      fd.append('orderId', String(order?.id));
      financeForm.newFiles.forEach(f => fd.append('files', f.file));
      newAtts = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
      setIsUploading(false);
    }
    const payload = { ...financeForm, orderId: Number(order?.id), amount: Number(financeForm.amount), partnerId: Number(financeForm.partnerId) || null, attachmentIds: [...financeForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
    const url = financeForm.id ? `/api/finance/${financeForm.id}` : `/api/finance`;
    await apiFetch(url, { method: financeForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    showToast('同步成功'); closeDrawer();
    void loadDetail({ showLoading: false });
  } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); setIsUploading(false); } finally { setSaving(false); }
};

// ==================== Production ====================

export async function handleSaveProduction(
  e: React.FormEvent,
  deps: {
    productionForm: ProductionFormState;
    order: OrderInfo | null | undefined;
    customer: CustomerInfo | null | undefined;
    setSaving: (v: boolean) => void;
    showToast: (msg: string) => void;
    closeDrawer: () => void;
    loadDetail: (opts?: { showLoading?: boolean }) => Promise<void>;
    setDrawerError: (msg: string) => void;
    setIsUploading: (v: boolean) => void;
    setUploadProgress: (v: number) => void;
  }
) {
  const { productionForm, order, customer, setSaving, showToast, closeDrawer, loadDetail, setDrawerError, setIsUploading, setUploadProgress } = deps;
  e.preventDefault(); setSaving(true);
  try {
    let newAtts: AttachmentMeta[] = [];
    if (productionForm.newPhotos.length) {
      setIsUploading(true); setUploadProgress(0);
      const fd = new FormData();
      fd.append('customerId', String(customer?.id));
      fd.append('orderId', String(order?.id));
      fd.append('entityType', 'production_photo');
      fd.append('entityId', String(order?.id));
      productionForm.newPhotos.forEach(f => fd.append('files', f.file));
      newAtts = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
      setIsUploading(false);
    }
    const payload = {
      partnerId: productionForm.partnerId ? Number(productionForm.partnerId) : null,
      orderDate: productionForm.orderDate,
      estimatedDeliveryDate: productionForm.estimatedDeliveryDate,
      productionStatus: productionForm.productionStatus,
      inspectionStatus: productionForm.inspectionStatus,
      remark: productionForm.remark,
      orderId: Number(order?.id),
      attachmentIds: [...productionForm.photos.map(a => a.id), ...newAtts.map(a => a.id)],
    };
    const url = productionForm.id ? `/api/orders/production/${productionForm.id}` : `/api/orders/${order?.id}/production`;
    await apiFetch(url, { method: productionForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    showToast('同步成功'); closeDrawer();
    void loadDetail({ showLoading: false });
  } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
};

export async function handleUpdateProductionStatus(
  status: ProductionStatus,
  deps: {
    productionPlan: ProductionPlan | null;
    order: OrderInfo | null | undefined;
    setSaving: (v: boolean) => void;
    showToast: (msg: string) => void;
    loadDetail: (opts?: { showLoading?: boolean }) => Promise<void>;
  }
) {
  const { productionPlan, order, setSaving, showToast, loadDetail } = deps;
  if (!productionPlan) return;
  setSaving(true);
  try {
    const payload = {
      partnerId: productionPlan.partnerId,
      orderDate: productionPlan.orderDate,
      estimatedDeliveryDate: productionPlan.estimatedDeliveryDate,
      productionStatus: status,
      inspectionStatus: productionPlan.inspectionStatus,
      remark: productionPlan.remark,
      orderId: Number(order?.id),
    };
    await apiFetch(`/api/orders/production/${productionPlan.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    showToast('生产状态已更新');
    await loadDetail({ showLoading: false });
  } catch (err) { showToast(getErrorMessage(err)); } finally { setSaving(false); }
};

export async function handleUpdateInspectionStatus(
  status: InspectionStatus,
  deps: {
    productionPlan: ProductionPlan | null;
    order: OrderInfo | null | undefined;
    setSaving: (v: boolean) => void;
    showToast: (msg: string) => void;
    loadDetail: (opts?: { showLoading?: boolean }) => Promise<void>;
  }
) {
  const { productionPlan, order, setSaving, showToast, loadDetail } = deps;
  if (!productionPlan) return;
  setSaving(true);
  try {
    const payload = {
      partnerId: productionPlan.partnerId,
      orderDate: productionPlan.orderDate,
      estimatedDeliveryDate: productionPlan.estimatedDeliveryDate,
      productionStatus: productionPlan.productionStatus,
      inspectionStatus: status,
      remark: productionPlan.remark,
      orderId: Number(order?.id),
    };
    await apiFetch(`/api/orders/production/${productionPlan.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    showToast('质检状态已更新');
    await loadDetail({ showLoading: false });
  } catch (err) { showToast(getErrorMessage(err)); } finally { setSaving(false); }
};

// ==================== Production Log ====================

export async function handleSaveProductionLog(
  e: React.FormEvent,
  deps: {
    productionLogForm: ProductionLogFormState;
    order: OrderInfo | null | undefined;
    customer: CustomerInfo | null | undefined;
    productionPlan: ProductionPlan | null;
    setSaving: (v: boolean) => void;
    showToast: (msg: string) => void;
    closeDrawer: () => void;
    loadDetail: (opts?: { showLoading?: boolean }) => Promise<void>;
    setDrawerError: (msg: string) => void;
    setIsUploading: (v: boolean) => void;
    setUploadProgress: (v: number) => void;
  }
) {
  const { productionLogForm, order, customer, productionPlan, setSaving, showToast, closeDrawer, loadDetail, setDrawerError, setIsUploading, setUploadProgress } = deps;
  e.preventDefault(); if (!productionLogForm.content.trim()) return; setSaving(true);
  try {
    let newAtts: AttachmentMeta[] = [];
    if (productionLogForm.newFiles.length) {
      setIsUploading(true); setUploadProgress(0);
      const fd = new FormData();
      fd.append('customerId', String(customer?.id));
      fd.append('orderId', String(order?.id));
      productionLogForm.newFiles.forEach(f => fd.append('files', f.file));
      newAtts = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
      setIsUploading(false);
    }
    const payload = { ...productionLogForm, attachmentIds: [...productionLogForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
    await apiFetch(`/api/orders/production/${productionPlan?.id}/logs`, { method: 'POST', body: JSON.stringify(payload) });
    showToast('进度已记录'); closeDrawer();
    void loadDetail({ showLoading: false });
  } catch (err) { setDrawerError(getErrorMessage(err, '提交失败')); setIsUploading(false); } finally { setSaving(false); }
};

// ==================== Customs ====================

export async function handleSaveCustoms(
  e: React.FormEvent,
  deps: {
    customsForm: CustomsFormState;
    order: OrderInfo | null | undefined;
    customer: CustomerInfo | null | undefined;
    setSaving: (v: boolean) => void;
    showToast: (msg: string) => void;
    closeDrawer: () => void;
    loadDetail: (opts?: { showLoading?: boolean }) => Promise<void>;
    setDrawerError: (msg: string) => void;
    setIsUploading: (v: boolean) => void;
    setUploadProgress: (v: number) => void;
  }
) {
  const { customsForm, order, customer, setSaving, showToast, closeDrawer, loadDetail, setDrawerError, setIsUploading, setUploadProgress } = deps;
  e.preventDefault(); setSaving(true);
  try {
    let newAtts: AttachmentMeta[] = [];
    if (customsForm.newFiles.length) {
      setIsUploading(true); setUploadProgress(0);
      const fd = new FormData();
      fd.append('customerId', String(customer?.id));
      fd.append('orderId', String(order?.id));
      customsForm.newFiles.forEach(f => fd.append('files', f.file));
      newAtts = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
      setIsUploading(false);
    }
    const payload = { ...customsForm, orderId: Number(order?.id), attachmentIds: [...customsForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
    const url = customsForm.id ? `/api/customs/${customsForm.id}` : `/api/orders/${order?.id}/customs`;
    await apiFetch(url, { method: customsForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    showToast('同步成功'); closeDrawer();
    void loadDetail({ showLoading: false });
  } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); setIsUploading(false); } finally { setSaving(false); }
};

// ==================== Logistics ====================

export async function handleSaveLogistics(
  e: React.FormEvent,
  deps: {
    logisticsForm: LogisticsFormState;
    order: OrderInfo | null | undefined;
    customer: CustomerInfo | null | undefined;
    setSaving: (v: boolean) => void;
    showToast: (msg: string) => void;
    closeDrawer: () => void;
    loadDetail: (opts?: { showLoading?: boolean }) => Promise<void>;
    setDrawerError: (msg: string) => void;
    setIsUploading: (v: boolean) => void;
    setUploadProgress: (v: number) => void;
  }
) {
  const { logisticsForm, order, customer, setSaving, showToast, closeDrawer, loadDetail, setDrawerError, setIsUploading, setUploadProgress } = deps;
  e.preventDefault(); setSaving(true);
  try {
    let newAtts: AttachmentMeta[] = [];
    if (logisticsForm.newFiles.length) {
      setIsUploading(true); setUploadProgress(0);
      const fd = new FormData();
      fd.append('customerId', String(customer?.id));
      fd.append('orderId', String(order?.id));
      logisticsForm.newFiles.forEach(f => fd.append('files', f.file));
      newAtts = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
      setIsUploading(false);
    }
    const payload = { ...logisticsForm, orderId: Number(order?.id), freightForwarder: logisticsForm.freightForwarder, freightForwarderPartnerId: logisticsForm.freightForwarderPartnerId ? Number(logisticsForm.freightForwarderPartnerId) : null, attachmentIds: [...logisticsForm.attachments.map(a => a.id), ...newAtts.map(a => a.id)] };
    const url = logisticsForm.id ? `/api/logistics/${logisticsForm.id}` : `/api/logistics`;
    await apiFetch(url, { method: logisticsForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    showToast('同步成功'); closeDrawer();
    void loadDetail({ showLoading: false });
  } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); setIsUploading(false); } finally { setSaving(false); }
};

// ==================== Packing ====================

export async function handleSavePacking(
  e: React.FormEvent,
  deps: {
    packingForm: PackingFormState;
    order: OrderInfo | null | undefined;
    setSaving: (v: boolean) => void;
    showToast: (msg: string) => void;
    closeDrawer: () => void;
    loadDetail: (opts?: { showLoading?: boolean }) => Promise<void>;
    setDrawerError: (msg: string) => void;
  }
) {
  const { packingForm, order, setSaving, showToast, closeDrawer, loadDetail, setDrawerError } = deps;
  e.preventDefault(); setSaving(true);
  try {
    await apiFetch(`/api/orders/${order?.id}/packing`, { method: 'PATCH', body: JSON.stringify(packingForm) });
    showToast('装箱数据已更新'); closeDrawer();
    void loadDetail({ showLoading: false });
  } catch (err) { setDrawerError(getErrorMessage(err, '保存失败')); } finally { setSaving(false); }
};

export async function handleUploadPackingPhoto(
  idx: number,
  file: File,
  deps: {
    packingForm: PackingFormState;
    setPackingForm: (v: PackingFormState) => void;
    order: OrderInfo | null | undefined;
    customer: CustomerInfo | null | undefined;
    setSaving: (v: boolean) => void;
    setDrawerError: (msg: string) => void;
    setIsUploading: (v: boolean) => void;
    setUploadProgress: (v: number) => void;
  }
) {
  const { packingForm, setPackingForm, order, customer, setSaving, setDrawerError, setIsUploading, setUploadProgress } = deps;
  setSaving(true); setIsUploading(true); setUploadProgress(0);
  try {
    const fd = new FormData();
    fd.append('customerId', String(customer?.id));
    fd.append('orderId', String(order?.id));
    fd.append('files', file);
    const [att] = await apiUpload<AttachmentMeta[]>('/api/attachments', fd, setUploadProgress);
    const next = [...packingForm.items];
    next[idx].attachmentId = att.id;
    next[idx].imageUrl = att.url;
    setPackingForm({ items: next });
    setIsUploading(false);
  } catch (err) { setDrawerError('图片上传失败'); setIsUploading(false); }
  finally { setSaving(false); }
};

// ==================== Attachment / Document ====================

export async function handleDeleteAttachment(
  id: number,
  deps: {
    showToast: (msg: string) => void;
    loadDetail: (opts?: { showLoading?: boolean }) => Promise<void>;
  }
) {
  const { showToast, loadDetail } = deps;
  if (!window.confirm('确认彻底删除此附件？')) return;
  try {
    await apiFetch(`/api/attachments/${id}`, { method: 'DELETE' });
    showToast('文件已移除');
    await loadDetail({ showLoading: false });
  } catch (err) { showToast(getErrorMessage(err, '删除失败')); }
};

export async function handleUploadOrderDocument(
  files: FileList | null,
  deps: {
    order: OrderInfo | null | undefined;
    customer: CustomerInfo | null | undefined;
    setUploadingDoc: (v: boolean) => void;
    showToast: (msg: string) => void;
    loadDetail: (opts?: { showLoading?: boolean }) => Promise<void>;
  }
) {
  const { order, customer, setUploadingDoc, showToast, loadDetail } = deps;
  if (!files?.length || !order) return;
  setUploadingDoc(true);
  try {
    const fd = new FormData();
    fd.append('customerId', String(customer?.id));
    fd.append('orderId', String(order.id));
    fd.append('entityType', 'order_document');
    fd.append('entityId', String(order.id));
    Array.from(files).forEach(f => fd.append('files', f));
    await apiUploadSimple('/api/attachments', fd);
    showToast('凭证已上传');
    await loadDetail({ showLoading: false });
  } catch (err) {
    showToast(getErrorMessage(err, '上传失败'));
  } finally {
    setUploadingDoc(false);
  }
};

// ==================== Follow Up ====================

export async function handleSubmitFollowUp(
  deps: {
    followUpInput: string;
    order: OrderInfo | null | undefined;
    user?: { name?: string; role?: string } | null;
    setDetail: (val: React.SetStateAction<OrderDetailResponse | null>) => void;
    setFollowUpInput: (v: string) => void;
    setSaving: (v: boolean) => void;
    showToast: (msg: string) => void;
    setDrawerError: (msg: string) => void;
  }
) {
  const { followUpInput, order, user, setDetail, setFollowUpInput, setSaving, showToast, setDrawerError } = deps;
  if (!followUpInput.trim() || !order) return;
  setSaving(true);
  try {
    const saved = await apiFetch<any>(`/api/orders/${order.id}/follow-ups`, {
      method: 'POST',
      body: JSON.stringify({ content: followUpInput.trim() }),
    });
    const newEntry = saved?.id ? saved : { id: Date.now(), content: followUpInput.trim(), createdByName: user?.name || '当前用户', createdAt: new Date().toISOString() };
    setDetail(prev => prev ? { ...prev, followUps: [newEntry, ...(prev.followUps || [])] } : prev);
    setFollowUpInput('');
    showToast('跟进记录已保存');
  } catch (err) {
    setDrawerError(getErrorMessage(err, '保存失败'));
  } finally {
    setSaving(false);
  }
};

// ==================== Delete Order ====================

export async function handleDeleteOrder(
  deps: {
    order: OrderInfo | null | undefined;
    setIsDeleting: (v: boolean) => void;
    setIsDeleteModalOpen: (v: boolean) => void;
    showToast: (msg: string) => void;
    navigate: (path: string) => void;
  }
) {
  const { order, setIsDeleting, setIsDeleteModalOpen, showToast, navigate } = deps;
  if (!order) return;
  setIsDeleting(true);
  try {
    await apiFetch(`/api/orders/${order.id}`, { method: 'DELETE' });
    showToast('订单已永久删除');
    setIsDeleteModalOpen(false);
    navigate('/orders');
  } catch (err) { showToast(getErrorMessage(err, '删除失败')); }
  finally { setIsDeleting(false); }
};

// ==================== Export PDF ====================

export async function handleExportPdf(
  deps: {
    printContentRef: React.RefObject<HTMLDivElement | null>;
    order: OrderInfo | null | undefined;
    showToast: (msg: string) => void;
  }
) {
  const { printContentRef, order, showToast } = deps;
  if (!printContentRef.current || !order) return;
  try {
    const { exportElementToPdf } = await import('../../lib/pdfExport');
    await exportElementToPdf(printContentRef.current, `${order.display_id}-REPORT`);
  } catch { showToast('PDF 生成失败'); }
};
