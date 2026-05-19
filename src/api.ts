import type { Category, ChargeType, Customer, DaySession, Product, Transaction, TransactionItem } from './types'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { isTauri } from '@tauri-apps/api/core'
import { useAuth } from './store'

// ── Config ────────────────────────────────────────────────────────────────────
function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function getBase(): string {
  const raw = useAuth.getState().apiBase || localStorage.getItem('pos_api_base') || ''
  const base = normalizeBaseUrl(raw)
  if (!base) throw new Error('No server configured. Please set the API server URL.')
  return base
}

function getHeaders(): HeadersInit {
  const token = useAuth.getState().token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function isTauriRuntime(): boolean {
  return isTauri()
}

function maskSensitive(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  const cloned: Record<string, unknown> = { ...(payload as Record<string, unknown>) }
  if ('manager_password' in cloned) cloned.manager_password = '***'
  if ('password' in cloned) cloned.password = '***'
  return cloned
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const endpoint = `${getBase()}${path}`
  const method = (options?.method || 'GET').toUpperCase()
  const requestBodyRaw = typeof options?.body === 'string' ? options.body : undefined
  const requestBodyForLog = requestBodyRaw
    ? (() => {
      try {
        return maskSensitive(JSON.parse(requestBodyRaw))
      } catch {
        return requestBodyRaw
      }
    })()
    : undefined
  let res: Response
  try {
    const reqOptions: RequestInit = {
      ...options,
      headers: { ...getHeaders(), ...(options?.headers || {}) },
    }
    res = isTauriRuntime()
      ? await tauriFetch(endpoint, reqOptions)
      : await fetch(endpoint, reqOptions)
  } catch (err: any) {
    const raw = err?.message || err?.toString?.() || (typeof err === 'string' ? err : '')
    const cause = raw ? ` (${raw})` : ''
    console.error('[API] Request failed before response', {
      method,
      endpoint,
      body: requestBodyForLog,
      error: raw || 'Unknown network error',
    })
    throw new Error(`Network error: could not reach ${endpoint}${cause}`)
  }
  if (!res.ok) {
    const rawText = await res.text().catch(() => '')
    let parsed: any = null
    if (rawText) {
      try {
        parsed = JSON.parse(rawText)
      } catch {
        parsed = null
      }
    }
    const apiMessage = parsed?.error || parsed?.message || rawText || `HTTP ${res.status}`
    console.error('[API] Non-OK response', {
      method,
      endpoint,
      status: res.status,
      statusText: res.statusText,
      body: requestBodyForLog,
      response: rawText || '(empty response body)',
    })
    throw new Error(`HTTP ${res.status}: ${apiMessage}`)
  }
  const rawText = await res.text().catch(() => '')
  if (!rawText) {
    return undefined as T
  }
  try {
    return JSON.parse(rawText) as T
  } catch {
    return rawText as T
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface LoginSection {
  id: number
  name: string
  short_code: string
  prefix: string
  color: string
  is_default?: number
}

export async function apiLogin(email: string, password: string) {
  return req<{ token: string; user: any; sections: LoginSection[] }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

// ── POS Products ──────────────────────────────────────────────────────────────
export async function apiGetProducts(params?: {
  category_id?: number
  search?: string
  active_only?: boolean
}): Promise<Product[]> {
  const q = new URLSearchParams()
  if (params?.category_id) q.set('category_id', String(params.category_id))
  if (params?.search) q.set('search', params.search)
  if (params?.active_only === false) q.set('active_only', 'false')
  return req<Product[]>(`/api/pos/products?${q}`)
}

// ── POS Categories ────────────────────────────────────────────────────────────
export async function apiGetCategories(): Promise<Category[]> {
  return req<Category[]>('/api/pos/categories')
}

// ── POS Charge Types ──────────────────────────────────────────────────────────
export async function apiGetChargeTypes(): Promise<ChargeType[]> {
  return req<ChargeType[]>('/api/pos/charge-types')
}

// ── Day Session ───────────────────────────────────────────────────────────────
export async function apiGetDaySession(userId?: number): Promise<{ is_open: boolean; session: DaySession | null }> {
  const qs = userId ? `?user_id=${userId}` : ''
  return req(`/api/pos/day-session${qs}`)
}

export async function apiStartDay(opened_by: number, opening_cash: number, notes?: string) {
  return req('/api/pos/day-session', {
    method: 'POST',
    body: JSON.stringify({ opened_by, opening_cash, notes }),
  })
}

export async function apiCloseDay(
  session_id: number,
  closed_by: number,
  closing_cash: number,
  notes?: string,
) {
  return req('/api/pos/day-session', {
    method: 'PUT',
    body: JSON.stringify({ session_id, closed_by, closing_cash, notes }),
  })
}

// ── Transactions ──────────────────────────────────────────────────────────────
export async function apiCreateTransaction(data: {
  session_id: number
  customer_id?: number | null
  customer_name?: string | null
  customer_phone?: string | null
  items: Array<{
    product_id: number
    product_name: string
    sku: string
    quantity: number
    unit_price: number
    original_price: number
    discount_amount: number
    additional_charges: number
    additional_charges_note: string
    tax_rate: number
  }>
  discount_type: 'PERCENTAGE' | 'FIXED'
  discount_value: number
  payment_method: string
  cash_amount: number
  card_amount: number
  credit_amount: number
  notes: string
  created_by: number
}) {
  return req('/api/pos/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function apiGetTransactions(params?: {
  limit?: number
  page?: number
  status?: string
  session_id?: number
  customer_phone?: string
  payment_method?: string
  date_from?: string
  date_to?: string
  search?: string
}): Promise<{ transactions: Transaction[]; total: number; page: number; limit: number }> {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.page) q.set('page', String(params.page))
  if (params?.status) q.set('status', params.status)
  if (params?.session_id) q.set('session_id', String(params.session_id))
  if (params?.customer_phone) q.set('customer_phone', params.customer_phone)
  if (params?.payment_method) q.set('payment_method', params.payment_method)
  if (params?.date_from) q.set('date_from', params.date_from)
  if (params?.date_to) q.set('date_to', params.date_to)
  if (params?.search) q.set('search', params.search)
  return req(`/api/pos/transactions?${q}`)
}

export async function apiGetTransactionDetail(id: number): Promise<{ transaction: Transaction; items: TransactionItem[] }> {
  return req(`/api/pos/transactions/${id}`)
}

export async function apiVoidTransaction(id: number, reason: string, voided_by: number) {
  return req(`/api/pos/transactions/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason, voided_by }),
  })
}

export async function apiRefundTransaction(data: {
  transaction_id: number
  reason: string
  manager_password: string
  refunded_by: number
}) {
  // Backend: PUT /api/pos/transactions/:id with { action: 'void', created_by, reason }
  return req(`/api/pos/transactions/${data.transaction_id}`, {
    method: 'PUT',
    body: JSON.stringify({
      action: 'void',
      created_by: data.refunded_by,
      reason: data.reason,
    }),
  })
}

export async function apiGetPOSAuditLogs(params?: {
  limit?: number
  offset?: number
  action_type?: string
  entity_id?: number
  entity_type?: string
  search?: string
  date_from?: string
  date_to?: string
}): Promise<{ logs: any[]; total: number }> {
  const q = new URLSearchParams()
  if (params?.limit)       q.set('limit',       String(params.limit))
  if (params?.offset)      q.set('offset',      String(params.offset))
  if (params?.action_type) q.set('action_type', params.action_type)
  if (params?.entity_id)   q.set('entity_id',   String(params.entity_id))
  if (params?.entity_type) q.set('entity_type', params.entity_type)
  if (params?.search)      q.set('search',      params.search)
  if (params?.date_from)   q.set('date_from',   params.date_from)
  if (params?.date_to)     q.set('date_to',     params.date_to)
  return req(`/api/pos/audit-logs?${q}`)
}

export async function apiGetSessionLiveStats(sessionId: number): Promise<{
  completed_count: number
  completed_amount: number
  refunded_count: number
  refunded_amount: number
  voided_count: number
  voided_amount: number
}> {
  const raw = await req<Record<string, unknown>>(`/api/pos/day-session?action=live_stats&session_id=${sessionId}`)
  return {
    completed_count:  Number(raw.completed_count)  || 0,
    completed_amount: Number(raw.completed_amount) || 0,
    refunded_count:   Number(raw.refunded_count)   || 0,
    refunded_amount:  Number(raw.refunded_amount)  || 0,
    voided_count:     Number(raw.voided_count)     || 0,
    voided_amount:    Number(raw.voided_amount)    || 0,
  }
}

export async function apiCreateAuditLog(data: {
  event_type: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REFUND'
  entity_type: string
  entity_id?: number
  actor_id?: number
  metadata?: Record<string, unknown>
}) {
  return req('/api/pos/audit-logs', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ── Customers ─────────────────────────────────────────────────────────────────
export async function apiGetCustomers(): Promise<Customer[]> {
  const data = await req<any>('/api/customers')
  const rows: any[] = Array.isArray(data) ? data : data.customers || []
  return rows.map((r) => ({
    id: r.id,
    name: ([r.first_name, r.last_name].filter(Boolean).join(' ').trim()) || '',
    phone: r.phone_number || r.phone || null,
    email: r.email || null,
    address: r.address || null,
    company: r.company_name || r.company || null,
  }))
}

export async function apiGetCustomerStats(phone: string) {
  return req<any>(`/api/pos/customer-stats?phone=${encodeURIComponent(phone)}`)
}

export async function apiCheckCustomerPhone(phone: string): Promise<{ exists: boolean; customer: Customer | null }> {
  const r = await req<any>('/api/customers/check-phone', {
    method: 'POST',
    body: JSON.stringify({ phone_number: phone }),
  })
  if (!r.exists || !r.customer) return { exists: false, customer: null }
  const c = r.customer
  const name = c.customer_category === 'Government'
    ? (c.government_sector || `${c.first_name} ${c.last_name}`.trim())
    : `${c.first_name} ${c.last_name}`.trim()
  return {
    exists: true,
    customer: {
      id: c.id,
      name,
      phone: c.phone_number,
      email: c.email || null,
      address: c.address || null,
      company: c.company_name || null,
    },
  }
}

export async function apiCreateCustomer(data: {
  phone: string
  phone2?: string
  category: 'Individual' | 'Professional' | 'Government'
  firstName: string
  lastName: string
  governmentSector?: string
  company?: string
  email?: string
  address?: string
  city?: string
  notes?: string
}): Promise<Customer> {
  const displayName = data.category === 'Government'
    ? (data.governmentSector || `${data.firstName} ${data.lastName}`.trim())
    : `${data.firstName} ${data.lastName}`.trim()

  const r = await req<any>('/api/customers', {
    method: 'POST',
    body: JSON.stringify({
      phone_number: data.phone,
      phone_number_2: data.phone2 || null,
      customer_category: data.category,
      first_name: data.firstName,
      last_name: data.lastName,
      government_sector: data.governmentSector || null,
      company_name: data.company || null,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      notes: data.notes || null,
    }),
  })
  const created = r.customer || r
  return {
    id: created.id,
    name: displayName,
    phone: data.phone,
    email: data.email || null,
    address: data.address || null,
    company: data.company || null,
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
export async function apiGetSettings(): Promise<{ company_name?: string; company_phone?: string; company_logo?: string }> {
  return req<{ company_name?: string; company_phone?: string; company_logo?: string }>('/api/settings')
}

// ── POS Job Cards ─────────────────────────────────────────────────────────────

export interface PlasticLaserJobCardInput {
  date?: string; time?: string; client_name: string; customer_id?: number | null; artwork_by?: string
  job_name?: string; autho_by?: string; material?: string; board_type?: string
  size_qty?: string; structure?: string; special_note?: string
  laser_cut_time?: string; cnc_cut_time?: string
  delivery_date?: string; delivery_time?: string; invoice_no?: string
  pos_transaction_id?: number | null; created_by?: number | null
}

export interface EventProJobCardInput {
  autho_by?: string; date?: string; invoice_no?: string; artwork_by?: string
  design_fee?: number | string; customer_name: string; customer_id?: number | null; job_title?: string; tel?: string
  plastic_material_detail?: string; plastic_sqft?: number | string; other_details?: string
  sticker_type?: string; sticker_sqft?: number | string; to_be_delivered_date?: string
  items?: Array<{ item_name: string; item_code: string; qty: string; rate: string; amount: string }>
  description_special_note?: string; for_store_use?: string
  items_released_from_stores?: string; finished_by?: string; checked_by?: string
  pos_transaction_id?: number | null; created_by?: number | null
}

export async function apiCreatePlasticLaserJobCard(data: PlasticLaserJobCardInput): Promise<{ data: any; job_card_no: string }> {
  return req('/api/pos/job-cards/plastic-laser', { method: 'POST', body: JSON.stringify(data) })
}

export async function apiUpdatePlasticLaserJobCard(id: number, data: PlasticLaserJobCardInput): Promise<{ data: any }> {
  return req(`/api/pos/job-cards/plastic-laser/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function apiGetPlasticLaserJobCards(params?: {
  page?: number; limit?: number; search?: string; transaction_id?: number
}): Promise<{ data: any[]; total: number }> {
  const q = new URLSearchParams()
  if (params?.page) q.set('page', String(params.page))
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.search) q.set('search', params.search)
  if (params?.transaction_id) q.set('transaction_id', String(params.transaction_id))
  return req(`/api/pos/job-cards/plastic-laser?${q}`)
}

export async function apiCreateEventProJobCard(data: EventProJobCardInput): Promise<{ data: any; job_no: string }> {
  return req('/api/pos/job-cards/eventpro', { method: 'POST', body: JSON.stringify(data) })
}

export async function apiUpdateEventProJobCard(id: number, data: EventProJobCardInput): Promise<{ data: any }> {
  return req(`/api/pos/job-cards/eventpro/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function apiGetEventProJobCards(params?: {
  page?: number; limit?: number; search?: string; transaction_id?: number
}): Promise<{ data: any[]; total: number }> {
  const q = new URLSearchParams()
  if (params?.page) q.set('page', String(params.page))
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.search) q.set('search', params.search)
  if (params?.transaction_id) q.set('transaction_id', String(params.transaction_id))
  return req(`/api/pos/job-cards/eventpro?${q}`)
}

export async function apiLinkJobCard(type: 'plastic-laser' | 'eventpro', job_card_id: number, pos_transaction_id: number | null): Promise<{ success: boolean }> {
  return req('/api/pos/job-cards/link', {
    method: 'PATCH',
    body: JSON.stringify({ type, job_card_id, pos_transaction_id }),
  })
}
