import { useEffect, useState, useCallback, useRef } from 'react'
import { isTauri, invoke } from '@tauri-apps/api/core'
import { isRegistered, register, unregister } from '@tauri-apps/plugin-global-shortcut'
import {
  CreditCard, Users, Trash2, RefreshCw, Sun, Plus, X, Search,
  LayoutGrid, SquarePlus, Percent, Layers, Loader2, Tag, ChevronDown, ReceiptText, Files, Keyboard, ClipboardList,
} from 'lucide-react'
import { TopBar } from './TopBar'
import { DaySessionModal } from './DaySessionModal'
import { PaymentModal } from './PaymentModal'
import { CustomerPicker } from './CustomerPicker'
import { TierDialog } from './TierDialog'
import { ReceiptModal } from './ReceiptModal'
import { ToastContainer } from './ToastContainer'
import { TransactionsModal } from './TransactionsModal'
import { PrinterSettingsModal } from './PrinterSettingsModal'
import { SettingsModal } from './SettingsModal'
import { JobCardModal } from './JobCardModal'
import { JobCardsListModal } from './JobCardsListModal'
import { CD_CART_KEY, CD_PAYMENT_KEY, CD_CLEAR_KEY, CD_CUSTOMER_KEY } from './CustomerDisplayWindow'
import { emit } from '@tauri-apps/api/event'
import { usePOS, useAuth } from '../store'
import {
  apiGetCategories,
  apiGetChargeTypes,
  apiGetCustomers,
  apiGetDaySession,
  apiGetProducts,
} from '../api'
import { generateRowKey, getTierForQty, fmtCurrency } from '../utils'
import type { CartItem, Product } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrderRow {
  rowKey: string
  product: Product | null
  qty: number
  unitPrice: number
  appliedTierId: number | null
  additionalCharges: number
  additionalChargesNote: string
  lineDiscount: number
}

// ── KBD badge (dark theme) ────────────────────────────────────────────────────
function KBD({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1 bg-bg-hover border border-border/80 text-[9px] font-bold text-text-2/80 px-1 py-0.5 rounded font-mono">
      {children}
    </kbd>
  )
}

// ── Dark Win11-style Button ───────────────────────────────────────────────────
function DBtn({
  children, onClick, disabled, variant = 'default', className = '', title = '', small = false,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean
  variant?: 'default' | 'accent' | 'danger' | 'success'
  className?: string; title?: string; small?: boolean
}) {
  const v: Record<string, string> = {
    default: 'bg-bg-elevated border-border text-text-1 hover:bg-bg-hover hover:text-text-1 active:opacity-80',
    accent:  'bg-accent border-accent/60 text-white hover:bg-accent-hover active:opacity-80',
    danger:  'bg-danger/10 border-danger/30 text-danger hover:bg-danger/20',
    success: 'bg-success/10 border-success/30 text-success hover:bg-success/20',
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex items-center gap-1.5 ${small ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]'} font-semibold border rounded-lg select-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${v[variant]} ${className}`}>
      {children}
    </button>
  )
}

function Sep() { return <div className="w-px h-6 bg-border mx-1 flex-shrink-0" /> }

const KEYBOARD_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '/'],
]

// ── Main Component ─────────────────────────────────────────────────────────────
export function POSLayout() {
  const {
    products, categories, setProducts, setCategories, setChargeTypes, setCustomers,
    setLoading, setDaySession, isLoading,
    isDayOpen, daySession, setShowDayModal,
    selectedCustomer, setCustomer,
    discountType, discountValue, setDiscount,
    showPayment, setShowPayment,
    showDayModal, showCustomerPicker, setShowCustomerPicker,
    showReceiptModal, lastReceipt,
    chargeTypes,
    setCartItems,
    toast,
  } = usePOS()
  const { user, customerDisplayEnabled, companyName } = useAuth()
  const [initialized, setInitialized] = useState(false)
  const [showPrinterSettings, setShowPrinterSettings] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const prevReceiptRef = useRef<boolean>(false)  // Track receipt modal open/close transitions
  const customerDisplayWindowRef = useRef<Window | null>(null)

  // ── Reset rows when receipt closes (user clicks "New Sale") ────────────────
  useEffect(() => {
    // Only reset when receipt closes (transitions from open to closed)
    if (prevReceiptRef.current && !showReceiptModal && !lastReceipt) {
      const key = generateRowKey()
      setRows([{ rowKey: key, product: null, qty: 1, unitPrice: 0, appliedTierId: null, additionalCharges: 0, additionalChargesNote: '', lineDiscount: 0 }])
      setSearchTexts({ [key]: '' })
      setSearchResults({ [key]: [] })
      setShowDropdowns({ [key]: false })
      setDropdownIdx({ [key]: -1 })
      focusEmptySearch(100)
      // Clear customer display after sale
      if (customerDisplayEnabled) {
        localStorage.setItem(CD_CLEAR_KEY, Date.now().toString())
      }
    }
    prevReceiptRef.current = showReceiptModal
  }, [showReceiptModal, lastReceipt, customerDisplayEnabled])

  // ── Local row state ─────────────────────────────────────────────────────────
  const initKey = generateRowKey()
  const [rows, setRows] = useState<OrderRow[]>([
    { rowKey: initKey, product: null, qty: 1, unitPrice: 0, appliedTierId: null, additionalCharges: 0, additionalChargesNote: '', lineDiscount: 0 },
  ])
  const [searchTexts,   setSearchTexts]   = useState<Record<string, string>>({ [initKey]: '' })
  const [searchResults, setSearchResults] = useState<Record<string, Product[]>>({ [initKey]: [] })
  const [showDropdowns, setShowDropdowns] = useState<Record<string, boolean>>({ [initKey]: false })
  const [dropdownIdx,   setDropdownIdx]   = useState<Record<string, number>>({ [initKey]: -1 })
  const [focusedRowKey, setFocusedRowKey] = useState<string | null>(null)
  const [showMyTransactions, setShowMyTransactions] = useState(false)
  const [showAllTransactions, setShowAllTransactions] = useState(false)

  // Job card modal state
  const [showJobCard, setShowJobCard] = useState(false)
  const [showJobCardsList, setShowJobCardsList] = useState(false)
  const [jobCardLinkTxnId, setJobCardLinkTxnId] = useState<number | null>(null)
  const [jobCardLinkMode, setJobCardLinkMode] = useState(false)

  // Tier dialog (local)
  const [tierDialogRow, setTierDialogRow] = useState<OrderRow | null>(null)

  // Charges dialog
  const [chargesRowKey, setChargesRowKey] = useState<string | null>(null)
  const [chargeAmount,  setChargeAmount]  = useState('')
  const [chargeNote,    setChargeNote]    = useState('')

  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false)

  // Customer picker mode (F6 = search, F7 = create)
  const [customerCreateMode, setCustomerCreateMode] = useState(false)

  // Catalog dialog (F3)
  const [showCatalog,      setShowCatalog]      = useState(false)
  const [catalogSearch,    setCatalogSearch]    = useState('')
  const [catalogCategory,  setCatalogCategory]  = useState<number | null>(null)
  const catalogSearchRef = useRef<HTMLInputElement>(null)

  // Refs for DOM focus
  const searchRefs    = useRef<Record<string, HTMLInputElement | null>>({})
  const qtyRefs       = useRef<Record<string, HTMLInputElement | null>>({})
  const unitPriceRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const dropdownItemRefs = useRef<Record<string, (HTMLButtonElement | null)[]>>({})
  const lastFocusedEditableRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  // Always tracks the latest rows without causing stale closures
  const latestRowsRef = useRef<OrderRow[]>(rows)

  function rememberEditableTarget(target: EventTarget | null) {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      if (!target.readOnly && !target.disabled) {
        lastFocusedEditableRef.current = target
      }
    }
  }

  useEffect(() => {
    function handleFocusIn(e: FocusEvent) {
      rememberEditableTarget(e.target)
    }

    document.addEventListener('focusin', handleFocusIn)
    return () => document.removeEventListener('focusin', handleFocusIn)
  }, [])

  function applyVirtualKeyToFocusedInput(key: string): boolean {
    const input = lastFocusedEditableRef.current
    if (!input || input.readOnly || input.disabled || !input.isConnected) return false
    if (!['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '/', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫', 'Clear', 'Space'].includes(key)) return false

    input.focus()

    const currentValue = input.value ?? ''
    const hasSelection = typeof input.selectionStart === 'number' && typeof input.selectionEnd === 'number'
    const start = hasSelection ? input.selectionStart ?? currentValue.length : currentValue.length
    const end = hasSelection ? input.selectionEnd ?? currentValue.length : currentValue.length

    let nextValue = currentValue
    let caret = start

    if (key === 'Clear') {
      nextValue = ''
      caret = 0
    } else if (key === '⌫') {
      if (start !== end) {
        nextValue = currentValue.slice(0, start) + currentValue.slice(end)
        caret = start
      } else if (start > 0) {
        nextValue = currentValue.slice(0, start - 1) + currentValue.slice(end)
        caret = start - 1
      }
    } else {
      const text = key === 'Space' ? ' ' : key
      nextValue = currentValue.slice(0, start) + text + currentValue.slice(end)
      caret = start + text.length
    }

    // Use the native value setter so React's internal value tracker sees the change.
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set
    if (nativeSetter) {
      nativeSetter.call(input, nextValue)
    } else {
      input.value = nextValue
    }

    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: key === 'Space' ? ' ' : key }))
    input.dispatchEvent(new Event('change', { bubbles: true }))

    const searchRowKey = Object.keys(searchRefs.current).find(
      (rk) => searchRefs.current[rk] === input,
    )
    if (searchRowKey) {
      handleSearchChange(searchRowKey, nextValue)
    }

    if (typeof input.setSelectionRange === 'function') {
      requestAnimationFrame(() => {
        try {
          input.setSelectionRange(caret, caret)
        } catch {
          // Some numeric inputs do not support caret positioning.
        }
      })
    }

    return true
  }

  // Focus the first empty search row — called after every user action so
  // the barcode scanner can immediately scan the next item.
  function focusEmptySearch(delay = 80) {
    setTimeout(() => {
      const empty = latestRowsRef.current.find(r => !r.product)
      if (empty) searchRefs.current[empty.rowKey]?.focus()
    }, delay)
  }

  // ── Sync rows → store cartItems (for PaymentModal) ────────────────────────
  useEffect(() => {
    latestRowsRef.current = rows   // keep ref current for focusEmptySearch
    const items: CartItem[] = rows
      .filter(r => r.product !== null)
      .map(r => ({
        rowKey: r.rowKey,
        product: r.product!,
        qty: r.qty,
        unitPrice: r.unitPrice,
        appliedTierId: r.appliedTierId,
        additionalCharges: r.additionalCharges,
        additionalChargesNote: r.additionalChargesNote,
        lineDiscount: r.lineDiscount,
      }))
    setCartItems(items)

    // ── Broadcast to customer display ─────────────────────────────────────
    if (customerDisplayEnabled) {
      const displayItems = items.map(i => ({
        rowKey: i.rowKey,
        productName: i.product.name,
        qty: i.qty,
        unitPrice: i.unitPrice,
        lineTotal: i.qty * i.unitPrice - i.lineDiscount + i.additionalCharges,
      }))
      const subtotal = displayItems.reduce((s, i) => s + i.lineTotal, 0)
      const discount = discountValue > 0
        ? (discountType === 'PERCENTAGE' ? subtotal * discountValue / 100 : discountValue)
        : 0
      const total = Math.max(0, subtotal - discount)
      const cartPayload = {
        items: displayItems,
        subtotal,
        discount,
        total,
        customerName: selectedCustomer?.name ?? null,
      }
      if (isTauri()) {
        emit('cd:cart', cartPayload).catch(() => {})
      } else {
        localStorage.setItem(CD_CART_KEY, JSON.stringify(cartPayload))
      }
    }
  }, [rows, customerDisplayEnabled, discountType, discountValue, selectedCustomer])

  // ── Greet customer on customer display when one is selected ───────────────
  useEffect(() => {
    if (!customerDisplayEnabled || !selectedCustomer) return
    const payload = { name: selectedCustomer.name }
    if (isTauri()) {
      emit('cd:customer', payload).catch(() => {})
    } else {
      localStorage.setItem(CD_CUSTOMER_KEY, JSON.stringify(payload))
    }
  }, [selectedCustomer, customerDisplayEnabled])

  // ── Customer display window management ────────────────────────────────────
  useEffect(() => {
    if (customerDisplayEnabled) {
      if (isTauri()) {
        // Rust command handles create-or-show reliably (no frontend permission needed)
        invoke('open_customer_display').catch((e) => {
          console.error('[CustomerDisplay] Failed to open window:', e)
        })
      } else {
        // Browser fallback for dev/testing
        if (!customerDisplayWindowRef.current || customerDisplayWindowRef.current.closed) {
          customerDisplayWindowRef.current = window.open(
            '/?mode=customer-display',
            'pos-customer-display',
            'width=1200,height=768,toolbar=no,menubar=no',
          )
        }
      }
    } else {
      if (isTauri()) {
        invoke('close_customer_display').catch(() => {})
        emit('cd:clear', {}).catch(() => {})
      } else {
        if (customerDisplayWindowRef.current && !customerDisplayWindowRef.current.closed) {
          customerDisplayWindowRef.current.close()
          customerDisplayWindowRef.current = null
        }
        localStorage.removeItem(CD_CART_KEY)
        localStorage.removeItem(CD_PAYMENT_KEY)
      }
    }
  }, [customerDisplayEnabled])

  // ── Broadcast payment complete to customer display ─────────────────────────
  useEffect(() => {
    if (!customerDisplayEnabled || !lastReceipt) return
    const total = lastReceipt.total_amount ?? lastReceipt.total ?? 0
    const amountPaid = lastReceipt.amount_paid ?? lastReceipt.cash_amount ?? 0
    const change = lastReceipt.change_amount ?? lastReceipt.change ?? 0
    const paymentPayload = {
      total,
      amountPaid,
      change,
      customerName: lastReceipt.customer_name ?? null,
      transactionNumber: lastReceipt.transaction_number ?? null,
    }
    if (isTauri()) {
      emit('cd:payment', paymentPayload).catch(() => {})
    } else {
      localStorage.setItem(CD_PAYMENT_KEY, JSON.stringify(paymentPayload))
    }
  }, [lastReceipt, customerDisplayEnabled])

  // ── Initial data load ────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const [prods, cats, charges, custs, session] = await Promise.all([
          apiGetProducts(),
          apiGetCategories(),
          apiGetChargeTypes(),
          apiGetCustomers(),
          apiGetDaySession(user?.id),
        ])
        setProducts(prods)
        setCategories(cats)
        setChargeTypes(charges)
        setCustomers(custs)
        setDaySession(session.session, session.is_open)
        if (!session.is_open) setShowDayModal(true)
      } catch (err: any) {
        toast('error', `Failed to load POS data: ${err.message}`)
      } finally {
        setLoading(false)
        setInitialized(true)
        focusEmptySearch(300)  // auto-focus search on startup
      }
    }
    init()
  }, [])

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't interfere when any modal is open — those modals handle their own keys
      if (showPayment || showDayModal || showCustomerPicker) return

      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const inInput = tag === 'input' || tag === 'textarea'

      // Redirect any printable character typed outside an input to the search
      // row so a barcode scanner works even if focus drifted to a button.
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !inInput) {
        const empty = latestRowsRef.current.find(r => !r.product)
        if (empty) searchRefs.current[empty.rowKey]?.focus()
        return  // let the char naturally flow into the now-focused input
      }

      if (e.key === 'F2') { e.preventDefault(); focusOrAddRow() }
      if (e.key === 'F3') { e.preventDefault(); setShowCatalog(true); setTimeout(() => catalogSearchRef.current?.focus(), 80) }
      if (e.key === 'F5') { e.preventDefault(); triggerPayment() }
      if (e.key === 'F6') { e.preventDefault(); setShowCustomerPicker(true); setCustomerCreateMode(false) }
      if (e.key === 'F7') { e.preventDefault(); setShowCustomerPicker(true); setCustomerCreateMode(true) }
      if (e.key === 'F8') { e.preventDefault(); clearAll() }
      if (e.key === 'F9') { e.preventDefault(); setShowDayModal(true) }
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        if (focusedRowKey) {
          const row = rows.find(r => r.rowKey === focusedRowKey)
          if (row?.product?.price_tiers?.length) setTierDialogRow(row)
        }
      }
      if (e.key === 'Escape') {
        if (showCatalog) { e.preventDefault(); setShowCatalog(false); focusEmptySearch(50) }
        if (showPayment) { e.preventDefault(); setShowPayment(false) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showCatalog, showPayment, showDayModal, showCustomerPicker, focusedRowKey, rows])

  // Register F6 and F7 at the native app level because WebView2 reserves them.
  useEffect(() => {
    let disposed = false

    if (!isTauri()) return

    const bindShortcuts = async () => {
      try {
        if (await isRegistered('F6')) await unregister('F6')
        await register('F6', () => {
          if (!disposed) {
            setCustomerCreateMode(false)
            setShowCustomerPicker(true)
          }
        })
      } catch (error) {
        console.error('Failed to register F6 shortcut:', error)
      }

      try {
        if (await isRegistered('F7')) await unregister('F7')
        await register('F7', () => {
          if (!disposed) {
            setCustomerCreateMode(true)
            setShowCustomerPicker(true)
          }
        })
      } catch (error) {
        console.error('Failed to register F7 shortcut:', error)
      }
    }

    bindShortcuts()

    return () => {
      disposed = true
      unregister('F6').catch(() => undefined)
      unregister('F7').catch(() => undefined)
    }
  }, [setShowCustomerPicker])

  // ── Row helpers ──────────────────────────────────────────────────────────
  function addNewRow(): string {
    const key = generateRowKey()
    setRows(prev => [...prev, { rowKey: key, product: null, qty: 1, unitPrice: 0, appliedTierId: null, additionalCharges: 0, additionalChargesNote: '', lineDiscount: 0 }])
    setSearchTexts(p => ({ ...p, [key]: '' }))
    setSearchResults(p => ({ ...p, [key]: [] }))
    setShowDropdowns(p => ({ ...p, [key]: false }))
    setDropdownIdx(p => ({ ...p, [key]: -1 }))
    return key
  }

  const focusOrAddRow = useCallback(() => {
    const empty = rows.find(r => !r.product)
    if (empty) { setTimeout(() => searchRefs.current[empty.rowKey]?.focus(), 0); return }
    const key = addNewRow()
    setTimeout(() => searchRefs.current[key]?.focus(), 50)
  }, [rows])

  const triggerPayment = useCallback(() => {
    if (rows.some(r => r.product) && isDayOpen) setShowPayment(true)
  }, [rows, isDayOpen])

  const clearAll = useCallback(() => {
    const key = generateRowKey()
    setRows([{ rowKey: key, product: null, qty: 1, unitPrice: 0, appliedTierId: null, additionalCharges: 0, additionalChargesNote: '', lineDiscount: 0 }])
    setSearchTexts({ [key]: '' })
    setSearchResults({ [key]: [] })
    setShowDropdowns({ [key]: false })
    setDropdownIdx({ [key]: -1 })
    setDiscount('FIXED', 0)
    setCustomer(null)
    setTimeout(() => searchRefs.current[key]?.focus(), 50)
  }, [])

  const removeRow = useCallback((rowKey: string) => {
    setRows(prev => {
      const next = prev.filter(r => r.rowKey !== rowKey)
      if (next.length === 0) {
        const key = generateRowKey()
        setSearchTexts(() => ({ [key]: '' }))
        setSearchResults(() => ({ [key]: [] }))
        setShowDropdowns(() => ({ [key]: false }))
        setDropdownIdx(() => ({ [key]: -1 }))
        setTimeout(() => searchRefs.current[key]?.focus(), 50)
        return [{ rowKey: key, product: null, qty: 1, unitPrice: 0, appliedTierId: null, additionalCharges: 0, additionalChargesNote: '', lineDiscount: 0 }]
      }
      return next
    })
  }, [])

  // ── Search ──────────────────────────────────────────────────────────────
  function handleSearchChange(rowKey: string, value: string) {
    setSearchTexts(p => ({ ...p, [rowKey]: value }))
    if (!value.trim()) {
      setSearchResults(p => ({ ...p, [rowKey]: [] }))
      setShowDropdowns(p => ({ ...p, [rowKey]: false }))
      return
    }
    const q = value.toLowerCase()
    const res = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 12)
    setSearchResults(p => ({ ...p, [rowKey]: res }))
    setShowDropdowns(p => ({ ...p, [rowKey]: true }))
    setDropdownIdx(p => ({ ...p, [rowKey]: res.length > 0 ? 0 : -1 }))
  }

  function selectProduct(rowKey: string, product: Product, focusQty = false) {
    if (product.stock_qty <= 0) { toast('error', 'Out of stock!'); return }
    // Check if product already in another row — bump qty instead
    const existingRow = rows.find(r => r.rowKey !== rowKey && r.product?.id === product.id)
    if (existingRow) {
      setRows(prev => prev.map(r => {
        if (r.rowKey !== existingRow.rowKey) return r
        const newQty = r.qty + 1
        const tier = getTierForQty(r.product!, newQty)
        return { ...r, qty: newQty, unitPrice: tier ? tier.price : r.product!.selling_price, appliedTierId: tier?.id ?? null }
      }))
      setSearchTexts(p => ({ ...p, [rowKey]: '' }))
      setShowDropdowns(p => ({ ...p, [rowKey]: false }))
      toast('info', 'Qty increased on existing row')
      // rowKey is still empty — keep focus there for next scan
      setTimeout(() => searchRefs.current[rowKey]?.focus(), 30)
      return
    }
    const tier = getTierForQty(product, 1)
    setRows(prev => prev.map(r => r.rowKey === rowKey
      ? { ...r, product, qty: 1, unitPrice: tier ? tier.price : product.selling_price, appliedTierId: tier?.id ?? null }
      : r
    ))
    setSearchTexts(p => ({ ...p, [rowKey]: product.name }))
    setShowDropdowns(p => ({ ...p, [rowKey]: false }))
    if (focusQty) {
      // Keyboard select: focus qty so user can confirm/change quantity
      setTimeout(() => qtyRefs.current[rowKey]?.focus(), 50)
    } else {
      // Mouse/barcode select: jump to next empty row
      const nextEmpty = rows.find(r => r.rowKey !== rowKey && !r.product)
      if (nextEmpty) {
        setTimeout(() => searchRefs.current[nextEmpty.rowKey]?.focus(), 30)
      } else {
        const key = addNewRow()
        setTimeout(() => searchRefs.current[key]?.focus(), 100)
      }
    }
  }

  function handleSearchKeyDown(rowKey: string, e: React.KeyboardEvent<HTMLInputElement>) {
    const res = searchResults[rowKey] || []
    const idx = dropdownIdx[rowKey] ?? -1
    const ri = rows.findIndex(r => r.rowKey === rowKey)
    const isOpen = showDropdowns[rowKey] && res.length > 0

    // When dropdown is visible, arrow keys navigate within it
    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setDropdownIdx(p => ({ ...p, [rowKey]: Math.min(idx + 1, res.length - 1) }))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setDropdownIdx(p => ({ ...p, [rowKey]: Math.max(idx - 1, 0) }))
        return
      }
    } else {
      // Dropdown closed — arrow keys navigate between rows
      if (e.key === 'ArrowDown') { e.preventDefault(); if (ri < rows.length - 1) setTimeout(() => searchRefs.current[rows[ri + 1].rowKey]?.focus(), 0); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); if (ri > 0) setTimeout(() => searchRefs.current[rows[ri - 1].rowKey]?.focus(), 0); return }
    }

    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      const row = rows.find(r => r.rowKey === rowKey)
      if (row?.product) { e.preventDefault(); qtyRefs.current[rowKey]?.focus() }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows.find(r => r.rowKey === rowKey)
      if (row?.product) { qtyRefs.current[rowKey]?.focus(); return }
      const val = (searchTexts[rowKey] || '').trim()
      const exact = products.find(p => p.barcode === val || p.sku === val)
      if (exact) { selectProduct(rowKey, exact, true); return }
      if (idx >= 0 && res[idx]) selectProduct(rowKey, res[idx], true)
      else if (res.length === 1) selectProduct(rowKey, res[0], true)
    }
    if (e.key === 'Escape') {
      if (isOpen) {
        // First ESC: close dropdown, keep text, stay on this row
        e.preventDefault()
        setShowDropdowns(p => ({ ...p, [rowKey]: false }))
      } else {
        // Second ESC (no dropdown): revert text to product name
        const row = rows.find(r => r.rowKey === rowKey)
        setSearchTexts(p => ({ ...p, [rowKey]: row?.product?.name || '' }))
      }
    }
    if (e.key === 'Delete' && !(searchTexts[rowKey] || '')) removeRow(rowKey)
  }

  function handleQtyKeyDown(rowKey: string, e: React.KeyboardEvent<HTMLInputElement>) {
    const ri = rows.findIndex(r => r.rowKey === rowKey)
    if (e.key === 'ArrowUp')   { e.preventDefault(); if (ri > 0) setTimeout(() => qtyRefs.current[rows[ri - 1].rowKey]?.focus(), 0) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (ri < rows.length - 1) setTimeout(() => qtyRefs.current[rows[ri + 1].rowKey]?.focus(), 0) }
    else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); searchRefs.current[rowKey]?.focus() }
    else if (e.key === 'Enter') {
      // Enter in qty → move to next empty search row (or add new row)
      e.preventDefault()
      const nextEmpty = latestRowsRef.current.find(r => !r.product)
      if (nextEmpty) {
        setTimeout(() => searchRefs.current[nextEmpty.rowKey]?.focus(), 0)
      } else {
        const key = addNewRow()
        setTimeout(() => searchRefs.current[key]?.focus(), 50)
      }
    }
    else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); unitPriceRefs.current[rowKey]?.focus() }
    else if (e.key === 'Escape') searchRefs.current[rowKey]?.focus()
  }

  function handleUnitPriceKeyDown(rowKey: string, e: React.KeyboardEvent<HTMLInputElement>) {
    const ri = rows.findIndex(r => r.rowKey === rowKey)
    if (e.key === 'ArrowUp')   { e.preventDefault(); if (ri > 0) setTimeout(() => unitPriceRefs.current[rows[ri - 1].rowKey]?.focus(), 0) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (ri < rows.length - 1) setTimeout(() => unitPriceRefs.current[rows[ri + 1].rowKey]?.focus(), 0) }
    else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); qtyRefs.current[rowKey]?.focus() }
    else if (e.key === 'Enter' || e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      if (ri === rows.length - 1) { const key = addNewRow(); setTimeout(() => searchRefs.current[key]?.focus(), 50) }
      else { const next = rows[ri + 1]; if (next) setTimeout(() => searchRefs.current[next.rowKey]?.focus(), 0) }
    }
    else if (e.key === 'Escape') qtyRefs.current[rowKey]?.focus()
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  const productRows  = rows.filter(r => r.product !== null)
  const subtotal     = productRows.reduce((s, r) => s + r.unitPrice * r.qty - r.lineDiscount, 0)
  const totalCharges = productRows.reduce((s, r) => s + r.additionalCharges, 0)
  const cartDiscount = discountType === 'PERCENTAGE' ? subtotal * (discountValue / 100) : discountValue
  const totalTax     = productRows.reduce((s, r) => s + r.unitPrice * r.qty * (r.product!.tax_rate || 0) / 100, 0)
  const grandTotal   = subtotal + totalCharges - cartDiscount + totalTax
  const totalQty     = productRows.reduce((s, r) => s + r.qty, 0)

  // ── Catalog filter ────────────────────────────────────────────────────────
  const catalogProducts = products.filter(p => {
    const matchCat = catalogCategory === null || p.category_id === catalogCategory
    const q = catalogSearch.toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q))
    return matchCat && matchSearch && p.is_active
  })

  function addFromCatalog(product: Product) {
    if (product.stock_qty <= 0) { toast('error', 'Out of stock!'); return }
    const existing = rows.find(r => r.product?.id === product.id)
    if (existing) {
      setRows(prev => prev.map(r => {
        if (r.rowKey !== existing.rowKey) return r
        const newQty = r.qty + 1
        const tier = getTierForQty(r.product!, newQty)
        return { ...r, qty: newQty, unitPrice: tier ? tier.price : r.product!.selling_price, appliedTierId: tier?.id ?? null }
      }))
      toast('info', `${product.name} qty +1`)
      focusEmptySearch(80)
      return
    }
    const emptyRow = rows.find(r => !r.product)
    if (emptyRow) {
      const tier = getTierForQty(product, 1)
      setRows(prev => prev.map(r => r.rowKey === emptyRow.rowKey
        ? { ...r, product, qty: 1, unitPrice: tier ? tier.price : product.selling_price, appliedTierId: tier?.id ?? null }
        : r
      ))
      setSearchTexts(p => ({ ...p, [emptyRow.rowKey]: product.name }))
      focusEmptySearch(100)  // emptyRow is now filled; focusEmptySearch will find/create the next one
    } else {
      const key = generateRowKey()
      const tier = getTierForQty(product, 1)
      setRows(prev => [...prev, { rowKey: key, product, qty: 1, unitPrice: tier ? tier.price : product.selling_price, appliedTierId: tier?.id ?? null, additionalCharges: 0, additionalChargesNote: '', lineDiscount: 0 }])
      setSearchTexts(p => ({ ...p, [key]: product.name }))
      setSearchResults(p => ({ ...p, [key]: [] }))
      setShowDropdowns(p => ({ ...p, [key]: false }))
      setDropdownIdx(p => ({ ...p, [key]: -1 }))
      focusEmptySearch(120)
    }
  }

  async function refreshProducts() {
    try {
      const prods = await apiGetProducts()
      setProducts(prods)
      toast('success', 'Products refreshed')
    } catch (err: any) {
      toast('error', `Refresh failed: ${err.message}`)
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (!initialized) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-accent/30 border-t-accent rounded-full animate-spin mb-4" />
          <p className="text-text-2 text-sm">Loading POS System…</p>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`h-screen flex flex-col bg-bg-primary overflow-hidden ${showVirtualKeyboard ? 'pb-[330px]' : ''}`}>
      <TopBar
        user={user}
        onOpenPrinterSettings={() => setShowPrinterSettings(true)}
        onOpenSettings={() => setShowSettings(true)}
        customerDisplayEnabled={customerDisplayEnabled}
        onShowCustomerDisplay={() => { if (isTauri()) invoke('open_customer_display').catch(() => {}) }}
      />

      {/* ── Window frame (Win11 adapted to dark theme) ── */}
      <div className="flex-1 flex flex-col overflow-hidden p-2">
        <div className="flex flex-col bg-bg-card border border-border shadow-xl flex-1 min-h-0 rounded-sm overflow-hidden">

          {/* Transactions bar */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-bg-primary/70 border-b border-border flex-wrap flex-shrink-0">
            <DBtn onClick={() => setShowMyTransactions(true)} disabled={!daySession || !user}>
              <ReceiptText className="h-3.5 w-3.5" /> My Transactions
            </DBtn>
            <DBtn onClick={() => setShowAllTransactions(true)}>
              <Files className="h-3.5 w-3.5" /> All Transactions
            </DBtn>
            <DBtn onClick={() => setShowAllTransactions(true)}>
              <Search className="h-3.5 w-3.5" /> Search Transactions
            </DBtn>
            <Sep />
            <DBtn onClick={() => { setJobCardLinkTxnId(null); setJobCardLinkMode(false); setShowJobCard(true) }}>
              <ClipboardList className="h-3.5 w-3.5" /> Job Card
            </DBtn>
            <DBtn onClick={() => setShowJobCardsList(true)}>
              <ClipboardList className="h-3.5 w-3.5" /> All Job Cards
            </DBtn>
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-[11px] px-2 py-0.5 font-bold rounded-full ${isDayOpen ? 'bg-success/15 text-success border border-success/30' : 'bg-danger/15 text-danger border border-danger/30'}`}>
                {isDayOpen ? 'Day Open' : 'Day Closed'}
              </span>
              {user && <span className="text-[11px] text-text-3">{user.name || user.username}</span>}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-bg-elevated border-b border-border flex-wrap flex-shrink-0">
            <DBtn variant="accent"
              onClick={() => { if (productRows.length && isDayOpen) setShowPayment(true) }}
              disabled={productRows.length === 0 || !isDayOpen}>
              <CreditCard className="h-3.5 w-3.5" /> Payment <KBD>F5</KBD>
            </DBtn>
            <DBtn onClick={() => setShowCustomerPicker(true)}>
              <Users className="h-3.5 w-3.5" />
              {selectedCustomer ? selectedCustomer.name : 'Customer'}
              {selectedCustomer && <span className="text-success ml-0.5">✓</span>}
              <KBD>F6</KBD>
            </DBtn>
            <DBtn onClick={focusOrAddRow}>
              <SquarePlus className="h-3.5 w-3.5" /> New Line <KBD>F2</KBD>
            </DBtn>
            <DBtn onClick={() => { setShowCatalog(true); setTimeout(() => catalogSearchRef.current?.focus(), 80) }}>
              <LayoutGrid className="h-3.5 w-3.5" /> Catalog <KBD>F3</KBD>
            </DBtn>
            <Sep />
            <DBtn variant="danger" onClick={clearAll} disabled={productRows.length === 0}>
              <Trash2 className="h-3.5 w-3.5" /> Clear <KBD>F8</KBD>
            </DBtn>
            <DBtn onClick={refreshProducts}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </DBtn>
            {!isDayOpen && (
              <DBtn variant="success" onClick={() => setShowDayModal(true)}>
                <Sun className="h-3.5 w-3.5" /> Start Day <KBD>F9</KBD>
              </DBtn>
            )}
            {/* Hint strip */}
            <div className="ml-auto hidden xl:flex items-center gap-3 text-[10px] text-text-2/70">
              {[['F3', 'Catalog'], ['F6', 'Customer'], ['Ctrl+D', 'Tier'], ['↑↓', 'Navigate'], ['←→', 'Columns'], ['Del', 'Remove row']].map(([k, label]) => (
                <span key={k}><kbd className="bg-bg-hover border border-border/80 px-1 py-0.5 rounded text-[9px] font-mono">{k}</kbd> {label}</span>
              ))}
            </div>
          </div>

          {/* ── Main split ── */}
          <div className="flex flex-1 min-h-0">

            {/* LEFT: Order entry table */}
            <div className="flex-1 min-w-0 flex flex-col border-r border-border/50">

              {/* Table header */}
              <div className="bg-bg-elevated border-b-2 border-border/80 flex-shrink-0">
                <div className="grid text-[10px] font-bold text-text-2 uppercase tracking-wider select-none"
                  style={{ gridTemplateColumns: '44px 1fr 90px 120px 100px 80px 120px 44px' }}>
                  {['#', 'Item Description', 'Qty', 'Unit Price', 'Charges', 'Disc.', 'Line Total', ''].map((h, i) => (
                    <div key={i} className={`px-3 py-2.5 ${i > 0 ? 'border-l border-border/40' : ''} ${i >= 2 ? 'text-right' : ''}`}>{h}</div>
                  ))}
                </div>
              </div>

              {/* Table body */}
              <div className="flex-1 overflow-y-auto">
                {isLoading && !initialized ? (
                  <div className="flex items-center justify-center h-24 text-text-3">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading products…
                  </div>
                ) : (
                  <>
                    {rows.map((row, idx) => {
                      const lineTotal = row.product
                        ? row.unitPrice * row.qty + row.additionalCharges - row.lineDiscount
                        : 0
                      const lowStock = row.product !== null && row.product.stock_qty <= 5 && row.product.stock_qty > 0
                      const outStock = row.product !== null && row.product.stock_qty <= 0
                      const isLastEmpty = idx === rows.length - 1 && !row.product

                      return (
                        <div key={row.rowKey}
                          className={`grid border-b border-border/30 transition-colors group ${
                            row.product
                              ? outStock ? 'bg-danger/5' : 'bg-bg-card hover:bg-bg-elevated'
                              : isLastEmpty ? 'bg-bg-primary/50 border-dashed' : 'bg-bg-primary/30'
                          }`}
                          style={{ gridTemplateColumns: '44px 1fr 90px 120px 100px 80px 120px 44px' }}
                        >
                          {/* Row # */}
                          <div className="flex items-center justify-center text-[11px] font-bold text-text-2/70 border-r border-border/30 select-none">
                            {idx + 1}
                          </div>

                          {/* Item search / name */}
                          <div className="relative border-r border-border/30">
                            <input
                              ref={el => { searchRefs.current[row.rowKey] = el }}
                              type="text"
                              value={searchTexts[row.rowKey] || ''}
                              onChange={e => handleSearchChange(row.rowKey, e.target.value)}
                              onKeyDown={e => handleSearchKeyDown(row.rowKey, e)}
                              onFocus={() => {
                                rememberEditableTarget(searchRefs.current[row.rowKey])
                                setFocusedRowKey(row.rowKey)
                                if ((searchTexts[row.rowKey] || '').trim() && (searchResults[row.rowKey] || []).length > 0)
                                  setShowDropdowns(p => ({ ...p, [row.rowKey]: true }))
                              }}
                              onBlur={() => setTimeout(() => setShowDropdowns(p => ({ ...p, [row.rowKey]: false })), 160)}
                              placeholder={isLastEmpty ? 'Search item, scan barcode or type SKU…' : ''}
                              className={`w-full h-9 bg-transparent border-0 outline-none px-3 text-[12px] placeholder:text-text-2/50 ${
                                row.product ? 'font-semibold text-text-1' : 'text-text-3'
                              }`}
                            />
                            {row.product && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-text-2/40 pointer-events-none">
                                {row.product.sku}
                              </span>
                            )}
                            {/* Search dropdown */}
                            {showDropdowns[row.rowKey] && (searchResults[row.rowKey] || []).length > 0 && (
                              <div className="absolute top-full left-0 z-[100] min-w-[380px] w-max max-w-[600px] bg-bg-elevated border border-border shadow-2xl rounded-xl overflow-hidden mt-0.5">
                                <div className="px-3 py-1 bg-bg-hover border-b border-border text-[9px] text-text-3 font-semibold uppercase tracking-wider">
                                  {(searchResults[row.rowKey] || []).length} result(s) — ↑↓ navigate · Enter select
                                </div>
                                <div className="max-h-[280px] overflow-y-auto">
                                  {(searchResults[row.rowKey] || []).map((prod, pIdx) => (
                                  <button key={prod.id} type="button"
                                    ref={el => {
                                      if (!dropdownItemRefs.current[row.rowKey]) dropdownItemRefs.current[row.rowKey] = []
                                      dropdownItemRefs.current[row.rowKey][pIdx] = el
                                      if (dropdownIdx[row.rowKey] === pIdx && el) el.scrollIntoView({ block: 'nearest' })
                                    }}
                                    onMouseDown={() => selectProduct(row.rowKey, prod)}
                                    className={`w-full text-left px-3 py-2.5 text-[12px] flex items-center gap-3 border-b border-border/30 last:border-b-0 transition-colors ${
                                      dropdownIdx[row.rowKey] === pIdx ? 'bg-accent/20 text-text-1' : 'hover:bg-bg-hover'
                                    }`}
                                  >
                                    <div className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: prod.category_color || '#565F7E' }} />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-text-1 truncate">{prod.name}</div>
                                      <div className="text-[10px] text-text-3 flex gap-2">
                                        <span className="font-mono">{prod.sku}</span>
                                        <span>·</span><span>{prod.category_name}</span>
                                        <span>·</span><span>{prod.unit}</span>
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                      <div className="font-bold text-accent text-[13px]">Rs.{prod.selling_price.toFixed(2)}</div>
                                      <div className={`text-[10px] font-semibold ${prod.stock_qty <= 0 ? 'text-danger' : prod.stock_qty <= 5 ? 'text-warning' : 'text-success'}`}>
                                        {prod.stock_qty <= 0 ? 'Out of stock' : `Stock: ${prod.stock_qty}`}
                                      </div>
                                    </div>
                                  </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Qty */}
                          <div className="flex items-center border-r border-border/30 px-2">
                            {row.product ? (
                              <input ref={el => { qtyRefs.current[row.rowKey] = el }}
                                type="number" min="1" max={row.product.stock_qty}
                                value={row.qty || ''}
                                onFocus={e => { rememberEditableTarget(e.target); e.target.select(); setFocusedRowKey(row.rowKey) }}
                                onChange={e => {
                                  const v = Math.max(1, parseInt(e.target.value) || 1)
                                  setRows(prev => prev.map(r => {
                                    if (r.rowKey !== row.rowKey) return r
                                    const tier = r.product ? getTierForQty(r.product, v) : null
                                    return { ...r, qty: v, unitPrice: tier ? tier.price : (r.product?.selling_price ?? r.unitPrice), appliedTierId: tier?.id ?? null }
                                  }))
                                }}
                                onKeyDown={e => handleQtyKeyDown(row.rowKey, e)}
                                className={`w-full h-9 text-[13px] font-bold text-right bg-transparent border-0 outline-none px-1 ${
                                  lowStock ? 'text-warning' : outStock ? 'text-danger' : 'text-text-1'
                                }`}
                              />
                            ) : <div className="w-full h-9" />}
                          </div>

                          {/* Unit Price */}
                          <div className="flex flex-col items-end justify-center px-2 border-r border-border/30">
                            {row.product ? (
                              <>
                                <input
                                  ref={el => { unitPriceRefs.current[row.rowKey] = el }}
                                  type="number"
                                  value={row.unitPrice || row.product.selling_price}
                                  onFocus={e => { rememberEditableTarget(e.target); e.target.select(); setFocusedRowKey(row.rowKey) }}
                                  onChange={e => {
                                    const v = parseFloat(e.target.value) || 0
                                    setRows(prev => prev.map(r => r.rowKey === row.rowKey ? { ...r, unitPrice: v, appliedTierId: null } : r))
                                  }}
                                  onKeyDown={e => handleUnitPriceKeyDown(row.rowKey, e)}
                                  className="w-full h-9 text-[12px] font-mono text-right bg-transparent border-0 outline-none px-1 text-text-2 focus:text-accent"
                                />
                                {(row.product.price_tiers?.length ?? 0) > 0 && (
                                  <button type="button" onClick={() => setTierDialogRow(row)}
                                    className={`text-[10px] px-1.5 py-0 rounded border leading-4 mt-0.5 transition-colors ${
                                      row.appliedTierId
                                        ? 'bg-accent/15 border-accent/30 text-accent'
                                        : 'bg-bg-hover border-border/60 text-text-3 hover:bg-bg-elevated'
                                    }`}>
                                    {row.appliedTierId ? 'Tier ▾' : 'Tiers'} <kbd className="text-[8px] font-mono opacity-60">^D</kbd>
                                  </button>
                                )}
                              </>
                            ) : <div className="w-full h-9" />}
                          </div>

                          {/* Charges */}
                          <div className="flex items-center justify-end px-2 border-r border-border/30">
                            {row.product && (
                              row.product.allow_additional_charges ? (
                                <button type="button"
                                  onClick={() => { setChargesRowKey(row.rowKey); setChargeAmount(String(row.additionalCharges || '')); setChargeNote(row.additionalChargesNote || '') }}
                                  className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold transition-colors ${
                                    row.additionalCharges > 0
                                      ? 'bg-warning/15 border-warning/30 text-warning'
                                      : 'bg-bg-hover border-border/60 text-text-3 hover:bg-bg-elevated'
                                  }`}>
                                  {row.additionalCharges > 0 ? `+${row.additionalCharges.toFixed(0)}` : '+ Chg'}
                                </button>
                              ) : (
                                <span className="text-[12px] font-mono text-text-2/60">
                                  {row.additionalCharges > 0 ? `Rs.${row.additionalCharges.toFixed(2)}` : '—'}
                                </span>
                              )
                            )}
                          </div>

                          {/* Line Disc */}
                          <div className="flex items-center justify-end px-3 border-r border-border/30">
                            <span className={`text-[12px] font-mono ${row.lineDiscount > 0 ? 'text-success' : 'text-text-2/40'}`}>
                              {row.product ? (row.lineDiscount > 0 ? `-${row.lineDiscount.toFixed(0)}` : '—') : ''}
                            </span>
                          </div>

                          {/* Line Total */}
                          <div className="flex items-center justify-end px-3 border-r border-border/30">
                            {row.product && (
                              <span className="text-[13px] font-bold font-mono text-text-1">
                                Rs.{lineTotal.toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Delete */}
                          <div className="flex items-center justify-center">
                            {row.product && (
                              <button type="button" onClick={() => removeRow(row.rowKey)}
                                className="w-7 h-7 flex items-center justify-center text-text-2/60 hover:text-danger hover:bg-danger/10 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Hint row */}
                    <div className="px-14 py-2.5 text-[11px] text-text-2/50 italic flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                      Press <kbd className="not-italic bg-bg-hover border border-border/60 px-1 rounded text-[10px] font-mono mx-0.5">F2</kbd>
                      or <kbd className="not-italic bg-bg-hover border border-border/60 px-1 rounded text-[10px] font-mono mx-0.5">Enter</kbd> after price to add next line
                    </div>
                  </>
                )}
              </div>

              {/* Table footer totals */}
              <div className="border-t-2 border-border/80 bg-bg-elevated flex-shrink-0">
                <div className="grid text-[12px]"
                  style={{ gridTemplateColumns: '44px 1fr 90px 120px 100px 80px 120px 44px' }}>
                  <div />
                  <div className="px-3 py-2 text-text-2 font-semibold">
                    {productRows.length > 0 ? `${productRows.length} line(s) · ${totalQty} qty` : 'No items'}
                  </div>
                  <div />
                  <div />
                  <div className="px-3 py-2 text-right font-semibold text-warning">
                    {totalCharges > 0 ? `Rs.${totalCharges.toFixed(2)}` : ''}
                  </div>
                  <div className="px-3 py-2 text-right font-semibold text-success">
                    {cartDiscount > 0 ? `-Rs.${cartDiscount.toFixed(2)}` : ''}
                  </div>
                  <div className="px-3 py-2 text-right font-bold text-[15px] text-text-1">
                    Rs.{grandTotal.toFixed(2)}
                  </div>
                  <div />
                </div>
              </div>
            </div>

            {/* RIGHT: Summary */}
            <div className="w-[270px] xl:w-[300px] flex-shrink-0 flex flex-col bg-bg-elevated">

              {/* Customer */}
              <div className="px-3 pt-3 pb-2.5 border-b border-border/50">
                <div className="text-[10px] font-bold text-text-2 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Customer <KBD>F6</KBD>
                </div>
                <button onClick={() => setShowCustomerPicker(true)}
                  className="w-full h-8 text-[12px] border border-border bg-bg-card rounded-lg px-3 text-left flex items-center gap-2 hover:border-accent/50 hover:bg-bg-hover transition-colors">
                  <Users className="h-3.5 w-3.5 text-text-3 flex-shrink-0" />
                  {selectedCustomer
                    ? <span className="flex-1 font-semibold text-text-1 truncate">{selectedCustomer.name}</span>
                    : <span className="text-text-3 flex-1">Walk-in Customer</span>
                  }
                  {selectedCustomer && (
                    <span role="button" tabIndex={0}
                      onClick={e => { e.stopPropagation(); setCustomer(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setCustomer(null) } }}
                      className="text-text-3 hover:text-danger ml-auto cursor-pointer">
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </button>
              </div>

              {/* Discount */}
              <div className="px-3 py-2.5 border-b border-border/50">
                <div className="text-[10px] font-bold text-text-2 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Percent className="h-3 w-3" /> Discount
                </div>
                <div className="flex gap-1.5">
                  {(['FIXED', 'PERCENTAGE'] as const).map(t => (
                    <button key={t} onClick={() => setDiscount(t, discountValue)}
                      className={`px-2.5 py-1.5 text-[11px] font-bold border rounded-lg transition-colors ${
                        discountType === t ? 'bg-accent border-accent/60 text-white' : 'bg-bg-card border-border text-text-3 hover:bg-bg-hover'
                      }`}>
                      {t === 'FIXED' ? 'Rs.' : '%'}
                    </button>
                  ))}
                  <input type="number" value={discountValue || ''}
                    onFocus={e => rememberEditableTarget(e.target)}
                    onChange={e => setDiscount(discountType, parseFloat(e.target.value) || 0)}
                    className="flex-1 h-9 text-[12px] border border-border bg-bg-card rounded-lg px-2 text-right text-text-1 focus:outline-none focus:border-accent/50" placeholder="0" />
                </div>
              </div>

              {/* Order summary */}
              <div className="px-3 py-2.5 border-b border-border/50 overflow-y-auto" style={{ maxHeight: '160px' }}>
                <div className="text-[10px] font-bold text-text-2 uppercase tracking-wider mb-2">Order Summary</div>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between text-text-2">
                    <span>Subtotal ({totalQty} items)</span>
                    <span className="font-mono">Rs.{subtotal.toFixed(2)}</span>
                  </div>
                  {totalCharges > 0 && (
                    <div className="flex justify-between text-warning">
                      <span>Charges</span>
                      <span className="font-mono">+ Rs.{totalCharges.toFixed(2)}</span>
                    </div>
                  )}
                  {cartDiscount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount {discountType === 'PERCENTAGE' ? `(${discountValue}%)` : '(Fixed)'}</span>
                      <span className="font-mono">- Rs.{cartDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {totalTax > 0 && (
                    <div className="flex justify-between text-text-2">
                      <span>Tax</span>
                      <span className="font-mono">Rs.{totalTax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="h-px bg-border/50 my-1" />
                  <div className="flex justify-between font-bold text-[17px]">
                    <span className="text-text-1">TOTAL</span>
                    <span className="font-mono text-accent">Rs.{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="px-3 py-2.5 border-b border-border/50 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowVirtualKeyboard(true)}
                  className="w-full h-9 rounded-lg border border-border bg-bg-card text-text-1 text-sm font-semibold hover:bg-bg-hover hover:border-accent/50 transition-colors flex items-center justify-center gap-2"
                >
                  <Keyboard className="h-4 w-4" /> Open Virtual Keyboard
                </button>
              </div>

              {/* Pay button */}
              <div className="p-3 flex-shrink-0">
                <button
                  onClick={triggerPayment}
                  disabled={productRows.length === 0 || !isDayOpen}
                  className="w-full h-12 rounded-xl text-white font-bold text-[15px] flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ background: 'linear-gradient(135deg, #5B8DF7, #7AA3FF)', boxShadow: '0 4px 20px rgba(91,141,247,0.4)' }}>
                  <CreditCard className="h-5 w-5" />
                  Pay Rs.{grandTotal.toFixed(2)}
                  <KBD>F5</KBD>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Item Catalog Modal (F3) ── */}
      {showCatalog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm animate-fade-in pt-16">
          <div className="bg-bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col animate-scale-in" style={{ maxHeight: '80vh' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
              <LayoutGrid className="h-5 w-5 text-accent" />
              <span className="font-bold text-text-1 text-base">Item Catalog</span>
              <span className="text-text-3 text-sm ml-1">— click to add to order</span>
              <div className="flex-1 mx-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" />
                <input ref={catalogSearchRef} type="text" value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="Search name, SKU, barcode…"
                  className="w-full bg-bg-elevated border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent/50"
                />
              </div>
              <button onClick={() => { setShowCatalog(false); focusEmptySearch(50) }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Category filter */}
            <div className="flex gap-2 px-5 py-3 border-b border-border flex-wrap flex-shrink-0">
              <button onClick={() => setCatalogCategory(null)}
                className={`px-3 py-1 rounded-full text-[12px] font-semibold border transition-colors ${
                  catalogCategory === null ? 'bg-accent border-accent/60 text-white' : 'border-border text-text-3 hover:bg-bg-elevated'
                }`}>
                All
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setCatalogCategory(catalogCategory === cat.id ? null : cat.id)}
                  className={`px-3 py-1 rounded-full text-[12px] font-semibold border transition-colors ${
                    catalogCategory === cat.id ? 'text-white border-transparent' : 'border-border text-text-3 hover:bg-bg-elevated'
                  }`}
                  style={catalogCategory === cat.id ? { backgroundColor: cat.color || '#5B8DF7', borderColor: cat.color || '#5B8DF7' } : {}}>
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Products grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {catalogProducts.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-text-3 text-sm">No products found</div>
              ) : (
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                  {catalogProducts.map(prod => (
                    <button key={prod.id} type="button" onClick={() => addFromCatalog(prod)}
                      disabled={prod.stock_qty <= 0}
                      className="text-left p-3 rounded-xl border border-border bg-bg-elevated hover:bg-bg-hover hover:border-accent/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: prod.category_color || '#565F7E' }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-text-1 text-[12px] leading-tight truncate">{prod.name}</div>
                          <div className="text-text-3 text-[10px] mt-0.5">{prod.category_name}</div>
                        </div>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="font-bold text-accent text-[13px]">Rs.{prod.selling_price.toFixed(2)}</div>
                          <div className={`text-[10px] font-semibold ${prod.stock_qty <= 0 ? 'text-danger' : prod.stock_qty <= 5 ? 'text-warning' : 'text-success'}`}>
                            {prod.stock_qty <= 0 ? 'Out of stock' : `${prod.stock_qty} in stock`}
                          </div>
                        </div>
                        <div className="text-text-3 text-[10px] font-mono">{prod.sku}</div>
                      </div>
                      {(prod.price_tiers?.length ?? 0) > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-warning">
                          <Layers className="h-3 w-3" />
                          <span>{prod.price_tiers.length} tier{prod.price_tiers.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <TransactionsModal
        open={showMyTransactions}
        mode="session"
        sessionId={daySession?.id ?? null}
        onClose={() => setShowMyTransactions(false)}
      />

      <TransactionsModal
        open={showAllTransactions}
        mode="all"
        onClose={() => setShowAllTransactions(false)}
      />

      {showVirtualKeyboard && (
        <div className="fixed left-0 right-0 bottom-0 z-[80] border-t border-border bg-bg-card/95 backdrop-blur-md shadow-[0_-18px_50px_rgba(0,0,0,0.45)] animate-slide-up">
          <div className="w-full max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between px-1 pb-2 border-b border-border/70 mb-3">
              <div className="flex items-center gap-2 text-text-1 font-semibold">
                <Keyboard className="h-4 w-4 text-accent" /> Virtual Keyboard (Docked)
              </div>
              <button
                type="button"
                onClick={() => setShowVirtualKeyboard(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {KEYBOARD_ROWS.map((row, idx) => (
                <div key={idx} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                  {row.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyVirtualKeyToFocusedInput(key)}
                      className={`h-11 rounded-lg border text-sm font-semibold transition-colors ${
                        key === '⌫'
                          ? 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/20'
                          : 'bg-bg-elevated border-border text-text-1 hover:bg-bg-hover'
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              ))}

              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr' }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyVirtualKeyToFocusedInput('Clear')}
                  className="h-11 rounded-lg border border-danger/30 bg-danger/10 text-danger text-sm font-semibold hover:bg-danger/20 transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyVirtualKeyToFocusedInput('.')}
                  className="h-11 rounded-lg border border-border bg-bg-elevated text-text-1 text-sm font-semibold hover:bg-bg-hover transition-colors"
                >
                  .
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyVirtualKeyToFocusedInput('Space')}
                  className="h-11 rounded-lg border border-border bg-bg-elevated text-text-1 text-sm font-semibold hover:bg-bg-hover transition-colors"
                >
                  Space
                </button>
                <button
                  type="button"
                  onClick={() => setShowVirtualKeyboard(false)}
                  className="h-11 rounded-lg border border-accent/40 bg-accent/15 text-accent text-sm font-semibold hover:bg-accent/25 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Charges Dialog ── */}
      {chargesRowKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-elevated border border-border rounded-2xl shadow-2xl w-full max-w-xs mx-4 animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Tag className="h-4 w-4 text-warning" />
                <span className="font-bold text-text-1 text-sm">Additional Charges</span>
              </div>
              <button onClick={() => setChargesRowKey(null)} className="w-8 h-8 rounded-xl flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-2 uppercase tracking-wider block mb-1.5">Amount (Rs.)</label>
                <input type="number" autoFocus value={chargeAmount} onChange={e => setChargeAmount(e.target.value)}
                  className="w-full bg-bg-card border border-border rounded-xl px-4 py-2.5 text-text-1 text-sm focus:outline-none focus:border-accent/50"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-2 uppercase tracking-wider block mb-1.5">Note</label>
                <input type="text" value={chargeNote} onChange={e => setChargeNote(e.target.value)}
                  className="w-full bg-bg-card border border-border rounded-xl px-4 py-2.5 text-text-1 text-sm focus:outline-none focus:border-accent/50"
                  placeholder="e.g. Delivery fee" />
              </div>
              {chargeTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chargeTypes.map(ct => (
                    <button key={ct.id} type="button"
                      onClick={() => { setChargeAmount(String(ct.default_amount)); setChargeNote(ct.name) }}
                      className="px-2.5 py-1 text-[11px] border border-border rounded-lg text-text-3 hover:bg-bg-hover hover:text-text-1 transition-colors">
                      {ct.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => {
                  const amt = parseFloat(chargeAmount) || 0
                  setRows(prev => prev.map(r => r.rowKey === chargesRowKey ? { ...r, additionalCharges: amt, additionalChargesNote: chargeNote } : r))
                  setChargesRowKey(null); setChargeAmount(''); setChargeNote('')
                }} className="flex-1 h-10 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl text-sm transition-colors">
                  Apply
                </button>
                <button onClick={() => {
                  setRows(prev => prev.map(r => r.rowKey === chargesRowKey ? { ...r, additionalCharges: 0, additionalChargesNote: '' } : r))
                  setChargesRowKey(null); setChargeAmount(''); setChargeNote('')
                }} className="px-4 h-10 border border-border text-text-2 hover:bg-bg-hover rounded-xl text-sm transition-colors">
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showDayModal    && <DaySessionModal />}
      {showPayment     && <PaymentModal />}
      {showCustomerPicker && <CustomerPicker initialMode={customerCreateMode ? 'create' : 'search'} />}
      {tierDialogRow && (() => {
        const cartItem: CartItem = {
          rowKey: tierDialogRow.rowKey,
          product: tierDialogRow.product!,
          qty: tierDialogRow.qty,
          unitPrice: tierDialogRow.unitPrice,
          appliedTierId: tierDialogRow.appliedTierId,
          additionalCharges: tierDialogRow.additionalCharges,
          additionalChargesNote: tierDialogRow.additionalChargesNote,
          lineDiscount: tierDialogRow.lineDiscount,
        }
        return (
          <TierDialog
            rowKey={tierDialogRow.rowKey}
            item={cartItem}
            onApply={(rowKey, tierId, price) => {
              setRows(prev => prev.map(r => r.rowKey === rowKey ? { ...r, unitPrice: price, appliedTierId: tierId } : r))
            }}
            onClose={() => setTierDialogRow(null)}
          />
        )
      })()}
      {showReceiptModal && <ReceiptModal onCreateJobCard={(txnId) => { setJobCardLinkTxnId(txnId); setJobCardLinkMode(true); setShowJobCard(true) }} />}
      {showPrinterSettings && (
        <PrinterSettingsModal onClose={() => setShowPrinterSettings(false)} />
      )}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {showJobCard && (
        <JobCardModal
          onClose={() => { setShowJobCard(false); setJobCardLinkTxnId(null); setJobCardLinkMode(false) }}
          posTransactionId={jobCardLinkTxnId ?? undefined}
          linkMode={jobCardLinkMode}
          onJobCardCreated={() => toast('success', 'Job card saved!')}
        />
      )}
      {showJobCardsList && <JobCardsListModal onClose={() => setShowJobCardsList(false)} />}

      <ToastContainer />
    </div>
  )
}
