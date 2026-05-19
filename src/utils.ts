// ── Formatting Utilities ──────────────────────────────────────────────────────

export function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return 'Rs. —'
  return `Rs. ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtNumber(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtQty(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(2)
}

export function fmtDateTime(dt: string | null | undefined): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function fmtTime(dt: string | null | undefined): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function fmtDate(dt: string | null | undefined): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Cart Helpers ──────────────────────────────────────────────────────────────
import type { CartItem, OrderTotals, PriceTier, Product } from './types'

export function getTierForQty(product: Product, qty: number): PriceTier | null {
  if (!product.price_tiers?.length) return null
  return product.price_tiers.find(t => qty >= t.min_qty && (t.max_qty === 0 || qty <= t.max_qty)) || null
}

export function computeTotals(
  items: CartItem[],
  discountType: 'PERCENTAGE' | 'FIXED',
  discountValue: number,
): OrderTotals {
  let subtotal = 0
  let additionalChargesTotal = 0
  let taxAmount = 0

  for (const item of items) {
    const lineBase = item.qty * item.unitPrice
    const lineAfterDiscount = lineBase - item.lineDiscount
    subtotal += lineAfterDiscount
    additionalChargesTotal += item.additionalCharges
    taxAmount += lineAfterDiscount * ((item.product.tax_rate || 0) / 100)
  }

  let discountAmount = 0
  if (discountType === 'PERCENTAGE' && discountValue > 0) {
    discountAmount = subtotal * (discountValue / 100)
  } else if (discountType === 'FIXED' && discountValue > 0) {
    discountAmount = discountValue
  }

  const total = subtotal - discountAmount + taxAmount + additionalChargesTotal

  return { subtotal, discountAmount, taxAmount, additionalChargesTotal, total }
}

// ── Misc ──────────────────────────────────────────────────────────────────────
export function generateRowKey(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
