import { useMemo } from 'react'
import {
  ShoppingCart, Trash2, UserCheck, UserPlus, Tag, CreditCard,
  ChevronRight, X, Percent, Minus, Plus, Layers,
} from 'lucide-react'
import { usePOS } from '../store'
import { computeTotals, fmtCurrency } from '../utils'

export function CartPanel() {
  const {
    cartItems, removeFromCart, updateQty,
    selectedCustomer, setShowCustomerPicker, setCustomer,
    discountType, discountValue, setDiscount,
    setShowPayment, setShowTierDialog,
    clearCart, isDayOpen, toast,
  } = usePOS()

  const totals = useMemo(
    () => computeTotals(cartItems, discountType, discountValue),
    [cartItems, discountType, discountValue],
  )

  const hasItems = cartItems.length > 0

  function handlePay() {
    if (!isDayOpen) { toast('warning', 'Start the day session first (F9)'); return }
    if (!hasItems) { toast('info', 'Add items to the cart first'); return }
    setShowPayment(true)
  }

  return (
    <div className="flex flex-col h-full bg-bg-card/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-accent" />
          <span className="text-text-1 font-semibold text-sm">
            Cart
          </span>
          {hasItems && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-bold">
              {cartItems.length}
            </span>
          )}
        </div>
        {hasItems && (
          <button
            onClick={clearCart}
            className="flex items-center gap-1 text-xs text-text-3 hover:text-danger transition-colors px-2 py-1 rounded-lg hover:bg-danger/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Customer */}
      <div className="px-3 py-2.5 border-b border-border/40 flex-shrink-0">
        {selectedCustomer ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/8 border border-success/20">
            <UserCheck className="w-4 h-4 text-success flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-success text-xs font-semibold truncate">{selectedCustomer.name}</p>
              {selectedCustomer.phone && (
                <p className="text-text-3 text-[10px]">{selectedCustomer.phone}</p>
              )}
            </div>
            <button
              onClick={() => setCustomer(null)}
              className="text-text-3 hover:text-danger transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomerPicker(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-border border-dashed text-text-3 hover:text-text-2 hover:border-border-strong hover:bg-bg-hover transition-all text-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Customer (Walk-in)
            <ChevronRight className="w-3 h-3 ml-auto" />
          </button>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <ShoppingCart className="w-12 h-12 text-text-3/40 mb-3" />
            <p className="text-text-2 text-sm font-medium">Cart is empty</p>
            <p className="text-text-3 text-xs mt-1">Click a product to add it</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {cartItems.map((item) => (
              <CartItemRow key={item.rowKey} rowKey={item.rowKey} />
            ))}
          </div>
        )}
      </div>

      {/* Discount */}
      {hasItems && (
        <div className="px-4 py-3 border-t border-border/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-text-3" />
            <span className="text-xs text-text-2 font-medium">Order Discount</span>
            <div className="flex items-center gap-1.5 ml-auto">
              {/* Toggle type */}
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => setDiscount('FIXED', discountValue)}
                  className={`px-2.5 py-1 text-[10px] font-bold transition-all ${
                    discountType === 'FIXED'
                      ? 'bg-accent text-white'
                      : 'bg-bg-elevated text-text-3 hover:text-text-2'
                  }`}
                >
                  Rs.
                </button>
                <button
                  onClick={() => setDiscount('PERCENTAGE', discountValue)}
                  className={`px-2.5 py-1 text-[10px] font-bold transition-all flex items-center ${
                    discountType === 'PERCENTAGE'
                      ? 'bg-accent text-white'
                      : 'bg-bg-elevated text-text-3 hover:text-text-2'
                  }`}
                >
                  <Percent className="w-3 h-3" />
                </button>
              </div>
              <input
                type="number"
                min="0"
                value={discountValue || ''}
                onChange={(e) => setDiscount(discountType, parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-20 bg-bg-elevated border border-border rounded-lg px-2 py-1 text-text-1 text-xs text-right focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>
        </div>
      )}

      {/* Totals */}
      {hasItems && (
        <div className="px-4 py-3 border-t border-border/50 space-y-1.5 flex-shrink-0 bg-bg-elevated/50">
          <TotalRow label="Subtotal" value={totals.subtotal} />
          {totals.discountAmount > 0 && (
            <TotalRow label={`Discount${discountType === 'PERCENTAGE' ? ` (${discountValue}%)` : ''}`} value={-totals.discountAmount} highlight="danger" />
          )}
          {totals.taxAmount > 0 && (
            <TotalRow label="Tax" value={totals.taxAmount} />
          )}
          {totals.additionalChargesTotal > 0 && (
            <TotalRow label="Additional Charges" value={totals.additionalChargesTotal} />
          )}
          <div className="h-px bg-border my-2" />
          <div className="flex items-center justify-between">
            <span className="text-text-1 font-bold text-base">Total</span>
            <span className="text-accent font-bold text-xl">
              {fmtCurrency(totals.total)}
            </span>
          </div>
        </div>
      )}

      {/* Pay Button */}
      <div className="p-3 flex-shrink-0">
        <button
          onClick={handlePay}
          disabled={!hasItems || !isDayOpen}
          className="
            w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl
            font-bold text-white text-base transition-all
            disabled:opacity-40 disabled:cursor-not-allowed
            bg-gradient-to-br from-accent to-blue-500
            hover:from-accent-hover hover:to-blue-400
            active:scale-[0.98]
            shadow-[0_4px_24px_rgba(91,141,247,0.4)]
            hover:shadow-[0_6px_30px_rgba(91,141,247,0.55)]
          "
        >
          <CreditCard className="w-5 h-5" />
          {hasItems
            ? `Process Payment  ·  ${fmtCurrency(totals.total)}`
            : 'Process Payment  (F5)'}
        </button>
        {!isDayOpen && (
          <p className="text-center text-[10px] text-warning mt-1.5">
            ⚠ Day session is closed — press F9 to start
          </p>
        )}
      </div>
    </div>
  )
}

// ── Individual cart item row ──────────────────────────────────────────────────
function CartItemRow({ rowKey }: { rowKey: string }) {
  const { cartItems, updateQty, removeFromCart, setShowTierDialog } = usePOS()
  const item = cartItems.find((i) => i.rowKey === rowKey)
  if (!item) return null

  const lineTotal = item.qty * item.unitPrice + item.additionalCharges - item.lineDiscount
  const hasTiers = item.product.price_tiers?.length > 0

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-bg-elevated border border-border animate-cart-pop">
      {/* Product name + delete */}
      <div className="flex items-start gap-2">
        <div
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: item.product.category_color || '#5B8DF7' }}
        />
        <p className="flex-1 text-text-1 text-sm font-semibold leading-tight line-clamp-1">
          {item.product.name}
        </p>
        <button
          onClick={() => removeFromCart(rowKey)}
          className="text-text-3 hover:text-danger transition-colors ml-1 flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Qty controls + price */}
      <div className="flex items-center gap-2">
        {/* Qty */}
        <div className="flex items-center gap-1 bg-bg-primary rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => updateQty(rowKey, item.qty - 1)}
            className="w-7 h-7 flex items-center justify-center text-text-2 hover:text-text-1 hover:bg-bg-elevated transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="min-w-[32px] text-center text-text-1 text-sm font-bold px-1">
            {item.qty}
          </span>
          <button
            onClick={() => updateQty(rowKey, item.qty + 1)}
            disabled={item.qty >= item.product.stock_qty}
            className="w-7 h-7 flex items-center justify-center text-text-2 hover:text-text-1 hover:bg-bg-elevated transition-colors disabled:opacity-30"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Unit price */}
        <span className="text-text-3 text-xs flex-1">
          × {fmtCurrency(item.unitPrice)}
        </span>

        {/* Tier button */}
        {hasTiers && (
          <button
            onClick={() => setShowTierDialog(rowKey)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-warning/10 border border-warning/20 text-warning text-[10px] font-semibold hover:bg-warning/20 transition-colors"
          >
            <Layers className="w-3 h-3" />
            Tier
          </button>
        )}

        {/* Line total */}
        <span className="text-text-1 font-bold text-sm">
          {fmtCurrency(lineTotal)}
        </span>
      </div>

      {/* Additional charges note */}
      {item.additionalCharges > 0 && (
        <p className="text-[10px] text-text-3 ml-4">
          + {fmtCurrency(item.additionalCharges)} charges
          {item.additionalChargesNote && `: ${item.additionalChargesNote}`}
        </p>
      )}

      {/* Applied tier badge */}
      {item.appliedTierId && (
        <div className="ml-4 inline-flex">
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-medium">
            Tier price applied
          </span>
        </div>
      )}
    </div>
  )
}

// ── Total row helper ──────────────────────────────────────────────────────────
function TotalRow({
  label, value, highlight,
}: {
  label: string
  value: number
  highlight?: 'danger' | 'success'
}) {
  const colorClass =
    highlight === 'danger' ? 'text-danger' :
    highlight === 'success' ? 'text-success' :
    'text-text-2'

  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${colorClass}`}>{label}</span>
      <span className={`text-xs font-semibold ${colorClass}`}>
        {value < 0 ? '- ' : ''}{fmtCurrency(Math.abs(value))}
      </span>
    </div>
  )
}
