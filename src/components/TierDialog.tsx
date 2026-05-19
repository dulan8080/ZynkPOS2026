import { useEffect } from 'react'
import { X, Layers, Check } from 'lucide-react'
import { usePOS } from '../store'
import { fmtCurrency } from '../utils'
import type { CartItem } from '../types'

interface TierDialogProps {
  rowKey: string
  /** Optional: provide cart item directly instead of reading from store */
  item?: CartItem
  /** Optional: callback when a tier is applied (instead of using store's applyTier) */
  onApply?: (rowKey: string, tierId: number | null, price: number) => void
  /** Optional: callback to close dialog (instead of using store's setShowTierDialog) */
  onClose?: () => void
}

export function TierDialog({ rowKey, item: itemProp, onApply, onClose }: TierDialogProps) {
  const { cartItems, applyTier, setShowTierDialog } = usePOS()
  const item = itemProp ?? cartItems.find((i) => i.rowKey === rowKey)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); doClose() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const doApply = (tierId: number | null, price: number) => {
    if (onApply) {
      onApply(rowKey, tierId, price)
    } else {
      applyTier(rowKey, tierId ?? 0, price)
    }
    if (onClose) onClose()
    else setShowTierDialog(null)
  }

  const doClose = () => {
    if (onClose) onClose()
    else setShowTierDialog(null)
  }

  if (!item) return null

  const tiers = item.product.price_tiers || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-elevated border border-border rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] w-full max-w-sm mx-4 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-warning/15 flex items-center justify-center">
              <Layers className="w-4 h-4 text-warning" />
            </div>
            <div>
              <h2 className="text-text-1 font-bold text-sm leading-none">Price Tiers</h2>
              <p className="text-text-3 text-[11px] mt-0.5 truncate max-w-[160px]">{item.product.name}</p>
            </div>
          </div>
          <button
            onClick={doClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2.5">
          {/* Default price */}
          <button
            onClick={() => doApply(null, item.product.selling_price)}
            className={`
              w-full flex items-center justify-between p-3.5 rounded-xl border transition-all
              ${item.appliedTierId === null
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'border-border hover:bg-bg-hover text-text-1'
              }
            `}
          >
            <div className="text-left">
              <p className="font-semibold text-sm">Standard Price</p>
              <p className="text-[11px] text-text-3 mt-0.5">Any quantity</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">{fmtCurrency(item.product.selling_price)}</span>
              {item.appliedTierId === null && <Check className="w-4 h-4 text-accent" />}
            </div>
          </button>

          {tiers.map((tier) => {
            const isActive = item.appliedTierId === tier.id
            const qualifies = item.qty >= tier.min_qty && (tier.max_qty === 0 || item.qty <= tier.max_qty)
            return (
              <button
                key={tier.id}
                onClick={() => doApply(tier.id, tier.price)}
                className={`
                  w-full flex items-center justify-between p-3.5 rounded-xl border transition-all
                  ${isActive
                    ? 'bg-warning/10 border-warning/30'
                    : qualifies
                    ? 'border-success/20 bg-success/5 hover:bg-success/10'
                    : 'border-border hover:bg-bg-hover'
                  }
                `}
              >
                <div className="text-left">
                  <p className={`font-semibold text-sm ${isActive ? 'text-warning' : qualifies ? 'text-success' : 'text-text-1'}`}>
                    {tier.label || `Tier ${tier.id}`}
                  </p>
                  <p className="text-[11px] text-text-3 mt-0.5">
                    Qty {tier.min_qty}{tier.max_qty > 0 ? ` – ${tier.max_qty}` : '+'}
                    {qualifies && ' · ✓ Qualifies'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${isActive ? 'text-warning' : qualifies ? 'text-success' : 'text-text-1'}`}>
                    {fmtCurrency(tier.price)}
                  </span>
                  {isActive && <Check className="w-4 h-4 text-warning" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
