export type SectionKey = 'basic' | 'todos' | 'items' | 'production' | 'finance' | 'customs' | 'logistics';
export type OrderStatus = 'draft' | 'production' | 'customs' | 'shipping' | 'completed';
export type FinanceType = 'receipt' | 'payment';
export type FinanceStatus = 'pending' | 'completed';
export type FinanceCategory = 'deposit' | 'balance' | 'goods' | 'freight' | 'customs' | 'other';
export type LogisticsStatus = 'preparing' | 'shipped' | 'arrived';
export type LogisticsSegment = 'domestic' | 'international';
export type CustomsStatus = 'not_started' | 'preparing' | 'submitted' | 'inspected' | 'released';
export type PartnerType = 'factory' | 'forwarder' | 'customs_broker' | 'other';
export type ProductionStatus = 'not_started' | 'scheduled' | 'in_progress' | 'ready';
export type InspectionStatus = 'pending' | 'passed' | 'failed';

export type MiscFee = { label: string; amount: number };

export type ReceiptItem = {
  amount: number;
  currency: 'USD' | 'CNY';
  bankFees: number;
  platformFees: number;
  exchangeRate: number;
};

export type ProfitData = {
  receipts: ReceiptItem[];
  invoiceAmount: number;
  refundRate: number;
  otherIncomeCny: number;
  factoryCostCny: number;
  domesticFees: number;
  freightValue: number;
  freightCurrency: 'CNY' | 'USD';
  customsMisc: number;
  miscFees: MiscFee[];
};

export type AttachmentMeta = {
  id: number;
  fileName: string;
  url: string;
  fileSize?: number | null;
  mimeType?: string | null;
  createdAt?: string;
  remark?: string;
};

export type Partner = {
  id: number;
  name: string;
  partner_type: PartnerType;
  country?: string | null;
  contact?: string | null;
  contact_person?: string | null;
  payment_terms?: string | null;
  remark?: string | null;
};

export type OrderInfo = {
  id: number;
  display_id: string;
  customer_id: number;
  status: OrderStatus;
  details?: string | null;
  quick_notes?: string | null;
  product_summary?: string | null;
  total_amount: number;
  deliveryDate?: string | null;
  keyMilestone?: string | null;
  freightAmount?: number;
  miscAmount?: number;
  created_at: string;
  createdByName?: string | null;
  alibaba_order_no?: string | null;
};

export type CustomerInfo = {
  id: number;
  display_id: string;
  name: string;
  country?: string | null;
  contact?: string | null;
  logisticsPreference?: string | null;
  paymentTerms?: string | null;
};

export type OrderItem = {
  id: number;
  product_name: string;
  specification?: string | null;
  hs_code?: string | null;
  hsCode?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  subtotal: number;
  image_url?: string | null;
  imageUrl?: string | null;
};

export type PackingRecord = {
  clientKey?: string;
  id?: number;
  packageCount: string;
  packageSize: string;
  grossWeight: string;
  netWeight: string;
  attachmentId?: number | null;
  imageUrl?: string | null;
};

export type DocumentSlot = {
  key: string;
  docType: string;
  label: string;
  name: string;
  group: string;
  pattern: RegExp;
};

export type FinanceRecord = {
  id: number;
  type: FinanceType;
  recordCategory?: string | null;
  amount: number;
  currency: string;
  status: FinanceStatus;
  target?: string | null;
  remark?: string | null;
  partnerId?: number | null;
  partnerName?: string | null;
  createdAt?: string | null;
  attachments?: AttachmentMeta[];
  attachmentCount?: number;
  createdByName?: string | null;
};

export type ProductionLog = {
  id: number;
  planId: number;
  content: string;
  logDate?: string | null;
  createdByName: string;
  createdAt: string;
  attachments?: AttachmentMeta[];
};

export type ProductionPlan = {
  id: number;
  partnerId?: number | null;
  partnerName?: string | null;
  partnerType?: string | null;
  partnerCountry?: string | null;
  partnerContact?: string | null;
  orderDate?: string | null;
  estimatedDeliveryDate?: string | null;
  productionStatus: ProductionStatus;
  inspectionStatus: InspectionStatus;
  remark?: string | null;
  updatedAt?: string | null;
  createdByName?: string | null;
  photos?: AttachmentMeta[];
  logs?: ProductionLog[];
};

export type LogisticsRecord = {
  id: number;
  segmentType: LogisticsSegment;
  freightForwarder?: string | null;
  freightForwarderPartnerId?: number | null;
  freightForwarderPartnerName?: string | null;
  freightForwarderPartnerType?: PartnerType | null;
  freightForwarderPartnerCountry?: string | null;
  freightForwarderPartnerContact?: string | null;
  carrier: string;
  trackingNo: string;
  status: LogisticsStatus;
  shippingDate: string;
  packingDetails?: string | null;
  packageCount?: number | null;
  volumeCbm?: number | null;
  grossWeightKg?: number | null;
  incoterm?: string | null;
  transportMode?: string | null;
  vesselVoyage?: string | null;
  billNo?: string | null;
  etd?: string | null;
  eta?: string | null;
  recipientAddress?: string | null;
  packageSize?: string | null;
  remark?: string | null;
  createdAt?: string | null;
  attachments?: AttachmentMeta[];
  attachmentCount?: number;
  createdByName?: string | null;
};

export type CustomsRecord = {
  id: number;
  status: CustomsStatus;
  brokerName?: string | null;
  declarationNo?: string | null;
  declarationDate?: string | null;
  releaseDate?: string | null;
  tradeMode?: string | null;
  remark?: string | null;
  attachments?: AttachmentMeta[];
  attachmentCount?: number;
  updatedAt?: string | null;
  createdByName?: string | null;
};

export type OrderDetailResponse = {
  order?: OrderInfo | null;
  customer?: CustomerInfo | null;
  items?: OrderItem[] | null;
  financeRecords?: FinanceRecord[] | null;
  productionPlan?: ProductionPlan | null;
  customs?: CustomsRecord | null;
  logisticsRecords?: LogisticsRecord[] | null;
  domesticLogistics?: LogisticsRecord | null;
  internationalLogistics?: LogisticsRecord | null;
  packingRecords?: PackingRecord[] | null;
  packingPhotos?: AttachmentMeta[];
  orderDocuments?: AttachmentMeta[];
  followUps?: Array<{
    id: number;
    content: string;
    createdByName?: string | null;
    createdAt?: string;
  }>;
  tasks?: Array<{
    id: number;
    title: string;
    assignee_name: string;
    due_date: string;
    priority: string;
    status: string;
    description?: string;
  }>;
  summary?: {
    receiptsByCurrency: Record<string, number>;
    paymentsByCurrency: Record<string, number>;
    freightByCurrency: Record<string, number>;
    pendingFinanceCount: number;
    latestLogisticsStatus?: string | null;
    latestShippingDate?: string | null;
    paidAmount: number;
    outstandingAmount: number;
    paymentStatus: 'unpaid' | 'partial' | 'paid';
    settled: boolean;
    attachmentsSummary: {
      finance: number;
      logistics: number;
      customs: number;
    };
  };
};

export type EditableOrderItem = {
  clientKey: string;
  id?: number;
  imageUrl: string;
  productName: string;
  specification: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  subtotal: string;
};
export type OrderFormState = {
  id?: number;
  status: OrderStatus;
  customerId: string;
  productSummary: string;
  totalAmount: string;
  deliveryDate: string;

  freightAmount: string;
  miscAmount: string;
  details: string;
  alibabaOrderNo: string;
  items: EditableOrderItem[];
};

export type FinanceFormState = {
  id?: number;
  type: FinanceType;
  amount: string;
  currency: string;
  status: FinanceStatus;
  recordCategory: FinanceCategory;
  target: string;
  partnerId: string;
  remark: string;
  attachments: AttachmentMeta[];
  newFiles: Array<{ file: File; remark: string }>;
};

export type ProductionFormState = {
  id?: number;
  partnerId: string;
  orderDate: string;
  estimatedDeliveryDate: string;
  productionStatus: ProductionStatus;
  inspectionStatus: InspectionStatus;
  remark: string;
  photos: AttachmentMeta[];
  newPhotos: Array<{ file: File; remark: string }>;
};

export type ProductionLogFormState = {
  logDate: string;
  content: string;
  attachments: AttachmentMeta[];
  newFiles: Array<{ file: File; remark: string }>;
};

export type LogisticsFormState = {
  id?: number;
  segmentType: LogisticsSegment;
  freightForwarder: string;
  freightForwarderPartnerId: string;
  carrier: string;
  trackingNo: string;
  status: LogisticsStatus;
  shippingDate: string;
  incoterm: string;
  transportMode: string;
  vesselVoyage: string;
  billNo: string;
  etd: string;
  eta: string;
  packingDetails: string;
  recipientAddress: string;
  remark: string;
  attachments: AttachmentMeta[];
  newFiles: Array<{ file: File; remark: string }>;
};

export type PackingFormState = {
  items: PackingRecord[];
};

export type CustomsFormState = {
  id?: number;
  status: CustomsStatus;
  brokerName: string;
  declarationNo: string;
  declarationDate: string;
  releaseDate: string;
  tradeMode: string;
  remark: string;
  attachments: AttachmentMeta[];
  newFiles: Array<{ file: File; remark: string }>;
};

export type DrawerState =
  | { mode: 'closed' }
  | { mode: 'order' }
  | { mode: 'finance'; recordId?: number }
  | { mode: 'production' }
  | { mode: 'customs' }
  | { mode: 'customs-upload' }
  | { mode: 'logistics'; recordId?: number }
  | { mode: 'packing' }
  | { mode: 'production-log' }
  | { mode: 'ai-analysis' };

export type AIAnalysisResult = {
  score: number;
  risks: Array<{ level: 'high' | 'medium'; content: string }>;
  suggestions: Array<{ content: string }>;
  summary: string;
};
