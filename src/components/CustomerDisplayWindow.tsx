import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, CheckCircle2, Sparkles } from 'lucide-react'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CustomerDisplayItem {
  rowKey: string
  productName: string
  qty: number
  unitPrice: number
  lineTotal: number
}

export interface CustomerDisplayPayload {
  items: CustomerDisplayItem[]
  subtotal: number
  discount: number
  total: number
  customerName?: string | null
}

export interface PaymentCompletePayload {
  total: number
  amountPaid: number
  change: number
  customerName?: string | null
  transactionNumber?: string
}

type DisplayMode = 'welcome' | 'cart' | 'thankyou'

// ── Storage key ───────────────────────────────────────────────────────────────
export const CD_CART_KEY = 'pos:customer-display:cart'
export const CD_PAYMENT_KEY = 'pos:customer-display:payment'
export const CD_CLEAR_KEY = 'pos:customer-display:clear'
export const CD_CUSTOMER_KEY = 'pos:customer-display:customer'

export interface CustomerGreetPayload { name: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCur(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Particle confetti ─────────────────────────────────────────────────────────
function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  const x = Math.random() * 100
  const rotate = Math.random() * 720 - 360
  const size = Math.random() * 10 + 6

  return (
    <motion.div
      className="absolute top-0 rounded-sm"
      style={{ left: `${x}%`, width: size, height: size * 0.6, backgroundColor: color }}
      initial={{ y: -20, opacity: 1, rotate: 0, x: 0 }}
      animate={{
        y: typeof window !== 'undefined' ? window.innerHeight + 20 : 800,
        opacity: [1, 1, 0],
        rotate,
        x: (Math.random() - 0.5) * 200,
      }}
      transition={{ duration: 2.5 + Math.random() * 1.5, delay, ease: 'easeIn' }}
    />
  )
}

const CONFETTI_COLORS = [
  '#22D3A5', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6',
  '#10B981', '#F97316', '#06B6D4', '#EF4444', '#84CC16',
]

function ConfettiBlast() {
  const particles = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.8,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  }))

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} delay={p.delay} color={p.color} />
      ))}
    </div>
  )
}

// ── Floating sparkle dots ─────────────────────────────────────────────────────
function FloatingDot({ style }: { style: React.CSSProperties }) {
  return (
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full bg-accent/40"
      style={style}
      animate={{ y: [-20, 20], opacity: [0.2, 0.7, 0.2] }}
      transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

// ── Welcome / idle screen ─────────────────────────────────────────────────────
function WelcomeScreen({ companyName }: { companyName: string }) {
  const dots = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    style: {
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
    },
  }))

  return (
    <div className="flex flex-col items-center justify-center h-full relative overflow-hidden">
      {/* Background ambient */}
      <div className="absolute inset-0 bg-gradient-radial from-accent/8 via-transparent to-transparent" />
      {dots.map((d) => (
        <FloatingDot key={d.id} style={d.style} />
      ))}

      {/* Logo ring */}
      <motion.div
        className="relative mb-8"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Outer pulsing ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-accent/30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border border-accent/20"
          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
        />
        <div className="w-24 h-24 rounded-full bg-accent/15 border-2 border-accent/40 flex items-center justify-center shadow-[0_0_40px_rgba(34,211,165,0.3)]">
          <ShoppingCart className="w-10 h-10 text-accent" />
        </div>
      </motion.div>

      {/* Company name */}
      <motion.h1
        className="text-4xl font-black text-text-1 mb-2 tracking-tight"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        {companyName}
      </motion.h1>

      {/* Tagline */}
      <motion.p
        className="text-text-3 text-lg font-medium mb-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        Welcome — ready to serve you
      </motion.p>

      {/* Divider */}
      <motion.div
        className="w-24 h-0.5 bg-gradient-to-r from-transparent via-accent/50 to-transparent mb-10"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      />

      {/* Powered by */}
      <motion.div
        className="flex flex-col items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
      >
        <p className="text-text-3 text-xs">Powered by</p>
        <p className="text-accent/70 text-sm font-semibold">© Zynknet Technology Solutions</p>
      </motion.div>
    </div>
  )
}

// ── Cart / Items screen ───────────────────────────────────────────────────────
function CartScreen({ data }: { data: CustomerDisplayPayload }) {
  return (
    <div className="flex h-full gap-0">
      {/* Left: item list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center gap-3 bg-bg-card/50">
          <ShoppingCart className="w-5 h-5 text-accent" />
          <h2 className="text-text-1 font-bold text-lg">
            Your Order
            {data.customerName && (
              <span className="text-accent ml-2 text-base font-semibold">
                — {data.customerName}
              </span>
            )}
          </h2>
          <div className="ml-auto">
            <span className="bg-accent/15 text-accent text-sm font-bold px-3 py-1 rounded-full border border-accent/25">
              {data.items.length} item{data.items.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 pb-2 text-[11px] font-semibold text-text-3 uppercase tracking-wider border-b border-border/40">
            <span>Product</span>
            <span className="text-right w-10">Qty</span>
            <span className="text-right w-24">Unit Price</span>
            <span className="text-right w-28">Total</span>
          </div>

          <AnimatePresence initial={false}>
            {data.items.map((item, idx) => (
              <motion.div
                key={item.rowKey}
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04, ease: 'easeOut' }}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 rounded-xl border border-border/60 bg-bg-card hover:bg-bg-elevated transition-colors"
              >
                <span className="text-text-1 font-semibold text-sm truncate">
                  {item.productName}
                </span>
                <span className="text-text-2 font-bold text-sm text-right w-10 tabular-nums">
                  ×{item.qty}
                </span>
                <span className="text-text-3 text-sm text-right w-24 tabular-nums">
                  Rs.{fmtCur(item.unitPrice)}
                </span>
                <span className="text-accent font-bold text-sm text-right w-28 tabular-nums">
                  Rs.{fmtCur(item.lineTotal)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          {data.items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-text-3">
              <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No items yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: total panel */}
      <div className="w-72 flex-shrink-0 border-l border-border flex flex-col bg-bg-card/60">
        <div className="px-6 pt-6 pb-4 border-b border-border/60">
          <p className="text-text-3 text-xs font-semibold uppercase tracking-wider mb-1">Summary</p>
        </div>

        <div className="flex-1 px-6 py-5 space-y-4">
          <SummaryRow label="Subtotal" value={`Rs.${fmtCur(data.subtotal)}`} />
          {data.discount > 0 && (
            <SummaryRow label="Discount" value={`-Rs.${fmtCur(data.discount)}`} className="text-amber-400" />
          )}

          {/* Total */}
          <div className="pt-3 border-t border-border">
            <div className="p-4 rounded-2xl bg-accent/10 border border-accent/25">
              <p className="text-text-3 text-xs font-semibold uppercase tracking-wider mb-2">
                Total Amount
              </p>
              <motion.p
                key={data.total}
                className="text-accent font-black text-3xl tabular-nums"
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                Rs.{fmtCur(data.total)}
              </motion.p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60">
          <p className="text-text-3 text-[10px] text-center">
            © Zynknet Technology Solutions
          </p>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  className = 'text-text-1',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-3 text-sm">{label}</span>
      <span className={`font-semibold text-sm tabular-nums ${className}`}>{value}</span>
    </div>
  )
}

// ── Thank-you screen ──────────────────────────────────────────────────────────
function ThankYouScreen({ data }: { data: PaymentCompletePayload }) {
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-full relative overflow-hidden">
      {/* Background glow */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(34,211,165,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Confetti */}
      {showConfetti && <ConfettiBlast />}

      {/* Success ring */}
      <motion.div
        className="relative mb-8"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
      >
        {/* Outer rings burst */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border-2 border-accent"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2 + i * 0.5, opacity: 0 }}
            transition={{ duration: 1.2, delay: i * 0.15, ease: 'easeOut' }}
          />
        ))}
        <div className="w-28 h-28 rounded-full bg-accent/15 border-2 border-accent/60 flex items-center justify-center shadow-[0_0_60px_rgba(34,211,165,0.4)]">
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
          >
            <CheckCircle2 className="w-14 h-14 text-accent" />
          </motion.div>
        </div>
      </motion.div>

      {/* Thank You text */}
      <motion.div
        className="text-center mb-8"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
      >
        <h1 className="text-6xl font-black text-text-1 mb-3 tracking-tight">
          Thank{' '}
          <span className="text-accent">You!</span>
        </h1>
        {data.customerName && (
          <p className="text-2xl text-text-2 font-semibold mb-2">{data.customerName}</p>
        )}
        <p className="text-text-3 text-lg">Your purchase is complete</p>
      </motion.div>

      {/* Payment details */}
      <motion.div
        className="w-full max-w-sm bg-bg-card border border-border rounded-2xl overflow-hidden"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
      >
        <div className="px-6 py-4 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-3">Total</span>
            <span className="text-text-1 font-bold tabular-nums">Rs.{fmtCur(data.total)}</span>
          </div>
          {data.amountPaid > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-3">Paid</span>
              <span className="text-text-1 font-semibold tabular-nums">Rs.{fmtCur(data.amountPaid)}</span>
            </div>
          )}
          {data.change > 0.005 && (
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-text-2 font-semibold text-sm">Change</span>
              <span className="text-success font-black text-lg tabular-nums">
                Rs.{fmtCur(data.change)}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Sparkles */}
      <motion.div
        className="flex items-center gap-2 mt-8 text-accent/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <Sparkles className="w-4 h-4" />
        <p className="text-sm font-medium">Please come again!</p>
        <Sparkles className="w-4 h-4" />
      </motion.div>

      {/* Bottom branding */}
      <motion.p
        className="absolute bottom-6 text-text-3 text-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        © Zynknet Technology Solutions
      </motion.p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function CustomerDisplayWindow() {
  const [mode, setMode] = useState<DisplayMode>('welcome')
  const [cartData, setCartData] = useState<CustomerDisplayPayload | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentCompletePayload | null>(null)
  const [companyName, setCompanyName] = useState('ZynkPOS')
  const [greetName, setGreetName] = useState<string | null>(null)
  const thankyouTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const greetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Prevent OS window close button — user must disable via Settings
  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | null = null
    getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault()
    }).then((fn) => { unlisten = fn }).catch(() => {})
    return () => { unlisten?.() }
  }, [])

  // Read company name from store persisted value
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pos-auth-v2')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.state?.companyName) {
          setCompanyName(parsed.state.companyName)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // ── Listen for updates ───────────────────────────────────────────────────
  useEffect(() => {
    const unlistens: Array<() => void> = []

    if (isTauri()) {
      // Tauri: use emit/listen event system (localStorage doesn't cross Tauri windows)
      listen<CustomerDisplayPayload>('cd:cart', (e) => {
        const data = e.payload
        setCartData(data)
        setMode((prev) => prev !== 'thankyou' ? (data.items.length > 0 ? 'cart' : 'welcome') : prev)
      }).then((fn) => unlistens.push(fn)).catch(() => {})

      listen<PaymentCompletePayload>('cd:payment', (e) => {
        setPaymentData(e.payload)
        setMode('thankyou')
        if (thankyouTimerRef.current) clearTimeout(thankyouTimerRef.current)
        thankyouTimerRef.current = setTimeout(() => {
          setMode('welcome')
          setCartData(null)
          setPaymentData(null)
        }, 6000)
      }).then((fn) => unlistens.push(fn)).catch(() => {})

      listen('cd:clear', () => {
        setMode('welcome')
        setCartData(null)
        setPaymentData(null)
      }).then((fn) => unlistens.push(fn)).catch(() => {})

      listen<CustomerGreetPayload>('cd:customer', (e) => {
        if (greetTimerRef.current) clearTimeout(greetTimerRef.current)
        setGreetName(e.payload.name)
        greetTimerRef.current = setTimeout(() => setGreetName(null), 2800)
      }).then((fn) => unlistens.push(fn)).catch(() => {})
    } else {
      // Browser: localStorage storage events (fires when another window writes)
      function handleStorage(e: StorageEvent) {
        if (e.key === CD_CART_KEY && e.newValue) {
          try {
            const data: CustomerDisplayPayload = JSON.parse(e.newValue)
            setCartData(data)
            setMode((prev) => prev !== 'thankyou' ? (data.items.length > 0 ? 'cart' : 'welcome') : prev)
          } catch { /* ignore */ }
        }
        if (e.key === CD_PAYMENT_KEY && e.newValue) {
          try {
            const data: PaymentCompletePayload = JSON.parse(e.newValue)
            setPaymentData(data)
            setMode('thankyou')
            if (thankyouTimerRef.current) clearTimeout(thankyouTimerRef.current)
            thankyouTimerRef.current = setTimeout(() => {
              setMode('welcome')
              setCartData(null)
              setPaymentData(null)
            }, 6000)
          } catch { /* ignore */ }
        }
        if (e.key === CD_CUSTOMER_KEY && e.newValue) {
          try {
            const data: CustomerGreetPayload = JSON.parse(e.newValue)
            if (greetTimerRef.current) clearTimeout(greetTimerRef.current)
            setGreetName(data.name)
            greetTimerRef.current = setTimeout(() => setGreetName(null), 2800)
          } catch { /* ignore */ }
        }
        if (e.key === CD_CLEAR_KEY) {
          setMode('welcome')
          setCartData(null)
          setPaymentData(null)
        }
      }
      window.addEventListener('storage', handleStorage)
      unlistens.push(() => window.removeEventListener('storage', handleStorage))

      // Poll once on mount in case main window wrote before this window was ready
      const raw = localStorage.getItem(CD_CART_KEY)
      if (raw) {
        try {
          const data: CustomerDisplayPayload = JSON.parse(raw)
          if (data.items.length > 0) { setCartData(data); setMode('cart') }
        } catch { /* ignore */ }
      }
    }

    return () => {
      unlistens.forEach((fn) => fn())
      if (thankyouTimerRef.current) clearTimeout(thankyouTimerRef.current)
      if (greetTimerRef.current) clearTimeout(greetTimerRef.current)
    }
  }, [])

  const bgClass = 'fixed inset-0 bg-bg overflow-hidden'

  return (
    <div className={bgClass}>
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── Customer greeting popup ─────────────────────────────────────── */}
      <AnimatePresence>
        {greetName && (
          <motion.div
            key="greet"
            className="absolute inset-x-0 top-0 z-50 flex justify-center pt-6 pointer-events-none"
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="flex items-center gap-3 px-7 py-4 rounded-2xl border border-accent/30 bg-bg-elevated/95 backdrop-blur-md shadow-[0_8px_40px_rgba(0,0,0,0.55)]">
              <motion.span
                className="text-3xl"
                animate={{ rotate: [0, -20, 20, -10, 10, 0] }}
                transition={{ duration: 0.8, delay: 0.15 }}
              >👋</motion.span>
              <div className="leading-tight">
                <p className="text-xs text-text-3 font-medium uppercase tracking-widest">Welcome back</p>
                <p className="text-xl font-bold text-text-1">{greetName}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {mode === 'welcome' && (
          <motion.div
            key="welcome"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <WelcomeScreen companyName={companyName} />
          </motion.div>
        )}

        {mode === 'cart' && cartData && (
          <motion.div
            key="cart"
            className="absolute inset-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <CartScreen data={cartData} />
          </motion.div>
        )}

        {mode === 'thankyou' && paymentData && (
          <motion.div
            key="thankyou"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4 }}
          >
            <ThankYouScreen data={paymentData} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
