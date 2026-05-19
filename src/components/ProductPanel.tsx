import { useRef, useState, useMemo, useCallback } from 'react'
import { Search, LayoutGrid, RefreshCw, X } from 'lucide-react'
import { usePOS } from '../store'
import { CategoryBar } from './CategoryBar'
import { ProductCard } from './ProductCard'
import { apiGetProducts } from '../api'

export function ProductPanel() {
  const {
    products, categories, isLoading,
    selectedCategory, setSelectedCategory,
    searchText, setSearchText,
    setProducts, setLoading, toast,
  } = usePOS()
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Filtered products ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = products.filter((p) => p.is_active !== 0)
    if (selectedCategory !== null) {
      list = list.filter((p) => p.category_id === selectedCategory)
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q),
      )
    }
    return list
  }, [products, selectedCategory, searchText])

  // ── Reload products ────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGetProducts()
      setProducts(data)
    } catch (err: any) {
      toast('error', `Failed to reload products: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearSearch = () => {
    setSearchText('')
    searchRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search Bar */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border/40">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
          <input
            ref={searchRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search products, SKU, barcode…  (F2)"
            className="w-full bg-bg-elevated border border-border rounded-xl pl-9 pr-8 py-2.5 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-all"
          />
          {searchText && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          title="Refresh products"
          className="w-10 h-10 rounded-xl bg-bg-elevated border border-border flex items-center justify-center text-text-3 hover:text-text-2 hover:bg-bg-hover disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Category Bar */}
      <CategoryBar />

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <LayoutGrid className="w-10 h-10 text-text-3 mb-3" />
            <p className="text-text-2 text-sm font-medium">
              {searchText ? 'No products match your search' : 'No products in this category'}
            </p>
            {searchText && (
              <button
                onClick={clearSearch}
                className="mt-2 text-xs text-accent hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="text-[11px] text-text-3 mb-3 px-1">
              {filtered.length} product{filtered.length !== 1 ? 's' : ''}
              {selectedCategory !== null && (
                <span> in <span className="text-text-2 font-medium">
                  {categories.find((c) => c.id === selectedCategory)?.name ?? ''}
                </span></span>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
