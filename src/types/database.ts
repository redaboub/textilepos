// Types générés à partir du schéma Supabase
// À regénérer après chaque migration : npx supabase gen types typescript

export type UserRole = 'super_admin' | 'caissier';
export type SaleStatus = 'completed' | 'refunded' | 'cancelled';
export type SaleItemType = 'meter' | 'full_roll';
export type PaymentMethod = 'cash' | 'card' | 'check' | 'transfer' | 'mixed';
export type StockMovementType =
  | 'purchase' | 'sale' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'return';
export type PurchaseStatus = 'pending' | 'received' | 'cancelled';
export type CheckType = 'incoming' | 'outgoing';
export type CheckStatus = 'pending' | 'paid' | 'rejected' | 'cancelled';
export type TransferStatus = 'pending' | 'in_transit' | 'received' | 'cancelled';

export interface Store {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  store_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  language: 'fr' | 'ar';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  store?: Store | null;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  notes: string | null;
  total_purchases: number;
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  notes: string | null;
  total_purchases: number;
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  product_code: string | null;
  category_id: string | null;
  color: string | null;
  width_cm: number | null;
  price: number;
  default_price_per_meter: number;
  stock_meters: number;
  low_stock_threshold: number;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: Category | null;
}

export interface Roll {
  id: string;
  serial_number: string;
  barcode: string | null;
  product_id: string;
  store_id: string;
  supplier_id: string | null;
  initial_length: number;
  remaining_length: number;
  purchase_price_per_meter: number;
  selling_price_per_meter: number;
  low_stock_threshold: number | null;
  notes: string | null;
  is_sold: boolean;
  received_at: string;
  created_at: string;
  updated_at: string;
  product?: Product | null;
  store?: Store | null;
  supplier?: Supplier | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  roll_id: string | null;
  product_id: string | null;
  item_type: SaleItemType;
  meters_sold: number;
  price_per_meter: number;
  discount_percent: number;
  line_total: number;
  remaining_after_sale: number;
  created_at: string;
  roll?: Roll;
  product?: Product;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  sale_number: string;
  store_id: string;
  cashier_id: string;
  client_id: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  change_amount: number;
  credit_amount: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  notes: string | null;
  sale_date: string;
  created_at: string;
  updated_at: string;
  store?: Store;
  cashier?: Profile;
  client?: Client | null;
  items?: SaleItem[];
  payments?: SalePayment[];
}

export interface Purchase {
  id: string;
  purchase_number: string;
  store_id: string;
  supplier_id: string;
  created_by: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  status: PurchaseStatus;
  invoice_number: string | null;
  notes: string | null;
  purchase_date: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  store_id: string;
  category_id: string | null;
  created_by: string;
  description: string;
  amount: number;
  payment_method: PaymentMethod;
  expense_date: string;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; color: string } | null;
  store?: Store | null;
}

export interface Check {
  id: string;
  store_id: string;
  type: CheckType;
  check_number: string;
  bank_name: string | null;
  issuer_name: string;
  client_id: string | null;
  supplier_id: string | null;
  amount: number;
  issue_date: string;
  due_date: string;
  status: CheckStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  store?: Store | null;
}

// Types métier (pour le POS, etc.)
export interface CartItem {
  product: Product;
  meters: number;
  price_per_meter: number;
  discount_percent: number;
  item_type: SaleItemType;
}

export interface POSCart {
  items: CartItem[];
  client_id: string | null;
  discount_amount: number;
  tax_rate: number;
  notes: string;
}

export interface DashboardStats {
  revenue_today: number;
  revenue_month: number;
  sales_today: number;
  sales_month: number;
  low_stock_count: number;
  active_rolls: number;
  clients_count: number;
  pending_credit: number;
}
