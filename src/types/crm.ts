import type { AuthUser } from './auth';

export type OrderStatus = 'draft' | 'production' | 'customs' | 'shipping' | 'completed';
export type FinanceType = 'receipt' | 'payment';
export type FinanceStatus = 'pending' | 'completed';
export type FinanceCategory = 'deposit' | 'balance' | 'goods' | 'freight' | 'customs' | 'other';
export type LogisticsStatus = 'preparing' | 'shipped' | 'arrived';
export type LogisticsSegment = 'domestic' | 'international';
export type PartnerType = 'factory' | 'forwarder' | 'customs_broker' | 'other';

export type AiSettings = {
  model: string;
  apiKey?: string;
  hasApiKey: boolean;
  baseUrl?: string;
};

export type DocumentSettings = {
  orderNumberPrefix: string;
};

export interface ManagedUser extends AuthUser {
  created_at?: string;
}

export type CustomerListItem = {
  id: number;
  display_id?: string | null;
  name: string;
  country: string;
  contact: string;
  source_channel?: string | null;
  intent_products?: string | null;
  order_count: number;
  created_by_name?: string | null;
};

export type PartnerRecord = {
  id: number;
  name: string;
  partner_type: PartnerType;
  country?: string | null;
  contact?: string | null;
  contact_person?: string | null;
  address?: string | null;
  rating?: number;
  payment_terms?: string | null;
  remark?: string | null;
  created_at?: string | null;
  created_by_name?: string | null;
};

export type OrderSummary = {
  id: number;
  display_id: string;
  customer_id: number;
  status: OrderStatus;
  total_amount: number;
  product_summary: string;
  customer_name?: string;
  customer_country?: string;
  created_at: string;
  completed_receipt_usd: number;
  pending_finance_count: number;
  latest_logistics_status?: string;
  latest_tracking_no?: string;
  latest_activity_at: string;
  created_by_name?: string | null;
};

export type OrderOption = {
  id: number;
  customer_id?: number;
  display_id: string;
  customer_name: string;
  customer_country?: string;
};

export type PartnerOption = {
  id: number;
  name: string;
  partner_type: PartnerType;
};

export type AttachmentMeta = {
  id: number;
  fileName: string;
  url: string;
};

export type FinanceListRecord = {
  id: number;
  order_id: number;
  type: FinanceType;
  amount: number;
  currency: string;
  target: string;
  status: FinanceStatus;
  remark: string;
  payment_category: 'receipt' | 'freight' | 'goods' | 'other';
  recordCategory?: FinanceCategory;
  partnerId?: number | null;
  attachmentCount?: number;
  attachments?: AttachmentMeta[];
  order_display_id?: string;
  customer_name?: string;
  partner_name?: string | null;
  created_at: string;
  createdByName?: string | null;
};

export type LogisticsListRecord = {
  id: number;
  order_id: number;
  tracking_no: string;
  carrier: string;
  packing_details: string;
  status: LogisticsStatus;
  shipping_date: string | null;
  segmentType?: LogisticsSegment;
  packageCount?: number | null;
  volumeCbm?: number | null;
  grossWeightKg?: number | null;
  incoterm?: string | null;
  transportMode?: string | null;
  vesselVoyage?: string | null;
  billNo?: string | null;
  order_display_id?: string;
  order_status?: string;
  customer_name?: string;
  created_at: string;
  createdByName?: string | null;
};
