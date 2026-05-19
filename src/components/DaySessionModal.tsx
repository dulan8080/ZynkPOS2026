import { useEffect, useState } from 'react'
import { Sun, X, DollarSign, Loader2, Clock, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react'
import { usePOS, useAuth } from '../store'
import { apiCloseDay, apiGetDaySession, apiGetSessionLiveStats, apiStartDay } from '../api'
import { fmtCurrency, fmtDateTime } from '../utils'

export function DaySessionModal() {
  const { daySession, isDayOpen, setDaySession, setShowDayModal, toast, clearCart } = usePOS()
  const { user, logout } = useAuth()
  const [openingCash, setOpeningCash] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'start' | 'close'>(isDayOpen ? 'close' : 'start')

  const [liveStats, setLiveStats] = useState<{
    completed_count: number
    completed_amount: number
    refunded_count: number
    refunded_amount: number
    voided_count: number
    voided_amount: number
  } | null>(null)

  useEffect(() => {
    setTab(isDayOpen ? 'close' : 'start')
  }, [isDayOpen])

  // Fetch live stats + refresh session data whenever the "close" tab becomes active
  useEffect(() => {
    if (tab === 'close' && daySession?.id) {
      // Refresh the full session so header stats (Total Sales, Transactions) are accurate
      if (user?.id) {
        apiGetDaySession(user.id)
          .then(r => { if (r.session) setDaySession(r.session, r.is_open) })
          .catch(() => {})
      }
      // Fetch per-status breakdown for Today's Sales Summary panel
      apiGetSessionLiveStats(daySession.id).then(setLiveStats).catch(() => {})
    } else {
      setLiveStats(null)
    }
  }, [tab, daySession?.id])

  // Pre-fill closing cash from the session's expected_cash (opening + net cash sales)
  // Re-runs whenever session data refreshes so it always reflects current state
  useEffect(() => {
    if (!isDayOpen || !daySession) {
      setClosingCash('')
      return
    }
    const expected = Number(daySession.expected_cash)
    if (Number.isFinite(expected) && expected > 0) {
      setClosingCash(expected.toFixed(2))
    }
  }, [
    isDayOpen,
    daySession?.id,
    daySession?.expected_cash,
  ])

  async function handleStartDay() {
    if (!user) { toast('error', 'You must be logged in'); return }
    setLoading(true)
    try {
      await apiStartDay(user.id, parseFloat(openingCash) || 0, notes || undefined)
      const refreshed = await apiGetDaySession(user.id)
      setDaySession(refreshed.session, refreshed.is_open)
      setShowDayModal(false)
      toast('success', 'Day session started!')
    } catch (err: any) {
      toast('error', err.message || 'Failed to start day session')
    } finally {
      setLoading(false)
    }
  }

  async function handleCloseDay() {
    if (!user || !daySession) return
    setLoading(true)
    try {
      await apiCloseDay(daySession.id, user.id, parseFloat(closingCash) || 0, notes || undefined)
      // Clear cart and session state, then log out so the next user must log in fresh
      clearCart()
      setDaySession(null, false)
      setShowDayModal(false)
      toast('success', 'Day session closed! Logging out...')
      // Small delay so the toast is visible before the login screen appears
      setTimeout(() => logout(), 1200)
    } catch (err: any) {
      toast('error', err.message || 'Failed to close day session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-elevated border border-border rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] w-full max-w-md mx-4 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDayOpen ? 'bg-danger/15' : 'bg-success/15'}`}>
              <Sun className={`w-5 h-5 ${isDayOpen ? 'text-danger' : 'text-success'}`} />
            </div>
            <h2 className="text-text-1 font-bold text-lg">Day Session</h2>
          </div>
          {isDayOpen && (
            <button
              onClick={() => setShowDayModal(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tabs (only when day is open) */}
        {isDayOpen && (
          <div className="flex gap-1 px-6 pt-4">
            {(['close', 'start'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  tab === t
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'text-text-3 hover:text-text-2 hover:bg-bg-hover'
                }`}
              >
                {t === 'close' ? 'Close Day' : 'Day Info'}
              </button>
            ))}
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Day summary (when open) */}
          {isDayOpen && daySession && (
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<TrendingUp className="w-4 h-4 text-success" />} label="Total Sales" value={fmtCurrency(daySession.total_sales)} color="text-success" />
              <StatCard icon={<CheckCircle className="w-4 h-4 text-accent" />} label="Transactions" value={String(daySession.total_transactions)} color="text-accent" />
              <StatCard icon={<DollarSign className="w-4 h-4 text-warning" />} label="Opening Cash" value={fmtCurrency(daySession.opening_cash)} color="text-warning" />
              <StatCard icon={<Clock className="w-4 h-4 text-text-2" />} label="Opened By" value={daySession.opened_by_name || 'Unknown'} color="text-text-2" />
            </div>
          )}

          {/* Start day form */}
          {!isDayOpen && (
            <div className="space-y-4">
              <p className="text-text-2 text-sm">
                Start a new day session to begin processing sales.
              </p>
              <div>
                <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-2">
                  Opening Cash (Rs.)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                  <input
                    type="number"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes for this session…"
                  className="w-full bg-bg-card border border-border rounded-xl px-4 py-3 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/50 resize-none"
                />
              </div>
            </div>
          )}

          {/* Close day form */}
          {isDayOpen && tab === 'close' && (
            <div className="space-y-4">
              {/* Live session stats */}
              {liveStats && (
                <div className="rounded-xl border border-border bg-bg-card divide-y divide-border overflow-hidden">
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-3">Today&apos;s Sales Summary</span>
                    <CheckCircle className="h-3.5 w-3.5 text-success" />
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-sm text-text-2">Completed ({liveStats.completed_count} txn)</span>
                    <span className="text-sm font-semibold text-success">{fmtCurrency(liveStats.completed_amount)}</span>
                  </div>
                  {liveStats.refunded_count > 0 && (
                    <div className="px-4 py-3 flex justify-between items-center">
                      <span className="text-sm text-text-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                        Refunded ({liveStats.refunded_count} txn)
                      </span>
                      <span className="text-sm font-semibold text-danger">-{fmtCurrency(liveStats.refunded_amount)}</span>
                    </div>
                  )}
                  {liveStats.voided_count > 0 && (
                    <div className="px-4 py-3 flex justify-between items-center">
                      <span className="text-sm text-text-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                        Voided ({liveStats.voided_count} txn)
                      </span>
                      <span className="text-sm font-semibold text-danger">-{fmtCurrency(liveStats.voided_amount)}</span>
                    </div>
                  )}
                  <div className="px-4 py-3 flex justify-between items-center bg-accent/5">
                    <span className="text-sm font-bold text-text-1">Net Sales</span>
                    <span className="text-sm font-bold text-accent">
                      {fmtCurrency(liveStats.completed_amount - liveStats.refunded_amount)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-2">
                  Closing Cash (Rs.)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                  <input
                    type="number"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-2 uppercase tracking-wider mb-2">
                  Closing Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional closing notes…"
                  className="w-full bg-bg-card border border-border rounded-xl px-4 py-3 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/50 resize-none"
                />
              </div>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={isDayOpen && tab === 'close' ? handleCloseDay : !isDayOpen ? handleStartDay : undefined}
            disabled={loading || (isDayOpen && tab !== 'close')}
            className={`
              w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all
              disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]
              ${isDayOpen && tab === 'close'
                ? 'bg-danger hover:bg-danger/90 text-white shadow-[0_4px_20px_rgba(248,113,113,0.3)]'
                : !isDayOpen
                ? 'bg-gradient-to-r from-success to-emerald-400 text-white shadow-[0_4px_20px_rgba(34,211,165,0.3)]'
                : 'bg-bg-card text-text-3 border border-border cursor-default'
              }
            `}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Please wait…
              </>
            ) : isDayOpen && tab === 'close' ? (
              'Close Day Session'
            ) : !isDayOpen ? (
              '✓ Start Day Session'
            ) : (
              'Select "Close Day" tab to close'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[10px] text-text-3 font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`font-bold text-sm ${color}`}>{value}</p>
    </div>
  )
}
