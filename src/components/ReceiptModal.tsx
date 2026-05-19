import { useEffect, useRef } from 'react'
import { CheckCircle, ReceiptText, RotateCcw, Printer, ClipboardList } from 'lucide-react'
import { usePOS, useAuth } from '../store'
import { fmtCurrency } from '../utils'
import { printDotMatrixReceipt, printWithWindowsPrinter } from '../utils/printDotMatrix'

export function ReceiptModal({ onCreateJobCard }: { onCreateJobCard?: (txnId: number) => void } = {}) {
  const { lastReceipt, setShowReceiptModal, setLastReceipt } = usePOS()
  const { user, selectedPrinter, autoPrint, apiBase } = useAuth()
  const autoPrinted = useRef(false)
  const printingId = useRef<string | null>(null)

  // Auto-print on every new receipt
  useEffect(() => {
    if (!lastReceipt || !autoPrint) return
    // Use transaction_number as a stable identity to prevent double-fire
    const id = lastReceipt.transaction_number || String(lastReceipt.transaction_id)
    if (printingId.current === id) return
    printingId.current = id
    autoPrinted.current = true

    if (selectedPrinter) {
      // Silent print to the configured Windows printer
      printWithWindowsPrinter(lastReceipt, selectedPrinter, apiBase).catch(() => {
        // Already falls back inside the function; no extra action needed
      })
    } else {
      printDotMatrixReceipt(lastReceipt, apiBase)
    }
  }, [lastReceipt])

  // Reset the flag when receipt changes
  useEffect(() => {
    autoPrinted.current = false
  }, [lastReceipt?.id])

  if (!lastReceipt) return null

  const tx = lastReceipt

  function handleClose() {
    setShowReceiptModal(false)
    setLastReceipt(null)
  }

  function handlePrint() {
    if (selectedPrinter) {
      printWithWindowsPrinter(tx, selectedPrinter, apiBase)
    } else {
      printDotMatrixReceipt(tx, apiBase)
    }
  }

  const methodLabel: Record<string, string> = {
    CASH: 'Cash',
    CARD: 'Card',
    MIXED: 'Mixed',
    CREDIT: 'Credit',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-elevated border border-border rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] w-full max-w-sm mx-4 animate-scale-in">
        {/* Success header */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6 border-b border-border">
          <div className="w-16 h-16 rounded-3xl bg-success/15 border border-success/25 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(34,211,165,0.2)]">
            <CheckCircle className="w-9 h-9 text-success" />
          </div>
          <h2 className="text-text-1 font-bold text-xl">Sale Complete!</h2>
          <p className="text-text-3 text-sm mt-1 font-mono">{tx.transaction_number || '#—'}</p>
        </div>

        {/* Receipt body */}
        <div className="p-6 space-y-3">
          {/* Items */}
          {tx.items?.length > 0 && (
            <div className="space-y-1.5 pb-3 border-b border-border">
              {tx.items.map((item: any, i: number) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-text-1 text-sm truncate">{item.product_name}</p>
                    <p className="text-text-3 text-[11px]">{item.quantity} × {fmtCurrency(item.unit_price)}</p>
                  </div>
                  <span className="text-text-1 text-sm font-semibold flex-shrink-0">{fmtCurrency(item.line_total)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="space-y-1.5">
            {tx.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-xs text-text-3">Discount</span>
                <span className="text-xs text-danger font-medium">- {fmtCurrency(tx.discount_amount)}</span>
              </div>
            )}
            {tx.tax_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-xs text-text-3">Tax</span>
                <span className="text-xs text-text-2">{fmtCurrency(tx.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-text-1 font-bold">Total</span>
              <span className="text-accent font-bold text-lg">{fmtCurrency(tx.total_amount)}</span>
            </div>
          </div>

          {/* Payment details */}
          <div className="bg-bg-card rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-text-3">Method</span>
              <span className="text-xs text-text-1 font-semibold">{methodLabel[tx.payment_method] || tx.payment_method}</span>
            </div>
            {tx.cash_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-xs text-text-3">Cash Received</span>
                <span className="text-xs text-text-1">{fmtCurrency(tx.cash_amount)}</span>
              </div>
            )}
            {tx.change_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-xs text-text-3">Change</span>
                <span className="text-xs text-success font-semibold">{fmtCurrency(tx.change_amount)}</span>
              </div>
            )}
            {tx.balance_due > 0 && (
              <div className="flex justify-between">
                <span className="text-xs text-warning">Balance Due</span>
                <span className="text-xs text-warning font-bold">{fmtCurrency(tx.balance_due)}</span>
              </div>
            )}
          </div>

          {/* Customer / notes */}
          {tx.customer_name && (
            <div className="flex justify-between">
              <span className="text-xs text-text-3">Customer</span>
              <span className="text-xs text-text-1">{tx.customer_name}</span>
            </div>
          )}

          <p className="text-center text-[10px] text-text-3">
            {user?.name && `Served by ${user.name} · `}
            {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          {onCreateJobCard && tx.transaction_id && (
            <button
              onClick={() => { onCreateJobCard(tx.transaction_id); handleClose() }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-accent/40 bg-accent/10 text-accent font-semibold text-sm hover:bg-accent/20 transition-all"
            >
              <ClipboardList className="w-4 h-4" />
              Create Job Card for this Sale
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-text-2 font-semibold text-sm hover:bg-bg-hover hover:text-text-1 transition-all"
            >
              <Printer className="w-4 h-4" />
              Reprint
            </button>
            <button
              onClick={handleClose}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-accent to-blue-500 text-white font-bold text-sm active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(91,141,247,0.35)]"
            >
              <RotateCcw className="w-4 h-4" />
              New Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
