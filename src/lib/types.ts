export type View = 'control' | 'beverages' | 'prices' | 'summary' | 'full-log' | 'log-management' | 'calculator' | 'clients' | 'settings' | 'storage' | 'workers' | 'reminders' | 'admin';

export type Role = 'admin' | 'sub_admin' | 'worker';

export type Settings = {
  id: string;
  name: string;
  admin_pin: string;
  worker_pin: string;
  ghost_word_hash: string | null;
  theme: string;
  theme_color: string;
  icon: string;
  logo_url: string | null;
  language: string;
};

export type Worker = {
  id: string;
  name: string;
  role: Role;
  pin: string;
  active: boolean;
  created_at: string;
  last_login_at: string | null;
  ip_address: string | null;
  is_online: boolean;
  device_type: string | null;
  browser: string | null;
  last_heartbeat_at: string | null;
  session_started_at: string | null;
};

export type Station = {
  id: string;
  name: string;
  type: string;
  status: 'available' | 'in_use' | 'paused' | 'maintenance' | 'offline';
  sort_order: number;
};

export type StationType = {
  id: string;
  name: string;
  label: string;
  color: string;
  sort_order: number;
};

export type PriceRule = {
  id: string;
  station_type: string;
  label: string;
  duration_minutes: number;
  price: number;
  notes: string | null;
  game_mode: 'standard' | 'football' | 'party';
  match_price: number;
  prolongation_price: number;
  notification_minutes: number;
  color: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  units_per_box: number;
  total_units: number;
  purchase_price: number;
  selling_price: number;
  color: string;
};

export type Session = {
  id: string;
  station_id: string;
  station_name: string;
  worker_name: string | null;
  price_rule_id: string | null;
  status: 'running' | 'paused' | 'finished';
  started_at: string;
  paused_at: string | null;
  ended_at: string | null;
  paused_seconds: number;
  total: number;
};

export type Transaction = {
  id: string;
  source: string;
  worker_name: string | null;
  client_id: string | null;
  client_name: string | null;
  total: number;
  paid: number;
  created_at: string;
};

export type TransactionItem = {
  id: string;
  transaction_id: string;
  item_type: 'game' | 'product';
  label: string;
  quantity: number;
  unit_price: number;
};

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
};

export type ClientPayment = {
  id: string;
  client_id: string;
  client_name: string;
  amount: number;
  worker_name: string | null;
  created_at: string;
};

export type ReminderLinkKind = 'none' | 'product' | 'station' | 'client';

export type Reminder = {
  id: string;
  message: string;
  due_at: string;
  completed: boolean;
  link_kind: ReminderLinkKind;
  link_id: string | null;
  link_label: string | null;
};

export type AuditLog = {
  id: string;
  worker_name: string | null;
  action: string;
  entity: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  details: Record<string, string>;
  created_at: string;
};

export type SessionItem = {
  id: string;
  session_id: string;
  item_type: 'game' | 'product';
  label: string;
  quantity: number;
  unit_price: number;
  is_prolongation: boolean;
  created_at: string;
  price_rule_id: string | null;
  match_count: number;
  prolongation_count: number;
  match_price: number;
  prolongation_price: number;
  party_count: number;
  duration_minutes: number;
  notification_minutes: number;
  game_started_at: string;
  game_ended_at: string | null;
  notification_sent_at: string | null;
};

export type DailyArchive = {
  id: string;
  archive_date: string;
  total_revenue: number;
  gaming_revenue: number;
  beverage_revenue: number;
  payments_total: number;
  sessions_count: number;
  transactions_count: number;
  outstanding_amount: number;
  transactions_json: Transaction[] | null;
  created_at: string;
};
