import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartItem, Category, ChargeType, Customer, DaySession, Product, User } from './types'
import { generateRowKey, getTierForQty } from './utils'

const DEFAULT_API_BASE = ''

// ── Auth Store (persisted) ────────────────────────────────────────────────────
interface AuthState {
  user: User | null
  token: string | null
  apiBase: string
  companyName: string
  currentSection: { id: number; name: string; code: string; color: string } | null
  // Printer settings
  selectedPrinter: string | null
  autoPrint: boolean
  // Customer display
  customerDisplayEnabled: boolean
  login: (user: User, token: string) => void
  logout: () => void
  setApiBase: (url: string) => void
  setCompanyName: (name: string) => void
  setCurrentSection: (section: { id: number; name: string; code: string; color: string } | null) => void
  setSelectedPrinter: (name: string | null) => void
  setAutoPrint: (on: boolean) => void
  setCustomerDisplayEnabled: (on: boolean) => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      apiBase: DEFAULT_API_BASE,
      companyName: 'ZYNKPOS',
      currentSection: null,
      selectedPrinter: null,
      autoPrint: true,
      customerDisplayEnabled: false,
      login: (user, token) => {
        set({ user, token })
      },
      logout: () => {
        set({ user: null, token: null, currentSection: null })
      },
      setApiBase: (url) => {
        localStorage.setItem('pos_api_base', url)
        set({ apiBase: url })
      },
      setCompanyName: (name) => {
        set({ companyName: name || 'ZYNKPOS' })
      },
      setCurrentSection: (section) => {
        set({ currentSection: section })
      },
      setSelectedPrinter: (name) => {
        set({ selectedPrinter: name })
      },
      setAutoPrint: (on) => {
        set({ autoPrint: on })
      },
      setCustomerDisplayEnabled: (on) => {
        set({ customerDisplayEnabled: on })
      },
    }),
    {
      name: 'pos-auth-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        apiBase: state.apiBase,
        companyName: state.companyName,
        currentSection: state.currentSection,
        selectedPrinter: state.selectedPrinter,
        autoPrint: state.autoPrint,
        customerDisplayEnabled: state.customerDisplayEnabled,
      }),
    },
  ),
)

// ── POS Store (session state) ─────────────────────────────────────────────────
interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

interface POSState {
  // Data
  products: Product[]
  categories: Category[]
  chargeTypes: ChargeType[]
  customers: Customer[]
  isLoading: boolean

  // Day Session
  daySession: DaySession | null
  isDayOpen: boolean

  // Cart
  cartItems: CartItem[]

  // Customer
  selectedCustomer: Customer | null

  // Order-level discount
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number

  // UI filters
  selectedCategory: number | null
  searchText: string

  // Modal visibility
  showPayment: boolean
  showDayModal: boolean
  showCustomerPicker: boolean
  showTierDialog: string | null // rowKey
  showReceiptModal: boolean

  // Last completed transaction receipt
  lastReceipt: any | null

  // Toast notifications
  toasts: ToastMessage[]

  // ── Data Actions ────────────────────────────────────────────────────────────
  setProducts: (p: Product[]) => void
  setCategories: (c: Category[]) => void
  setChargeTypes: (ct: ChargeType[]) => void
  setCustomers: (c: Customer[]) => void
  setLoading: (l: boolean) => void
  setDaySession: (s: DaySession | null, open: boolean) => void

  // ── Cart Actions ────────────────────────────────────────────────────────────
  setCartItems: (items: CartItem[]) => void
  addToCart: (product: Product) => void
  updateQty: (rowKey: string, qty: number) => void
  updatePrice: (rowKey: string, price: number) => void
  updateAdditionalCharges: (rowKey: string, amount: number, note: string) => void
  updateLineDiscount: (rowKey: string, amount: number) => void
  applyTier: (rowKey: string, tierId: number, price: number) => void
  removeFromCart: (rowKey: string) => void
  clearCart: () => void

  // ── Customer Actions ─────────────────────────────────────────────────────────
  setCustomer: (c: Customer | null) => void

  // ── Discount Actions ─────────────────────────────────────────────────────────
  setDiscount: (type: 'PERCENTAGE' | 'FIXED', value: number) => void

  // ── UI Actions ───────────────────────────────────────────────────────────────
  setSelectedCategory: (id: number | null) => void
  setSearchText: (t: string) => void
  setShowPayment: (s: boolean) => void
  setShowDayModal: (s: boolean) => void
  setShowCustomerPicker: (s: boolean) => void
  setShowTierDialog: (rowKey: string | null) => void
  setShowReceiptModal: (s: boolean) => void
  setLastReceipt: (r: any | null) => void

  // ── Toast Actions ────────────────────────────────────────────────────────────
  toast: (type: ToastMessage['type'], message: string) => void
  removeToast: (id: string) => void
}

export const usePOS = create<POSState>()((set, get) => ({
  products: [],
  categories: [],
  chargeTypes: [],
  customers: [],
  isLoading: false,
  daySession: null,
  isDayOpen: false,
  cartItems: [],
  selectedCustomer: null,
  discountType: 'FIXED',
  discountValue: 0,
  selectedCategory: null,
  searchText: '',
  showPayment: false,
  showDayModal: false,
  showCustomerPicker: false,
  showTierDialog: null,
  showReceiptModal: false,
  lastReceipt: null,
  toasts: [],

  // Data
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  setChargeTypes: (chargeTypes) => set({ chargeTypes }),
  setCustomers: (customers) => set({ customers }),
  setLoading: (isLoading) => set({ isLoading }),
  setDaySession: (daySession, isDayOpen) => set({ daySession, isDayOpen }),

  // Cart
  setCartItems: (cartItems) => set({ cartItems }),
  addToCart: (product) => {
    const items = get().cartItems
    const existing = items.find((i) => i.product.id === product.id)
    if (existing) {
      const newQty = existing.qty + 1
      const tier = getTierForQty(product, newQty)
      set({
        cartItems: items.map((i) =>
          i.rowKey === existing.rowKey
            ? {
                ...i,
                qty: newQty,
                unitPrice: tier ? tier.price : product.selling_price,
                appliedTierId: tier?.id ?? null,
              }
            : i,
        ),
      })
    } else {
      const tier = getTierForQty(product, 1)
      const newItem: CartItem = {
        rowKey: generateRowKey(),
        product,
        qty: 1,
        unitPrice: tier ? tier.price : product.selling_price,
        appliedTierId: tier?.id ?? null,
        additionalCharges: 0,
        additionalChargesNote: '',
        lineDiscount: 0,
      }
      set({ cartItems: [...items, newItem] })
    }
  },

  updateQty: (rowKey, qty) => {
    if (qty <= 0) { get().removeFromCart(rowKey); return }
    set({
      cartItems: get().cartItems.map((i) => {
        if (i.rowKey !== rowKey) return i
        const tier = getTierForQty(i.product, qty)
        return {
          ...i,
          qty,
          unitPrice: tier ? tier.price : (i.appliedTierId ? i.unitPrice : i.product.selling_price),
          appliedTierId: tier?.id ?? null,
        }
      }),
    })
  },

  updatePrice: (rowKey, price) => {
    set({
      cartItems: get().cartItems.map((i) =>
        i.rowKey === rowKey ? { ...i, unitPrice: price, appliedTierId: null } : i,
      ),
    })
  },

  updateAdditionalCharges: (rowKey, amount, note) => {
    set({
      cartItems: get().cartItems.map((i) =>
        i.rowKey === rowKey ? { ...i, additionalCharges: amount, additionalChargesNote: note } : i,
      ),
    })
  },

  updateLineDiscount: (rowKey, amount) => {
    set({
      cartItems: get().cartItems.map((i) =>
        i.rowKey === rowKey ? { ...i, lineDiscount: amount } : i,
      ),
    })
  },

  applyTier: (rowKey, tierId, price) => {
    set({
      cartItems: get().cartItems.map((i) =>
        i.rowKey === rowKey ? { ...i, unitPrice: price, appliedTierId: tierId } : i,
      ),
    })
  },

  removeFromCart: (rowKey) => {
    set({ cartItems: get().cartItems.filter((i) => i.rowKey !== rowKey) })
  },

  clearCart: () => {
    set({
      cartItems: [],
      selectedCustomer: null,
      discountType: 'FIXED',
      discountValue: 0,
    })
  },

  // Customer
  setCustomer: (selectedCustomer) => set({ selectedCustomer }),

  // Discount
  setDiscount: (discountType, discountValue) => set({ discountType, discountValue }),

  // UI
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSearchText: (searchText) => set({ searchText }),
  setShowPayment: (showPayment) => set({ showPayment }),
  setShowDayModal: (showDayModal) => set({ showDayModal }),
  setShowCustomerPicker: (showCustomerPicker) => set({ showCustomerPicker }),
  setShowTierDialog: (showTierDialog) => set({ showTierDialog }),
  setShowReceiptModal: (showReceiptModal) => set({ showReceiptModal }),
  setLastReceipt: (lastReceipt) => set({ lastReceipt }),

  // Toast
  toast: (type, message) => {
    const id = `toast-${Date.now()}`
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
