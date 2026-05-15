export type View = 'home' | 'logins' | 'purchases' | 'funnel' | 'abandoned' | 'intent';

export interface Patient {
  email: string;
  allowance: number;
  login_time: string;
  hasPurchased?: boolean;
  hasUnpaid?: boolean;
  last_order_at?: string;
  tp_date?: string;
}

export interface Purchase {
  number: string;
  email: string;
  total: number;
  currency: string;
  status: string;
  payment_status: string;
  purchase_time: string;
}

export interface FunnelEvent {
  email: string;
  viewed_product: boolean;
  added_to_cart: boolean;
  removed_from_cart: boolean;
  checkout: boolean;
  login_time: string;
}

export interface IntentStat {
  date: string;
  total_logins: number;
  orders_checked: number;
  no_order_dropoff: number;
}

export interface HistoricalDataPoint {
  hour: string;
  today: number;
  yesterday: number;
  avg7d: number;
  avg28d: number;
}
