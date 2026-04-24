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

export type AttachmentMeta = {
  id: number;
  fileName: string;
  url: string;
  fileSize?: number | null;
  mimeType?: string | null;
};

export type Partner = {
  id: number;
  name: string;
  partner_type: PartnerType;
  country?: string | null;
  contact?: string | null;
  payment_terms?: string | null;
  remark?: string | null;
};

export type OrderInfo = {
  id: number;
  display_id: string;
  customer_id: number;
  status: OrderStatus;
  details?: string | null;
  product_summary?: string | null;
  total_amount: number;
  deliveryDate?: string | null;
  keyMilestone?: string | null;
  freightAmount?: number;
  miscAmount?: number;
  created_at: string;
  createdByName?: string | null;
};

export type CustomerInfo = {
  id: number;
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
  quantity: number;
  unit?: string | null;
  unit_price: number;
  subtotal: number;
  image_url?: string | null;
  imageUrl?: string | null;
};

export type FinanceRecord = {
  id: number;
  type: FinanceType;
  recordCategory?: string | null;
  amount: number;
  currency: 'USD' | 'CNY';
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
};

export type LogisticsRecord = {
  id: number;
  segmentType: LogisticsSegment;
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
  status: OrderStatus;
  totalAmount: string;
  deliveryDate: string;
  freightAmount: string;
  miscAmount: string;
  details: string;
  items: EditableOrderItem[];
};

export type FinanceFormState = {
  id?: number;
  type: FinanceType;
  amount: string;
  currency: 'USD' | 'CNY';
  status: FinanceStatus;
  recordCategory: FinanceCategory;
  target: string;
  partnerId: string;
  remark: string;
  attachments: AttachmentMeta[];
  newFiles: File[];
};

export type ProductionFormState = {
  id?: number;
  partnerId: string;
  orderDate: string;
  estimatedDeliveryDate: string;
  productionStatus: ProductionStatus;
  inspectionStatus: InspectionStatus;
  remark: string;
};

export type LogisticsFormState = {
  id?: number;
  segmentType: LogisticsSegment;
  carrier: string;
  trackingNo: string;
  status: LogisticsStatus;
  shippingDate: string;
  packageCount: string;
  volumeCbm: string;
  grossWeightKg: string;
  incoterm: string;
  transportMode: string;
  vesselVoyage: string;
  billNo: string;
  etd: string;
  eta: string;
  packingDetails: string;
  remark: string;
  attachments: AttachmentMeta[];
  newFiles: File[];
};

export type CustomsFormState = {
  id?: number;
  status: CustomsStatus;
  brokerName: string;
  declarationNo: string;
  declarationDate: string;
  releaseDate: string;
  remark: string;
  attachments: AttachmentMeta[];
  newFiles: File[];
};

export type DrawerState =
  | { mode: 'closed' }
  | { mode: 'order' }
  | { mode: 'finance'; recordId?: number }
  | { mode: 'production' }
  | { mode: 'customs' }
  | { mode: 'customs-upload' }
  | { mode: 'logistics'; recordId?: number }
  | { mode: 'ai-analysis' };

export type AIAnalysisResult = {
  score: number;
  risks: Array<{ level: 'high' | 'medium'; content: string }>;
  suggestions: Array<{ content: string }>;
  summary: string;
};
