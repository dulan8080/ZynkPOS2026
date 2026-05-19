import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CreditCard, FileText, Loader2, Printer, Search, Undo2, Users, X, Link2, ClipboardList, Plus } from 'lucide-react'
import { apiCreateAuditLog, apiGetTransactionDetail, apiGetTransactions, apiRefundTransaction, apiGetPlasticLaserJobCards, apiGetEventProJobCards } from '../api'
import { useAuth, usePOS } from '../store'
import { fmtCurrency, fmtDateTime } from '../utils'
import { printDotMatrixReceipt, printWithWindowsPrinter } from '../utils/printDotMatrix'
import type { Transaction, TransactionItem } from '../types'
import { JobCardModal } from './JobCardModal'

interface TransactionsModalProps {
  open: boolean
  mode: 'session' | 'all'
  sessionId?: number | null
  onClose: () => void
}

interface FiltersState {
  search: string
  status: string
  paymentMethod: string
  dateFrom: string
  dateTo: string
}

export function TransactionsModal({ open, mode, sessionId, onClose }: TransactionsModalProps) {
  const { user, apiBase } = useAuth()
  const { toast } = usePOS()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedItems, setSelectedItems] = useState<TransactionItem[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [managerPassword, setManagerPassword] = useState('')
  const [refunding, setRefunding] = useState(false)
  const [filters, setFilters] = useState<FiltersState>({
    search: '',
    status: '',
    paymentMethod: '',
    dateFrom: '',
    dateTo: '',
  })

  // Job card linking state
  const [linkedJobCards, setLinkedJobCards] = useState<{ type: 'pl' | 'ep'; data: any }[]>([])
  const [jobCardLoading, setJobCardLoading] = useState(false)
  const [showJobCardModal, setShowJobCardModal] = useState(false)
  const [jobCardDetail, setJobCardDetail] = useState<{ type: 'pl' | 'ep'; data: any } | null>(null)

  useEffect(() => {
    if (!open) return
    setPage(1)
    setSelectedId(null)
    setSelectedTransaction(null)
    setSelectedItems([])
    setLinkedJobCards([])
    setJobCardDetail(null)
    setFilters({
      search: '',
      status: '',
      paymentMethod: '',
      dateFrom: '',
      dateTo: '',
    })
    setSearchInput('')
    setShowRefundDialog(false)
    setRefundReason('')
    setManagerPassword('')
  }, [open, mode, sessionId])

  useEffect(() => {
    if (!open) return
    if (mode === 'session' && !sessionId) {
      setTransactions([])
      setTotal(0)
      return
    }

    let cancelled = false

    async function loadTransactions() {
      setLoading(true)
      try {
        const result = await apiGetTransactions({
          page,
          limit: 50,
          session_id: mode === 'session' ? sessionId ?? undefined : undefined,
          status: filters.status || undefined,
          payment_method: filters.paymentMethod || undefined,
          date_from: mode === 'all' ? filters.dateFrom || undefined : undefined,
          date_to: mode === 'all' ? filters.dateTo || undefined : undefined,
          search: filters.search || undefined,
        })

        if (cancelled) return

        setTransactions(result.transactions)
        setTotal(result.total)
        const nextSelected = result.transactions[0]?.id ?? null
        setSelectedId(prev => (prev && result.transactions.some(tx => tx.id === prev) ? prev : nextSelected))
      } catch (err: any) {
        if (!cancelled) {
          toast('error', err?.message || 'Failed to load transactions.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadTransactions()
    return () => { cancelled = true }
  }, [open, mode, sessionId, page, filters, refreshTick])

  useEffect(() => {
    if (!open || !selectedId) {
      setSelectedTransaction(null)
      setSelectedItems([])
      return
    }

    const detailId = selectedId

    let cancelled = false

    async function loadDetail() {
      setDetailLoading(true)
      try {
        const result = await apiGetTransactionDetail(detailId)
        if (cancelled) return
        setSelectedTransaction(result.transaction)
        setSelectedItems(result.items || [])
      } catch (err: any) {
        if (!cancelled) {
          toast('error', err?.message || 'Failed to load transaction details.')
          setSelectedTransaction(null)
          setSelectedItems([])
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }

    loadDetail()
    return () => { cancelled = true }
  }, [open, selectedId, refreshTick])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 50)), [total])

  // Fetch job cards linked to selected transaction
  useEffect(() => {
    if (!selectedId) { setLinkedJobCards([]); return }
    let cancelled = false
    async function loadCards() {
      setJobCardLoading(true)
      try {
        const [pl, ep] = await Promise.all([
          apiGetPlasticLaserJobCards({ transaction_id: selectedId! }),
          apiGetEventProJobCards({ transaction_id: selectedId! }),
        ])
        if (!cancelled) {
          setLinkedJobCards([
            ...(pl.data || []).map((d: any) => ({ type: 'pl' as const, data: d })),
            ...(ep.data || []).map((d: any) => ({ type: 'ep' as const, data: d })),
          ])
        }
      } catch { /* ignore */ }
      if (!cancelled) setJobCardLoading(false)
    }
    loadCards()
    return () => { cancelled = true }
  }, [selectedId, refreshTick])

  function applySearch() {
    setPage(1)
    setFilters(prev => ({ ...prev, search: searchInput.trim() }))
  }

  async function handleRefund() {
    if (!selectedTransaction || !user) return
    if (selectedTransaction.status !== 'COMPLETED') {
      toast('error', 'Only completed transactions can be refunded.')
      return
    }
    if (!managerPassword.trim()) {
      toast('error', 'Manager or Admin password is required for refund.')
      return
    }

    setRefunding(true)
    try {
      console.info('[RefundModal] Starting refund', {
        transactionId: selectedTransaction.id,
        transactionNumber: selectedTransaction.transaction_number,
        userId: user.id,
        reason: refundReason.trim() || 'Refund approved from POS',
        hasManagerPassword: Boolean(managerPassword.trim()),
      })

      await apiRefundTransaction({
        transaction_id: selectedTransaction.id,
        reason: refundReason.trim() || 'Refund approved from POS',
        manager_password: managerPassword,
        refunded_by: user.id,
      })

      try {
        await apiCreateAuditLog({
          event_type: 'TRANSACTION_REFUND',
          action: 'REFUND',
          entity_type: 'TRANSACTION',
          entity_id: selectedTransaction.id,
          actor_id: user.id,
          metadata: {
            transaction_number: selectedTransaction.transaction_number,
            refund_reason: refundReason.trim() || 'Refund approved from POS',
          },
        })
      } catch {
        // Refund success should not fail because audit log endpoint is unavailable.
      }

      console.info('[RefundModal] Refund completed', {
        transactionId: selectedTransaction.id,
        transactionNumber: selectedTransaction.transaction_number,
      })

      toast('success', 'Refund completed. Stock should be restored by backend logic.')
      setShowRefundDialog(false)
      setRefundReason('')
      setManagerPassword('')
      setRefreshTick(t => t + 1)
    } catch (err: any) {
      console.error('[RefundModal] Refund failed', {
        transactionId: selectedTransaction.id,
        transactionNumber: selectedTransaction.transaction_number,
        error: err?.message || err,
      })
      toast('error', err?.message || 'Refund failed.')
    } finally {
      setRefunding(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full h-full max-w-7xl bg-bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-bg-elevated flex-shrink-0">
          <FileText className="h-5 w-5 text-accent" />
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-text-1">
              {mode === 'session' ? 'Current Session Transactions' : 'All Transactions'}
            </div>
            <div className="text-xs text-text-3">
              {mode === 'session'
                ? 'Shows only the active POS session transactions for the current day start.'
                : 'Defaults to today for all users, with filters to open any date range.'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-border bg-bg-primary/30 flex flex-wrap gap-2 flex-shrink-0">
          <label className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applySearch()
                }
              }}
              placeholder="Search number or customer..."
              className="w-full h-10 rounded-xl border border-border bg-bg-card pl-9 pr-3 text-sm text-text-1 focus:outline-none focus:border-accent/50"
            />
          </label>

          <button
            type="button"
            onClick={applySearch}
            className="h-10 px-4 rounded-xl border border-accent/40 bg-accent/15 text-accent text-sm font-semibold hover:bg-accent/25 transition-colors flex items-center gap-1.5"
          >
            <Search className="h-4 w-4" /> Search
          </button>

          <select
            value={filters.status}
            onChange={(e) => { setPage(1); setFilters(prev => ({ ...prev, status: e.target.value })) }}
            className="h-10 rounded-xl border border-border bg-bg-card px-3 text-sm text-text-1 focus:outline-none focus:border-accent/50"
          >
            <option value="">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="VOIDED">Voided</option>
            <option value="PENDING">Pending</option>
          </select>

          <select
            value={filters.paymentMethod}
            onChange={(e) => { setPage(1); setFilters(prev => ({ ...prev, paymentMethod: e.target.value })) }}
            className="h-10 rounded-xl border border-border bg-bg-card px-3 text-sm text-text-1 focus:outline-none focus:border-accent/50"
          >
            <option value="">All Payments</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="MIXED">Mixed</option>
            <option value="CREDIT">Credit</option>
          </select>

          {mode === 'all' && (
            <>
              <label className="flex items-center gap-2 h-10 rounded-xl border border-border bg-bg-card px-3 text-sm text-text-2">
                <CalendarDays className="h-4 w-4 text-text-3" />
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => { setPage(1); setFilters(prev => ({ ...prev, dateFrom: e.target.value })) }}
                  className="bg-transparent outline-none text-text-1"
                />
              </label>
              <label className="flex items-center gap-2 h-10 rounded-xl border border-border bg-bg-card px-3 text-sm text-text-2">
                <CalendarDays className="h-4 w-4 text-text-3" />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => { setPage(1); setFilters(prev => ({ ...prev, dateTo: e.target.value })) }}
                  className="bg-transparent outline-none text-text-1"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[1.25fr,0.95fr]">
          <div className="min-h-0 flex flex-col border-r border-border">
            <div className="grid grid-cols-[180px,1fr,110px,110px,120px] gap-3 px-5 py-3 text-[10px] uppercase tracking-wider text-text-3 font-bold border-b border-border bg-bg-primary/40 flex-shrink-0">
              <span>Transaction</span>
              <span>Customer</span>
              <span className="text-right">Method</span>
              <span className="text-right">Status</span>
              <span className="text-right">Amount</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="h-full flex items-center justify-center text-text-3">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading transactions...
                </div>
              ) : transactions.length === 0 ? (
                <div className="h-full flex items-center justify-center text-text-3 text-sm px-6 text-center">
                  {mode === 'session' && !sessionId ? 'Start a day session first to view current-session transactions.' : 'No transactions matched the current filters.'}
                </div>
              ) : (
                transactions.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setSelectedId(tx.id)}
                    className={`w-full grid grid-cols-[180px,1fr,110px,110px,120px] gap-3 px-5 py-3 text-left border-b border-border/40 transition-colors ${
                      selectedId === tx.id ? 'bg-accent/10' : 'hover:bg-bg-hover'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-text-1">{tx.transaction_number}</div>
                      <div className="text-[11px] text-text-3">{fmtDateTime(tx.created_at)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-text-1 truncate">{tx.customer_name || 'Walk-in Customer'}</div>
                      <div className="text-[11px] text-text-3 truncate">{tx.created_by_name || 'Unknown user'}</div>
                    </div>
                    <div className="text-right text-sm text-text-2">{tx.payment_method}</div>
                    <div className={`text-right text-sm font-semibold ${tx.status === 'VOIDED' || tx.status === 'REFUNDED' ? 'text-danger' : tx.status === 'PENDING' ? 'text-warning' : 'text-success'}`}>
                      {tx.status}
                    </div>
                    <div className="text-right text-sm font-bold text-text-1">{fmtCurrency(tx.total_amount)}</div>
                  </button>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-border bg-bg-primary/30 flex items-center justify-between text-sm flex-shrink-0">
              <span className="text-text-3">{total} transaction(s)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="px-3 h-9 rounded-lg border border-border bg-bg-card text-text-1 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-text-2">Page {page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="px-3 h-9 rounded-lg border border-border bg-bg-card text-text-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex flex-col bg-bg-elevated/50">
            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-text-3">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading detail...
              </div>
            ) : selectedTransaction ? (
              <>
                <div className="px-5 py-4 border-b border-border space-y-3 flex-shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-text-1">{selectedTransaction.transaction_number}</div>
                      <div className="text-sm text-text-3">{fmtDateTime(selectedTransaction.created_at)}</div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      selectedTransaction.status === 'REFUNDED' ? 'bg-danger/10 text-danger border border-danger/30'
                      : selectedTransaction.status === 'VOIDED'    ? 'bg-danger/10 text-danger'
                      : selectedTransaction.status === 'PENDING'   ? 'bg-warning/10 text-warning'
                      : 'bg-success/10 text-success'
                    }`}>
                      {selectedTransaction.status}
                    </div>
                  </div>

                  {/* Refund info panel */}
                  {selectedTransaction.status === 'REFUNDED' && (
                    <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-danger text-xs font-bold uppercase tracking-wide">
                        <Undo2 className="h-3.5 w-3.5" /> Refund Record
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <span className="text-text-3 text-xs">Authorised By</span>
                          <div className="text-text-1 font-semibold">
                            {selectedTransaction.refunded_by_name || (selectedTransaction.refunded_by ? `User #${selectedTransaction.refunded_by}` : 'Unknown')}
                          </div>
                        </div>
                        <div>
                          <span className="text-text-3 text-xs">Refunded At</span>
                          <div className="text-text-1 font-semibold">
                            {selectedTransaction.refunded_at ? fmtDateTime(selectedTransaction.refunded_at) : '—'}
                          </div>
                        </div>
                      </div>
                      {selectedTransaction.refund_reason && (
                        <div>
                          <span className="text-text-3 text-xs">Reason</span>
                          <div className="text-text-2 text-sm mt-0.5">{selectedTransaction.refund_reason}</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowRefundDialog(true)}
                      disabled={selectedTransaction.status !== 'COMPLETED'}
                      className="h-9 px-3 rounded-lg border border-danger/35 bg-danger/10 text-danger text-sm font-semibold hover:bg-danger/20 transition-colors disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Undo2 className="h-4 w-4" /> Refund Transaction
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const { selectedPrinter } = useAuth.getState()
                          const tx = {
                            transaction_number: selectedTransaction.transaction_number,
                            customer_name: selectedTransaction.customer_name,
                            created_at: selectedTransaction.created_at,
                            items: selectedItems.map((item) => ({
                              product_name: item.product_name,
                              quantity: item.quantity,
                              unit_price: item.unit_price,
                              line_total: item.line_total,
                            })),
                          }
                          if (selectedPrinter) {
                            await printWithWindowsPrinter(tx, selectedPrinter, apiBase)
                          } else {
                            await printDotMatrixReceipt(tx, apiBase)
                          }
                        } catch {
                          toast('error', 'Failed to reprint receipt')
                        }
                      }}
                      className="h-9 px-3 rounded-lg border border-border bg-bg-card text-text-2 text-sm font-semibold hover:bg-bg-hover transition-colors flex items-center gap-1.5"
                    >
                      <Printer className="h-4 w-4" /> Reprint
                    </button>
                  </div>

                  {/* ── Job Cards section ── */}
                  <div className="rounded-xl border border-border bg-bg-card px-3 py-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-text-3 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5" /> Job Cards
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowJobCardModal(true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 border border-accent/30 text-accent text-[11px] font-semibold hover:bg-accent/25 transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Create / Link
                      </button>
                    </div>
                    {jobCardLoading ? (
                      <div className="text-text-3 text-xs py-1 text-center">
                        <Loader2 className="h-3 w-3 animate-spin inline mr-1" />Loading…
                      </div>
                    ) : linkedJobCards.length === 0 ? (
                      <div className="text-text-3 text-xs py-1 text-center">No job cards linked to this transaction</div>
                    ) : (
                      <div className="space-y-1">
                        {linkedJobCards.map((jc, i) => (
                          <button key={i} type="button" onClick={() => setJobCardDetail(jc)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-bg-elevated hover:bg-bg-hover border border-border/50 transition-colors text-left">
                            <Link2 className="h-3 w-3 text-success flex-shrink-0" />
                            <span className="text-[11px] font-mono font-bold text-accent">
                              {jc.type === 'pl' ? jc.data.job_card_no : jc.data.job_no}
                            </span>
                            <span className="text-[10px] text-text-3 bg-bg-card border border-border px-1.5 py-0.5 rounded">
                              {jc.type === 'pl' ? 'Plastic/Laser' : 'EventPro'}
                            </span>
                            <span className="ml-auto text-[11px] text-text-2 truncate">
                              {jc.type === 'pl' ? jc.data.client_name : jc.data.customer_name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-border bg-bg-card px-3 py-2">
                      <div className="text-text-3 text-xs mb-1 flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Customer</div>
                      <div className="text-text-1 font-semibold">{selectedTransaction.customer_name || 'Walk-in Customer'}</div>
                      <div className="text-text-3 text-xs">{selectedTransaction.customer_phone || 'No phone'}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-bg-card px-3 py-2">
                      <div className="text-text-3 text-xs mb-1 flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> Payment</div>
                      <div className="text-text-1 font-semibold">{selectedTransaction.payment_method}</div>
                      <div className="text-text-3 text-xs">Cash {fmtCurrency(selectedTransaction.cash_amount)} · Card {fmtCurrency(selectedTransaction.card_amount)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-text-3 mb-2">Items</div>
                    <div className="space-y-2">
                      {selectedItems.map((item) => (
                        <div key={item.id} className="rounded-xl border border-border bg-bg-card px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-text-1 truncate">{item.product_name}</div>
                              <div className="text-xs text-text-3">{item.sku || 'No SKU'} · Qty {item.quantity}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-text-1">{fmtCurrency(item.line_total)}</div>
                              <div className="text-xs text-text-3">@ {fmtCurrency(item.unit_price)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-bg-card px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between text-sm text-text-2"><span>Subtotal</span><span>{fmtCurrency(selectedTransaction.subtotal)}</span></div>
                    <div className="flex items-center justify-between text-sm text-success"><span>Discount</span><span>- {fmtCurrency(selectedTransaction.discount_amount)}</span></div>
                    <div className="flex items-center justify-between text-sm text-text-2"><span>Tax</span><span>{fmtCurrency(selectedTransaction.tax_amount)}</span></div>
                    <div className="flex items-center justify-between text-sm text-text-2"><span>Charges</span><span>{fmtCurrency(selectedTransaction.additional_charges_total)}</span></div>
                    <div className="h-px bg-border my-2" />
                    <div className="flex items-center justify-between text-base font-bold text-text-1"><span>Total</span><span>{fmtCurrency(selectedTransaction.total_amount)}</span></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-3 text-sm px-6 text-center">
                Select a transaction to view the details.
              </div>
            )}
          </div>
        </div>
      </div>

      {showRefundDialog && selectedTransaction && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card shadow-2xl animate-scale-in">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <h3 className="text-base font-semibold text-text-1">Approve Refund</h3>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-text-2">
                Refunding <span className="text-text-1 font-semibold">{selectedTransaction.transaction_number}</span> requires Manager or Admin password.
              </p>

              <div>
                <label className="text-xs uppercase tracking-wider text-text-3 font-semibold">Refund reason</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text-1 focus:outline-none focus:border-accent/50"
                  placeholder="Explain why this transaction is being refunded"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider text-text-3 font-semibold">Manager/Admin password</label>
                <input
                  type="password"
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  className="mt-1 w-full h-10 rounded-xl border border-border bg-bg-elevated px-3 text-sm text-text-1 focus:outline-none focus:border-accent/50"
                  placeholder="Enter approval password"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRefundDialog(false)}
                className="h-10 px-4 rounded-lg border border-border bg-bg-elevated text-text-2 text-sm font-semibold hover:bg-bg-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRefund}
                disabled={refunding}
                className="h-10 px-4 rounded-lg border border-danger/35 bg-danger/10 text-danger text-sm font-semibold hover:bg-danger/20 transition-colors disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {refunding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Job Card create/link modal ── */}
      {showJobCardModal && selectedId && (
        <JobCardModal
          onClose={() => setShowJobCardModal(false)}
          posTransactionId={selectedId}
          linkMode={false}
          onJobCardCreated={() => {
            setShowJobCardModal(false)
            setRefreshTick(t => t + 1)
          }}
        />
      )}

      {/* ── Job Card detail mini-dialog ── */}
      {jobCardDetail && (
        <div className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card shadow-2xl">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" />
              <span className="font-bold text-text-1 text-sm font-mono">
                {jobCardDetail.type === 'pl' ? jobCardDetail.data.job_card_no : jobCardDetail.data.job_no}
              </span>
              <span className="text-[11px] text-text-3 bg-bg-elevated border border-border px-2 py-0.5 rounded ml-1">
                {jobCardDetail.type === 'pl' ? 'Plastic / Laser' : 'EventPro'}
              </span>
              <button type="button" onClick={() => setJobCardDetail(null)}
                className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-text-3 hover:text-text-1 bg-bg-hover">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              {jobCardDetail.type === 'pl' ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><div className="text-text-3 text-[11px]">Client</div><div className="text-text-1 font-semibold">{jobCardDetail.data.client_name}</div></div>
                  <div><div className="text-text-3 text-[11px]">Date</div><div className="text-text-1">{jobCardDetail.data.date?.slice(0, 10)}</div></div>
                  <div><div className="text-text-3 text-[11px]">Job Name</div><div className="text-text-1">{jobCardDetail.data.job_name || '—'}</div></div>
                  <div><div className="text-text-3 text-[11px]">Delivery</div><div className="text-text-1">{jobCardDetail.data.delivery_date?.slice(0, 10) || '—'}</div></div>
                  <div className="col-span-2"><div className="text-text-3 text-[11px]">Material</div><div className="text-text-1">{jobCardDetail.data.material || '—'}</div></div>
                  <div className="col-span-2"><div className="text-text-3 text-[11px]">Size & Qty</div><div className="text-text-1">{jobCardDetail.data.size_qty || '—'}</div></div>
                  {jobCardDetail.data.structure?.startsWith('data:image/') && (
                    <div className="col-span-2">
                      <div className="text-text-3 text-[11px] mb-1">Structure Drawing</div>
                      <img src={jobCardDetail.data.structure} alt="Structure" className="rounded-lg border border-border max-h-28 object-contain w-full" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><div className="text-text-3 text-[11px]">Customer</div><div className="text-text-1 font-semibold">{jobCardDetail.data.customer_name}</div></div>
                  <div><div className="text-text-3 text-[11px]">Date</div><div className="text-text-1">{jobCardDetail.data.date?.slice(0, 10)}</div></div>
                  <div><div className="text-text-3 text-[11px]">Job Title</div><div className="text-text-1">{jobCardDetail.data.job_title || '—'}</div></div>
                  <div><div className="text-text-3 text-[11px]">Delivery</div><div className="text-text-1">{jobCardDetail.data.to_be_delivered_date?.slice(0, 10) || '—'}</div></div>
                  <div><div className="text-text-3 text-[11px]">Plastic Sqft</div><div className="text-text-1">{jobCardDetail.data.plastic_sqft ? `${jobCardDetail.data.plastic_sqft} sqft` : '—'}</div></div>
                  <div><div className="text-text-3 text-[11px]">Sticker Sqft</div><div className="text-text-1">{jobCardDetail.data.sticker_sqft ? `${jobCardDetail.data.sticker_sqft} sqft` : '—'}</div></div>
                  <div className="col-span-2"><div className="text-text-3 text-[11px]">Invoice No</div><div className="text-text-1">{jobCardDetail.data.invoice_no || '—'}</div></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}