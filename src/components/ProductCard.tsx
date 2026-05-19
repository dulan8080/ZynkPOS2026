import { Package, AlertTriangle } from 'lucide-react'
import { usePOS } from '../store'
import { hexToRgba } from '../utils'
import type { Product } from '../types'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart, isDayOpen, toast } = usePOS()
  const color = product.category_color || '#5B8DF7'
  const isOutOfStock = product.stock_qty <= 0
  const isLowStock = product.stock_qty > 0 && product.stock_qty <= 5

  function handleClick() {
    if (!isDayOpen) {
      toast('warning', 'Please start the day session before adding items.')
      return
    }
    if (isOutOfStock) {
      toast('error', `"${product.name}" is out of stock.`)
      return
    }
    addToCart(product)
  }

  return (
    <button
      onClick={handleClick}
      disabled={isOutOfStock}
      className={`
        group relative flex flex-col items-start p-3.5 rounded-2xl border text-left
        transition-all duration-150 select-none overflow-hidden
        ${isOutOfStock
          ? 'opacity-50 cursor-not-allowed border-border bg-bg-elevated'
          : 'border-border hover:border-opacity-80 hover:scale-[1.02] active:scale-[0.97] cursor-pointer'
        }
      `}
      style={
        isOutOfStock
          ? {}
          : {
              borderColor: `${color}30`,
              backgroundColor: hexToRgba(color, 0.06),
            }
      }
    >
      {/* Category color accent strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: isOutOfStock ? '#333' : color }}
      />

      {/* Hover glow */}
      {!isOutOfStock && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"
          style={{ background: `radial-gradient(circle at 30% 30%, ${hexToRgba(color, 0.12)}, transparent 70%)` }}
        />
      )}

      {/* Product icon / image */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 flex-shrink-0"
        style={
          isOutOfStock
            ? { backgroundColor: 'rgba(255,255,255,0.05)' }
            : { backgroundColor: hexToRgba(color, 0.15) }
        }
      >
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-8 h-8 object-cover rounded-lg" />
        ) : (
          <Package className="w-5 h-5" style={{ color: isOutOfStock ? '#555' : color }} />
        )}
      </div>

      {/* Name */}
      <p className="text-text-1 font-semibold text-[13px] leading-tight line-clamp-2 mb-1.5 w-full">
        {product.name}
      </p>

      {/* SKU */}
      {product.sku && (
        <p className="text-text-3 text-[10px] font-mono mb-2">{product.sku}</p>
      )}

      {/* Price */}
      <p
        className="text-base font-bold mt-auto"
        style={{ color: isOutOfStock ? '#555' : color }}
      >
        Rs. {product.selling_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>

      {/* Stock indicator */}
      <div className="flex items-center gap-1 mt-1.5">
        {isOutOfStock ? (
          <>
            <AlertTriangle className="w-3 h-3 text-danger" />
            <span className="text-[10px] text-danger font-medium">Out of stock</span>
          </>
        ) : isLowStock ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            <span className="text-[10px] text-warning font-medium">{product.stock_qty} left</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-[10px] text-text-3">{product.stock_qty} in stock</span>
          </>
        )}
      </div>

      {/* Price tier badge */}
      {product.price_tiers?.length > 0 && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-warning/15 border border-warning/25 text-[9px] font-bold text-warning">
          TIERS
        </div>
      )}
    </button>
  )
}
