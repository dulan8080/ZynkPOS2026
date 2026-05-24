import { useState, useEffect } from 'react'
import {
  ShoppingBag, Clock, Sun, Moon, LogOut, Settings,
  ChevronRight, Activity, RefreshCw, Printer, Monitor, Download,
} from 'lucide-react'
import { isTauri } from '@tauri-apps/api/core'
import { usePOS, useAuth } from '../store'
import { fmtCurrency } from '../utils'
import type { User } from '../types'

interface TopBarProps {
  user: User | null
  onOpenPrinterSettings: () => void
  onOpenSettings: () => void
  customerDisplayEnabled?: boolean
  onShowCustomerDisplay?: () => void
}

const LIVE_API_HOST = 'my.lassanapata.com'

export function TopBar({ user, onOpenPrinterSettings, onOpenSettings, customerDisplayEnabled, onShowCustomerDisplay }: TopBarProps) {
  const { isDayOpen, daySession, setShowDayModal, cartItems } = usePOS()
  const { logout, apiBase, companyName, selectedPrinter, currentSection } = useAuth()
  const [time, setTime] = useState(new Date())
  const [showUserMenu, setShowUserMenu] = useState(false)
  const isLiveServer = apiBase.toLowerCase().includes(LIVE_API_HOST)

  // ── Auto-updater ──────────────────────────────────────────────────────────
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; notes?: string } | null>(null)
  const [updateState, setUpdateState] = useState<'idle' | 'downloading' | 'done'>('idle')

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    ;(async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (!cancelled && update?.available) {
          setUpdateAvailable({ version: update.version, notes: update.body ?? undefined })
          // store the update object so we can call downloadAndInstall later
          ;(window as any).__posUpdate = update
        }
      } catch { /* silently ignore — server unreachable or no update */ }
    })()
    return () => { cancelled = true }
  }, [])

  async function handleInstallUpdate() {
    const update = (window as any).__posUpdate
    if (!update) return
    setUpdateState('downloading')
    try {
      await update.downloadAndInstall()
      setUpdateState('done')
      // Relaunch after a short delay so the user sees the "done" state
      setTimeout(async () => {
        const { relaunch } = await import('@tauri-apps/plugin-process')
        await relaunch()
      }, 1500)
    } catch {
      setUpdateState('idle')
    }
  }
  // ── End auto-updater ─────────────────────────────────────────────────────

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)

  function handleRefresh() {
    window.location.reload()
  }

  return (
    <header className="h-14 flex items-center px-4 gap-4 border-b border-border/60 bg-bg-card/80 backdrop-blur-sm flex-shrink-0 relative z-20">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
          <ShoppingBag className="w-4 h-4 text-accent" />
        </div>
        <div className="leading-tight">
          <p className="text-text-1 font-bold text-sm leading-none flex items-center gap-1.5">
            {currentSection && (
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: currentSection.color }}
              />
            )}
            {currentSection ? currentSection.name : companyName}
          </p>
          <p className="text-text-3 text-[10px] leading-none mt-0.5">
            {currentSection ? `${currentSection.code} · POS System` : 'POS System'}
          </p>
        </div>
      </div>

      <div className="w-px h-8 bg-border mx-1" />

      {/* Day Session Status */}
      <button
        onClick={() => setShowDayModal(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:bg-bg-elevated"
        style={{
          borderColor: isDayOpen ? 'rgba(34,211,165,0.3)' : 'rgba(248,113,113,0.3)',
          backgroundColor: isDayOpen ? 'rgba(34,211,165,0.08)' : 'rgba(248,113,113,0.08)',
        }}
      >
        <span
          className="w-2 h-2 rounded-full animate-pulse-soft"
          style={{ backgroundColor: isDayOpen ? '#22D3A5' : '#F87171' }}
        />
        <span
          className="text-xs font-semibold"
          style={{ color: isDayOpen ? '#22D3A5' : '#F87171' }}
        >
          {isDayOpen ? 'DAY OPEN' : 'DAY CLOSED'}
        </span>
        {isDayOpen && daySession && (
          <span className="text-[10px] text-text-3 ml-1">
            · {daySession.total_transactions} txns · {fmtCurrency(daySession.total_sales)}
          </span>
        )}
      </button>

      {/* Cart indicator */}
      {cartCount > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20">
          <ShoppingBag className="w-3.5 h-3.5 text-accent" />
          <span className="text-accent text-xs font-bold">{cartCount} item{cartCount !== 1 ? 's' : ''} in cart</span>
        </div>
      )}

      {isLiveServer && (
        <div className="hidden lg:flex items-center px-2.5 py-1 rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-300 text-[11px] font-semibold tracking-wide">
          LIVE
        </div>
      )}

      {/* Update available banner */}
      {updateAvailable && (
        <button
          onClick={handleInstallUpdate}
          disabled={updateState !== 'idle'}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg border border-blue-400/40 bg-blue-500/10 text-blue-300 text-[11px] font-semibold transition-all hover:bg-blue-500/20 disabled:opacity-60"
          title={updateAvailable.notes || 'Update available'}
        >
          <Download className="w-3.5 h-3.5" />
          {updateState === 'idle' && `Update v${updateAvailable.version}`}
          {updateState === 'downloading' && 'Installing…'}
          {updateState === 'done' && 'Restarting…'}
        </button>
      )}

      <div className="ml-auto flex items-center gap-3">
        {/* Clock */}
        <div className="flex items-center gap-1.5 text-text-2">
          <Clock className="w-3.5 h-3.5 text-text-3" />
          <span className="text-sm font-mono font-medium">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 text-text-3 text-xs">
          <Sun className="w-3.5 h-3.5" />
          {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Customer Display re-open button */}
        {customerDisplayEnabled && (
          <button
            onClick={onShowCustomerDisplay}
            title="Show Customer Display"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-accent/30 bg-accent/8 text-accent text-[11px] font-semibold transition-all hover:bg-accent/20"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Display</span>
          </button>
        )}

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          title="Reload data"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-3 hover:text-text-2 hover:bg-bg-elevated transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Printer indicator */}
        <button
          onClick={onOpenPrinterSettings}
          title={selectedPrinter ? `Printer: ${selectedPrinter}` : 'No printer configured'}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
            selectedPrinter
              ? 'border-success/30 bg-success/8 text-success hover:bg-success/15'
              : 'border-amber-500/30 bg-amber-500/8 text-amber-400 hover:bg-amber-500/15'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span className="hidden md:inline max-w-[120px] truncate">
            {selectedPrinter ?? 'No Printer'}
          </span>
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu((s) => !s)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-bg-elevated transition-all"
          >
            <div className="w-6 h-6 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-[10px] font-bold text-accent">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="text-left leading-tight">
              <p className="text-xs font-semibold text-text-1">{user?.name || 'User'}</p>
              <p className="text-[10px] text-text-3 capitalize">{user?.role || 'cashier'}</p>
            </div>
            <ChevronRight className="w-3 h-3 text-text-3 rotate-90" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-bg-elevated border border-border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1 animate-scale-in">
                <div className="px-3 py-2 border-b border-border mb-1">
                  <p className="text-xs text-text-1 font-semibold">{user?.name}</p>
                  <p className="text-[10px] text-text-3">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setShowDayModal(true); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-2 hover:text-text-1 hover:bg-bg-hover transition-colors"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Day Session
                </button>
                <button
                  onClick={() => { onOpenPrinterSettings(); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-2 hover:text-text-1 hover:bg-bg-hover transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Printer Setup
                </button>
                <button
                  onClick={() => { onOpenSettings(); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-2 hover:text-text-1 hover:bg-bg-hover transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </button>
                <button
                  onClick={() => { logout(); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/10 transition-colors rounded-b-xl"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
