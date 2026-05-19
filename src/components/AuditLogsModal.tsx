import { useEffect, useState, useMemo } from 'react'
import { ActivitySquare, CalendarDays, ChevronLeft, ChevronRight, Search, Shield, X } from 'lucide-react'
import { apiGetPOSAuditLogs } from '../api'
import { fmtDateTime } from '../utils'

interface AuditLogsModalProps {
  open: boolean
  onClose: () => void
}

const PAGE_SIZE = 50

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  VOID:    { label: 'Void',    color: 'text-danger bg-danger/10' },
  REFUND:  { label: 'Refund',  color: 'text-danger bg-danger/10' },
  CREATE:  { label: 'Create',  color: 'text-success bg-success/10' },
  UPDATE:  { label: 'Update',  color: 'text-warning bg-warning/10' },
  DELETE:  { label: 'Delete',  color: 'text-danger bg-danger/10' },
  LOGIN:   { label: 'Login',   color: 'text-accent bg-accent/10' },
  LOGOUT:  { label: 'Logout',  color: 'text-text-3 bg-bg-elevated' },
}

function ActionBadge({ type }: { type: string }) {
  const cfg = ACTION_LABELS[type] || { label: type, color: 'text-text-2 bg-bg-elevated' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

export function AuditLogsModal({ open, onClose }: AuditLogsModalProps) {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    actionType: '',
    dateFrom: '',
    dateTo: '',
  })

  useEffect(() => {
    if (!open) return
    setPage(1)
    setSearchInput('')
    setFilters({ search: '', actionType: '', dateFrom: '', dateTo: '' })
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    apiGetPOSAuditLogs({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      action_type: filters.actionType || undefined,
      search: filters.search || undefined,
      date_from: filters.dateFrom || undefined,
      date_to: filters.dateTo || undefined,
    })
      .then(res => {
        if (cancelled) return
        setLogs(res.logs || [])
        setTotal(res.total || 0)
      })
      .catch(() => {
        if (!cancelled) { setLogs([]); setTotal(0) }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, page, filters])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  function applySearch() {
    setPage(1)
    setFilters(f => ({ ...f, search: searchInput.trim() }))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full h-full max-w-5xl bg-bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-bg-elevated flex-shrink-0">
          <Shield className="h-5 w-5 text-accent" />
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-text-1">POS Audit Logs</div>
            <div className="text-xs text-text-3">All void, refund, and sensitive POS actions are recorded here.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-border bg-bg-primary/30 flex flex-wrap gap-2 flex-shrink-0">
          <label className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applySearch() }}
              placeholder="Search user, ref, description..."
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
            value={filters.actionType}
            onChange={e => { setPage(1); setFilters(f => ({ ...f, actionType: e.target.value })) }}
            className="h-10 rounded-xl border border-border bg-bg-card px-3 text-sm text-text-1 focus:outline-none focus:border-accent/50"
          >
            <option value="">All Actions</option>
            <option value="VOID">Void</option>
            <option value="REFUND">Refund</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>

          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-text-3" />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => { setPage(1); setFilters(f => ({ ...f, dateFrom: e.target.value })) }}
              className="h-10 rounded-xl border border-border bg-bg-card px-3 text-sm text-text-1 focus:outline-none focus:border-accent/50"
            />
            <span className="text-text-3 text-xs">to</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => { setPage(1); setFilters(f => ({ ...f, dateTo: e.target.value })) }}
              className="h-10 rounded-xl border border-border bg-bg-card px-3 text-sm text-text-1 focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-text-3 text-sm">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-text-3">
              <ActivitySquare className="h-8 w-8 opacity-30" />
              <p className="text-sm">No audit log entries found.</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-bg-elevated z-10">
                <tr className="text-text-3 text-[11px] uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5 font-semibold">Date / Time</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Action</th>
                  <th className="text-left px-4 py-2.5 font-semibold">User</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Reference</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Description</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={log.id ?? i}
                    className="border-t border-border/40 hover:bg-bg-elevated/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-text-3 whitespace-nowrap font-mono text-[11px]">
                      {fmtDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <ActionBadge type={log.action_type} />
                    </td>
                    <td className="px-4 py-2.5 text-text-1 font-medium">
                      {log.performed_by_name || `User #${log.performed_by}`}
                    </td>
                    <td className="px-4 py-2.5 text-accent font-mono text-xs">
                      {log.entity_ref || (log.entity_id ? `#${log.entity_id}` : '—')}
                    </td>
                    <td className="px-4 py-2.5 text-text-2 max-w-xs truncate">
                      {log.description || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-text-3 text-[11px] max-w-[180px]">
                      {log.details
                        ? typeof log.details === 'object'
                          ? Object.entries(log.details)
                              .filter(([k]) => k !== 'manager_password' && k !== 'password')
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(', ')
                          : String(log.details)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-bg-elevated flex-shrink-0">
          <span className="text-xs text-text-3">
            {total} {total === 1 ? 'entry' : 'entries'} total
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg border border-border bg-bg-card flex items-center justify-center text-text-2 hover:bg-bg-hover disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-text-2 font-medium px-2">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg border border-border bg-bg-card flex items-center justify-center text-text-2 hover:bg-bg-hover disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
