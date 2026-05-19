// ── POS Domain Types ──────────────────────────────────────────────────────────

export interface PriceTier {
  id: number
  product_id: number
  min_qty: number
  max_qty: number
  price: number
  label: string | null
  sort_order: number
}

export interface Product {
  id: number
  sku: string
  barcode: string | null
  name: string
  description: string | null
  category_id: number | null
  unit: string
  cost_price: number
  selling_price: number
  tax_rate: number
  stock_qty: number
  category_name: string
  category_color: string
  allow_additional_charges: number
  price_tiers: PriceTier[]
  image_url?: string | null
  is_active: number
}

export interface Category {
  id: number
  name: string
  color: string
  icon: string
  sort_order: number
  is_active: number
}

export interface ChargeType {
  id: number
  name: string
  default_amount: number
  is_percentage: number
  is_active: number
}

export interface CartItem {
  rowKey: string
  product: Product
  qty: number
  unitPrice: number
  appliedTierId: number | null
  additionalCharges: number
  additionalChargesNote: string
  lineDiscount: number
}

export interface DaySession {
  id: number
  session_date: string
  status: 'OPEN' | 'CLOSED'
  opening_cash: number
  closing_cash: number | null
  expected_cash: number
  cash_difference: number | null
  total_sales: number
  total_cash_sales: number
  total_card_sales: number
  total_credit_sales: number
  total_transactions: number
  total_items_sold: number
  total_discounts: number
  opened_by: number | null
  opened_by_name: string | null
  opened_at?: string
  closed_at: string | null
  closed_by: number | null
  notes: string | null
}

export interface Transaction {
  id: number
  transaction_number: string
  customer_name: string | null
  customer_phone: string | null
  subtotal: number
  discount_amount: number
  tax_amount: number
  additional_charges_total: number
  total_amount: number
  paid_amount: number
  change_amount: number
  balance_due: number
  payment_method: 'CASH' | 'CARD' | 'MIXED' | 'CREDIT'
  cash_amount: number
  card_amount: number
  credit_amount: number
  status: 'COMPLETED' | 'VOIDED' | 'PENDING' | 'REFUNDED'
  notes: string | null
  session_id: number | null
  created_by: number | null
  created_by_name: string | null
  created_at: string
  // Refund metadata (populated after a refund)
  refunded_by: number | null
  refunded_by_name: string | null
  refund_reason: string | null
  refunded_at: string | null
  items?: TransactionItem[]
}

export interface TransactionItem {
  id: number
  transaction_id: number
  product_id: number
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  original_price: number
  discount_amount: number
  additional_charges: number
  tax_rate: number
  tax_amount: number
  line_total: number
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  company: string | null
}

export interface User {
  id: number
  name: string
  email: string
  username: string
  role: string
}

export interface OrderTotals {
  subtotal: number
  discountAmount: number
  taxAmount: number
  additionalChargesTotal: number
  total: number
}
