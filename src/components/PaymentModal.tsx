import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  X, CreditCard, Banknote, Users, SplitSquareHorizontal,
  Loader2, Check, AlertTriangle, Search, Phone, Mail, UserCheck,
} from 'lucide-react'
import { usePOS, useAuth } from '../store'
import { computeTotals, fmtCurrency } from '../utils'
import { apiCreateTransaction, apiGetDaySession } from '../api'
import type { Customer } from '../types'

type PayMethod = 'CASH' | 'CARD' | 'BANK' | 'MIXED' | 'CREDIT'

// ── Card network logo based on last-4 first digit (heuristic) ─────────────────
function CardLogo({ last4 }: { last4: string }) {
  const d = last4[0] ?? ''
  if (d === '4') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">VISA</span>
  if (d === '5' || d === '2') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-600 text-white">MC</span>
  if (d === '3') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-700 text-white">AMEX</span>
  if (last4.length > 0) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-bg-card border border-border text-text-2">CARD</span>
  return null
}

// ── Inline customer search (for CREDIT mode) ──────────────────────────────────
function InlineCustomerPicker({
  customers,
  onSelect,
}: {
  customers: Customer[]
  onSelect: (c: Customer) => void
}) {
  const [search, setSearch] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return customers.slice(0, 10)
    const q = search.toLowerCase()
    return customers
      .filter(
        (c) =>
          (c.name ?? '').toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.email?.toLowerCase().includes(q),
      )
      .slice(0, 10)
  }, [customers, search])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => { setHighlighted(0) }, [search])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) onSelect(filtered[highlighted]) }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by name or phone… ↑↓ to navigate, Enter to select"
          className="w-full bg-bg-card border border-accent/50 rounded-xl pl-9 pr-4 py-2 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent"
        />
      </div>
      <div className="max-h-44 overflow-y-auto rounded-xl border border-border divide-y divide-border/50">
        {filtered.length === 0 ? (
          <p className="text-text-3 text-xs text-center py-4">No customers found</p>
        ) : (
          filtered.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all ${
                idx === highlighted ? 'bg-accent/15' : 'hover:bg-bg-hover'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
                {(c.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-1 truncate">{c.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {c.phone && <span className="flex items-center gap-1 text-[11px] text-text-3"><Phone className="w-3 h-3" />{c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1 text-[11px] text-text-3"><Mail className="w-3 h-3" />{c.email}</span>}
                </div>
              </div>
              {idx === highlighted && <UserCheck className="w-4 h-4 text-accent flex-shrink-0" />}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export function PaymentModal() {
  const {
    cartItems, selectedCustomer, discountType, discountValue,
    daySession, setDaySession, setShowPayment, clearCart,
    setLastReceipt, setShowReceiptModal, toast, customers,
    setCustomer,
  } = usePOS()
  const { user } = useAuth()

  const totals = useMemo(
    () => computeTotals(cartItems, discountType, discountValue),
    [cartItems, discountType, discountValue],
  )

  const [method, setMethod] = useState<PayMethod>('CASH')
  const [cashAmount, setCashAmount] = useState(totals.total.toFixed(2))
  const [cardAmount, setCardAmount] = useState(totals.total.toFixed(2))
  const [cardLast4, setCardLast4] = useState('')
  const [creditAmount, setCreditAmount] = useState(totals.total.toFixed(2))
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  // Credit: inline customer selection (separate from cart customer)
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(
    selectedCustomer && selectedCustomer.id !== 0 ? selectedCustomer : null
  )
  const [showCreditPicker, setShowCreditPicker] = useState(false)

  const cashRef  = useRef<HTMLInputElement>(null)
  const cardRef  = useRef<HTMLInputElement>(null)
  const last4Ref = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // ── Focus helper: jump to the right input for a given method ───────────────
  const focusForMethod = useCallback((m: PayMethod) => {
    setTimeout(() => {
      if (m === 'CASH' || m === 'MIXED') {
        cashRef.current?.focus(); cashRef.current?.select()
      } else if (m === 'CARD' || m === 'BANK') {
        cardRef.current?.focus(); cardRef.current?.select()
      }
      // CREDIT: picker opens, focus is handled inside InlineCustomerPicker
    }, 30)
  }, [])

  // ── On mount: focus the modal container so keyboard shortcuts are captured ──
  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  // ── When method changes: only reset amounts (no auto-focus) ───────────────
  useEffect(() => {
    if (method === 'CASH') {
      setCashAmount(totals.total.toFixed(2))
    } else if (method === 'CARD' || method === 'BANK') {
      setCardAmount(totals.total.toFixed(2))
    } else if (method === 'CREDIT') {
      setCreditAmount(totals.total.toFixed(2))
      if (!creditCustomer) setShowCreditPicker(true)
    } else if (method === 'MIXED') {
      setCashAmount(totals.total.toFixed(2))
      setCardAmount('')
      setCreditAmount('')
    }
  }, [method]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ─────────────────────────────────────────────────────────
  const cashNum    = parseFloat(cashAmount) || 0
  const cardNum    = parseFloat(cardAmount) || 0
  const creditNum  = parseFloat(creditAmount) || 0
  const change     = method === 'CASH' ? Math.max(0, cashNum - totals.total) : 0
  const mixedPaid  = cashNum + cardNum
  const mixedBalance = totals.total - mixedPaid - creditNum
  const isCardMethod = method === 'CARD' || method === 'BANK'

  function validate(): string | null {
    if (!daySession) return 'Day session not open'
    if (!user) return 'User not authenticated'
    if (method === 'CASH') {
      if (cashNum < totals.total) return `Cash must be at least ${fmtCurrency(totals.total)}`
    } else if (isCardMethod) {
      if (Math.abs(cardNum - totals.total) > 0.01) return `Amount must equal ${fmtCurrency(totals.total)}`
    } else if (method === 'CREDIT') {
      if (!creditCustomer) return 'Please select a customer for credit sales'
    } else if (method === 'MIXED') {
      if (mixedBalance > 0.01) return `Remaining balance: ${fmtCurrency(mixedBalance)}`
    }
    return null
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (method === 'CREDIT' && !creditCustomer) {
      setShowCreditPicker(true)
      toast('error', 'Select a customer to process credit sale')
      return
    }
    const err = validate()
    if (err) { toast('error', err); return }
    setProcessing(true)
    try {
      const customerForSale = method === 'CREDIT' ? creditCustomer : selectedCustomer
      const items = cartItems.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        sku: item.product.sku,
        quantity: item.qty,
        unit_price: item.unitPrice,
        original_price: item.product.selling_price,
        discount_amount: item.lineDiscount,
        additional_charges: item.additionalCharges,
        additional_charges_note: item.additionalChargesNote,
        tax_rate: item.product.tax_rate || 0,
      }))

      // For credit customers, ensure a non-null identifier even if name is null in DB
      const resolvedName = customerForSale
        ? customerForSale.name || customerForSale.company || customerForSale.email || `Customer #${customerForSale.id}`
        : null
      const result = await apiCreateTransaction({
        session_id: daySession!.id,
        customer_id: customerForSale?.id ?? null,
        customer_name: resolvedName,
        customer_phone: customerForSale?.phone || null,
        items,
        discount_type: discountType,
        discount_value: discountValue,
        payment_method: method,
        cash_amount:   method === 'CASH'   ? cashNum : method === 'MIXED' ? cashNum : 0,
        card_amount:   isCardMethod        ? cardNum : method === 'MIXED' ? cardNum : 0,
        credit_amount: method === 'CREDIT' ? totals.total : method === 'MIXED' ? creditNum : 0,
        notes: [
          notes,
          isCardMethod && cardLast4 ? `Card ****${cardLast4}` : '',
        ].filter(Boolean).join(' | '),
        created_by: user!.id,
      })

      try {
        const refreshed = await apiGetDaySession(user?.id)
        setDaySession(refreshed.session, refreshed.is_open)
      } catch { /* non-critical */ }

      if (method === 'CREDIT' && creditCustomer) setCustomer(creditCustomer)

      // Enrich the API result with line items and metadata so the receipt
      // can print them immediately — the API response only returns summary totals.
      const paidAmt = method === 'CREDIT' ? 0 : totals.total
      const changeAmt = method === 'CASH' ? Math.max(0, cashNum - totals.total) : 0
      const balanceAmt = method === 'CREDIT' ? totals.total : 0

      setLastReceipt({
        transaction_id: (result as any)?.transaction_id,
        transaction_number: (result as any)?.transaction_number || '',
        total_amount: totals.total,
        paid_amount: paidAmt,
        change_amount: changeAmt,
        balance_due: balanceAmt,
        payment_method: method,
        cash_amount: cashNum,
        card_amount: cardNum,
        customer_name: resolvedName,
        created_at: new Date().toISOString(),
        items: cartItems.map((item) => ({
          product_name: item.product.name,
          quantity: item.qty,
          unit_price: item.unitPrice,
          line_total: item.qty * item.unitPrice - item.lineDiscount + item.additionalCharges,
        })),
      })
      clearCart()
      setShowPayment(false)
      setShowReceiptModal(true)
      toast('success', 'Sale completed successfully!')
    } catch (err: any) {
      toast('error', err.message || 'Failed to process payment')
    } finally {
      setProcessing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, creditCustomer, cashNum, cardNum, creditNum, cardLast4, notes, cartItems,
      daySession, discountType, discountValue, selectedCustomer, totals.total, user])

  // ── Global keyboard shortcuts (capture phase to intercept before background inputs) ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const activeEl = document.activeElement as HTMLElement
      const tag = activeEl?.tagName?.toUpperCase()
      // Is focus inside the modal itself?
      const inModalInput = (tag === 'INPUT' || tag === 'TEXTAREA') && !!modalRef.current?.contains(activeEl)
      // Is focus trapped in a background input (e.g. product search)?
      const inBackgroundInput = (tag === 'INPUT' || tag === 'TEXTAREA') && !modalRef.current?.contains(activeEl)

      // Block ALL keystrokes from reaching background inputs while this modal is open
      if (inBackgroundInput) {
        e.stopPropagation()
        e.preventDefault()
      }

      // ESC → close credit picker first, then modal
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        if (showCreditPicker) { setShowCreditPicker(false); return }
        setShowPayment(false); return
      }

      // Enter → confirm sale when not typing in a modal textarea
      if (e.key === 'Enter' && !showCreditPicker && !processing && tag !== 'TEXTAREA') {
        e.preventDefault(); e.stopPropagation()
        handleSubmit(); return
      }

      // Block F5 from triggering a browser page-reload while the modal is open
      if (e.key === 'F5') {
        e.preventDefault(); e.stopPropagation()
        // F5 = shortcut to open this modal; once open, treat it as selecting CREDIT (5th method)
        if (!inModalInput && !showCreditPicker) {
          setMethod('CREDIT')
          focusForMethod('CREDIT')
        }
        return
      }

      // 1–5: select payment method when NOT in a modal input field
      if (!inModalInput && !showCreditPicker) {
        const map: Record<string, PayMethod> = { '1': 'CASH', '2': 'CARD', '3': 'BANK', '4': 'MIXED', '5': 'CREDIT' }
        if (map[e.key]) {
          e.preventDefault(); e.stopPropagation()
          setMethod(map[e.key])
          focusForMethod(map[e.key])
          return
        }
      }

      // Tab when not in a modal input → jump to the amount field
      if (e.key === 'Tab' && !inModalInput) {
        e.preventDefault()
        focusForMethod(method)
      }
    }
    // capture:true → fires before the event reaches any background element
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [showCreditPicker, processing, handleSubmit, method, setShowPayment, focusForMethod])

  // ── Numpad ─────────────────────────────────────────────────────────────────
  function handleNumpad(val: string) {
    const setter = method === 'CASH' ? setCashAmount : isCardMethod ? setCardAmount : setCreditAmount
    const current = method === 'CASH' ? cashAmount : isCardMethod ? cardAmount : creditAmount
    if (val === 'C') { setter(''); return }
    if (val === '⌫') { setter(current.slice(0, -1)); return }
    if (val === '.' && current.includes('.')) return
    setter(current + val)
  }

  const METHODS: { key: PayMethod; label: string; shortcut: string; icon: React.ReactNode }[] = [
    { key: 'CASH',   label: 'Cash',   shortcut: '1', icon: <Banknote className="w-4 h-4" /> },
    { key: 'CARD',   label: 'Card',   shortcut: '2', icon: <CreditCard className="w-4 h-4" /> },
    { key: 'BANK',   label: 'Bank',   shortcut: '3', icon: <CreditCard className="w-4 h-4 opacity-70" /> },
    { key: 'MIXED',  label: 'Mixed',  shortcut: '4', icon: <SplitSquareHorizontal className="w-4 h-4" /> },
    { key: 'CREDIT', label: 'Credit', shortcut: '5', icon: <Users className="w-4 h-4" /> },
  ]

  const NUMPAD = ['7','8','9','4','5','6','1','2','3','C','0','⌫','.']
  const displayAmount = isCardMethod ? cardAmount : cashAmount

  return (
    <div
      ref={modalRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in focus:outline-none"
    >
      <div className="relative bg-bg-elevated border border-border rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] w-full max-w-2xl mx-4 animate-scale-in overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-text-1 font-bold text-lg leading-none">Process Payment</h2>
              <p className="text-text-3 text-xs mt-0.5">
                {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
                {(method === 'CREDIT' ? creditCustomer : selectedCustomer) && (
                  <> · {(method === 'CREDIT' ? creditCustomer : selectedCustomer)!.name}</>
                )}
                <span className="ml-2 opacity-50">[Esc] close · [Enter] confirm · [1–5] method</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPayment(false)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex">
          {/* ── Left panel ── */}
          <div className="flex-1 p-6 border-r border-border space-y-4 overflow-y-auto max-h-[70vh]">

            {/* Order summary */}
            <div>
              <p className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-3">Order Summary</p>
              <div className="space-y-1.5">
                <SummaryRow label="Subtotal" value={totals.subtotal} />
                {totals.discountAmount > 0 && <SummaryRow label="Discount" value={-totals.discountAmount} color="text-danger" />}
                {totals.taxAmount > 0 && <SummaryRow label="Tax" value={totals.taxAmount} />}
                {totals.additionalChargesTotal > 0 && <SummaryRow label="Charges" value={totals.additionalChargesTotal} />}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className="text-text-1 font-bold text-lg">Total Due</span>
                <span className="text-accent font-bold text-2xl">{fmtCurrency(totals.total)}</span>
              </div>
            </div>

            {/* Payment method buttons */}
            <div>
              <p className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-2">
                Payment Method <span className="text-text-3 font-normal normal-case opacity-60">(press 1–5 to switch)</span>
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {METHODS.map(({ key, label, shortcut, icon }) => (
                  <button
                    key={key}
                    onClick={() => { setMethod(key); focusForMethod(key) }}
                    className={`relative flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all
                      ${method === key
                        ? 'bg-accent text-white border-accent shadow-[0_2px_12px_rgba(91,141,247,0.4)]'
                        : 'bg-bg-card text-text-2 border-border hover:border-border-strong hover:bg-bg-hover'
                      }`}
                  >
                    <span className="absolute top-1 right-1.5 text-[9px] opacity-60 font-mono">{shortcut}</span>
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>

            {/* CASH */}
            {method === 'CASH' && (
              <div>
                <label className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-1.5 block">Cash Received (Rs.)</label>
                <input
                  ref={cashRef}
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full bg-bg-card border border-border rounded-xl px-4 py-2.5 text-text-1 text-xl font-bold text-right focus:outline-none focus:border-accent/50"
                />
              </div>
            )}

            {/* CARD / BANK */}
            {isCardMethod && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-1.5 block">
                    {method === 'BANK' ? 'Bank Transfer Amount (Rs.)' : 'Card Amount (Rs.)'}
                  </label>
                  <input
                    ref={cardRef}
                    type="number"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                    onKeyDown={(e) => {
                      // Tab from card amount → jump to last-4 field (CARD mode only)
                      if (e.key === 'Tab' && method === 'CARD') {
                        e.preventDefault()
                        last4Ref.current?.focus(); last4Ref.current?.select()
                      }
                    }}
                    className="w-full bg-bg-card border border-border rounded-xl px-4 py-2.5 text-text-1 text-xl font-bold text-right focus:outline-none focus:border-accent/50"
                  />
                </div>
                {method === 'CARD' && (
                  <div>
                    <label className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                      Last 4 Digits <span className="font-normal opacity-60">(optional)</span>
                      <CardLogo last4={cardLast4} />
                    </label>
                    <input
                      ref={last4Ref}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={cardLast4}
                      onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="e.g. 4512"
                      className="w-full bg-bg-card border border-border rounded-xl px-4 py-2 text-text-1 text-lg font-mono text-center focus:outline-none focus:border-accent/50 tracking-widest"
                    />
                    <p className="text-[10px] text-text-3 mt-1 text-center">
                      Visa = 4… · Mastercard = 5… or 2… · Amex = 3…
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* MIXED */}
            {method === 'MIXED' && (
              <div className="space-y-2">
                <InputRow label="Cash (Rs.)" value={cashAmount} onChange={setCashAmount} inputRef={cashRef} />
                <InputRow label="Card (Rs.)" value={cardAmount} onChange={setCardAmount} inputRef={cardRef} />
                <InputRow label="Credit (Rs.)" value={creditAmount} onChange={setCreditAmount} />
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-bg-card border border-border">
                  <span className="text-xs text-text-2">Balance Remaining</span>
                  <span className={`text-sm font-bold ${mixedBalance > 0.01 ? 'text-danger' : 'text-success'}`}>
                    {fmtCurrency(mixedBalance)}
                  </span>
                </div>
              </div>
            )}

            {/* CREDIT */}
            {method === 'CREDIT' && (
              <div className="space-y-3">
                {!creditCustomer && (
                  <div className="p-3 rounded-xl bg-warning/8 border border-warning/20 text-xs text-warning flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Walk-in customers cannot use credit. A registered customer is required.
                  </div>
                )}

                {creditCustomer ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-success/8 border border-success/20">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-success/20 flex items-center justify-center text-sm font-bold text-success">
                        {(creditCustomer.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-1">{creditCustomer.name || '—'}</p>
                        {creditCustomer.phone && (
                          <p className="text-[11px] text-text-3 flex items-center gap-1"><Phone className="w-3 h-3" />{creditCustomer.phone}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setCreditCustomer(null); setShowCreditPicker(true) }}
                      className="text-xs text-text-3 hover:text-text-1 px-2 py-1 rounded-lg hover:bg-bg-hover transition-all"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreditPicker(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-accent/40 text-accent text-sm font-semibold hover:bg-accent/5 transition-all"
                  >
                    <Users className="w-4 h-4" /> Select Customer
                    <span className="text-accent/60 text-xs font-normal">(or press Enter)</span>
                  </button>
                )}

                {showCreditPicker && (
                  <InlineCustomerPicker
                    customers={customers}
                    onSelect={(c) => { setCreditCustomer(c); setShowCreditPicker(false) }}
                  />
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-text-3 uppercase tracking-wider">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add a note to this sale…"
                className="mt-1.5 w-full bg-bg-card border border-border rounded-xl px-3 py-2 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/50 resize-none"
              />
            </div>
          </div>

          {/* ── Right panel: Numpad ── */}
          <div className="w-52 p-4 flex flex-col gap-3">
            {/* Amount display */}
            <div className="bg-bg-primary rounded-2xl p-4 text-right border border-border">
              <p className="text-[10px] text-text-3 mb-1">
                {method === 'CASH' ? 'Cash received' : isCardMethod ? (method === 'BANK' ? 'Bank transfer' : 'Card amount') : method === 'CREDIT' ? 'Credit (full total)' : 'Amount'}
              </p>
              <p className="text-2xl font-bold text-text-1 font-mono">
                {method === 'CREDIT' ? fmtCurrency(totals.total) : (displayAmount || '0.00')}
              </p>
              {method === 'CASH' && (
                <p className={`text-sm font-semibold mt-2 ${change >= 0 ? 'text-success' : 'text-danger'}`}>
                  Change: {fmtCurrency(change)}
                </p>
              )}
            </div>

            {/* Numpad */}
            {method !== 'CREDIT' && method !== 'MIXED' && (
              <div className="grid grid-cols-3 gap-2">
                {NUMPAD.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleNumpad(key)}
                    className={`h-10 rounded-xl text-sm font-bold transition-all active:scale-95
                      ${key === 'C' ? 'bg-danger/15 text-danger border border-danger/25 hover:bg-danger/25'
                        : key === '⌫' ? 'bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20'
                        : 'bg-bg-card text-text-1 border border-border hover:bg-bg-hover hover:border-border-strong'
                      }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            )}

            {/* Quick amounts (cash only) */}
            {method === 'CASH' && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-text-3 text-center">Quick amounts</p>
                {[totals.total, Math.ceil(totals.total / 500) * 500, Math.ceil(totals.total / 1000) * 1000]
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .slice(0, 3)
                  .map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCashAmount(amt.toFixed(2))}
                      className="w-full py-1.5 rounded-lg bg-bg-card border border-border text-text-2 text-xs font-medium hover:text-text-1 hover:border-border-strong hover:bg-bg-hover transition-all"
                    >
                      {fmtCurrency(amt)}
                    </button>
                  ))}
              </div>
            )}

            {/* Keyboard shortcut hint */}
            <div className="mt-auto pt-2 border-t border-border/50 space-y-0.5">
              {METHODS.map((m) => (
                <div key={m.key} className={`flex items-center gap-2 text-[10px] ${method === m.key ? 'text-accent font-bold' : 'text-text-3'}`}>
                  <span className="w-4 h-4 rounded bg-bg-card border border-border flex items-center justify-center font-mono text-[9px]">{m.shortcut}</span>
                  {m.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          <button
            onClick={() => setShowPayment(false)}
            className="px-5 py-3 rounded-xl border border-border text-text-2 font-semibold text-sm hover:bg-bg-hover hover:text-text-1 transition-all"
          >
            Cancel <span className="text-text-3 font-normal text-xs ml-1">[Esc]</span>
          </button>
          <button
            onClick={handleSubmit}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-accent to-blue-500 text-white font-bold text-sm hover:from-accent-hover hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(91,141,247,0.4)]"
          >
            {processing ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
            ) : (
              <><Check className="w-4 h-4" />Confirm Sale · {fmtCurrency(totals.total)}<span className="text-white/60 font-normal text-xs ml-1">[Enter]</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-2">{label}</span>
      <span className={`text-xs font-semibold ${color || 'text-text-1'}`}>
        {value < 0 ? '- ' : ''}{fmtCurrency(Math.abs(value))}
      </span>
    </div>
  )
}

function InputRow({
  label, value, onChange, inputRef,
}: {
  label: string; value: string; onChange: (v: string) => void
  inputRef?: React.RefObject<HTMLInputElement>
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-text-2 w-24 flex-shrink-0">{label}</label>
      <input
        ref={inputRef}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-bg-card border border-border rounded-lg px-3 py-1.5 text-text-1 text-sm text-right focus:outline-none focus:border-accent/50"
      />
    </div>
  )
}
