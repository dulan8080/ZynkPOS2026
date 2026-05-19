import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  X, Printer, RefreshCw, Check, AlertTriangle, Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { useAuth } from '../store'
import { printDotMatrixReceipt, buildReceiptHtml } from '../utils/printDotMatrix'

interface PrinterInfo {
  name: string
  is_default: boolean
}

const DEMO_RECEIPT = {
  transaction_number: 'TEST-001',
  customer_name: 'Test Customer',
  created_at: new Date().toISOString(),
  items: [
    { product_name: 'Sample Item A', quantity: 2, unit_price: 150, line_total: 300 },
    { product_name: 'Sample Item B', quantity: 1, unit_price: 250, line_total: 250 },
  ],
}

export function PrinterSettingsModal({ onClose }: { onClose: () => void }) {
  const { selectedPrinter, autoPrint, setSelectedPrinter, setAutoPrint } = useAuth()

  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'printing' | 'ok' | 'err'>('idle')
  const [testError, setTestError] = useState<string>('')
  const [pending, setPending] = useState<string | null>(selectedPrinter)

  async function loadPrinters() {
    setLoading(true)
    setError(null)
    try {
      const list = await invoke<PrinterInfo[]>('list_printers')
      setPrinters(list)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPrinters() }, [])

  async function handleSave() {
    setSaving(true)
    setSelectedPrinter(pending)
    // Optionally set the Windows default printer
    if (pending) {
      try {
        await invoke('set_default_printer', { printerName: pending })
      } catch {
        // Non-fatal — silently ignore; silent-print will still set it per-job
      }
    }
    setSaving(false)
    onClose()
  }

  async function handleTestPrint() {
    if (!pending) return
    setTestStatus('printing')
    setTestError('')
    try {
      const html = buildReceiptHtml(DEMO_RECEIPT)
      await invoke('print_receipt_html', { html, printerName: pending })
      setTestStatus('ok')
    } catch (e: any) {
      // Fallback: open browser print dialog
      setTestError(String(e))
      setTestStatus('err')
      printDotMatrixReceipt(DEMO_RECEIPT)
    }
  }

  const windowsDefault = printers.find((p) => p.is_default)?.name

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-elevated border border-border rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
              <Printer className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-text-1 font-bold text-base">Printer Setup</h2>
              <p className="text-text-3 text-xs">Select the Windows printer for receipts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Auto-print toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-bg-card">
            <div>
              <p className="text-text-1 text-sm font-semibold">Auto-print on sale</p>
              <p className="text-text-3 text-xs mt-0.5">
                Automatically print receipt when a sale completes
              </p>
            </div>
            <button
              onClick={() => setAutoPrint(!autoPrint)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                autoPrint
                  ? 'bg-success/15 border-success/30 text-success'
                  : 'bg-bg-elevated border-border text-text-3'
              }`}
            >
              {autoPrint ? (
                <><ToggleRight className="w-4 h-4" /> ON</>
              ) : (
                <><ToggleLeft className="w-4 h-4" /> OFF</>
              )}
            </button>
          </div>

          {/* Printer list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-text-2 text-xs font-semibold uppercase tracking-wide">
                Available Printers
              </p>
              <button
                onClick={loadPrinters}
                disabled={loading}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-colors disabled:opacity-40"
                title="Refresh printer list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-text-3 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading printers…</span>
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 p-3 rounded-xl border border-danger/30 bg-danger/8 text-danger">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Failed to load printers</p>
                  <p className="text-xs mt-0.5 opacity-75">{error}</p>
                  <p className="text-xs mt-1 opacity-60">
                    Ensure PowerShell is available and this is running on Windows.
                  </p>
                </div>
              </div>
            ) : printers.length === 0 ? (
              <p className="text-center text-text-3 text-sm py-8">
                No printers found on this machine.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                {printers.map((p) => {
                  const isSelected = pending === p.name
                  return (
                    <button
                      key={p.name}
                      onClick={() => { setPending(p.name); setTestStatus('idle') }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                        isSelected
                          ? 'border-accent/50 bg-accent/10'
                          : 'border-border bg-bg-card hover:bg-bg-hover hover:border-border/80'
                      }`}
                    >
                      <Printer
                        className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-accent' : 'text-text-3'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-accent' : 'text-text-1'}`}>
                          {p.name}
                        </p>
                        {(p.is_default || p.name === windowsDefault) && (
                          <p className="text-[10px] text-text-3 mt-0.5">Windows default</p>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Current selection summary */}
          {pending && (
            <div className="p-3 rounded-xl border border-border bg-bg-card text-xs text-text-3 flex items-start gap-2">
              <Printer className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
              <div>
                <span className="text-text-2 font-medium">Selected: </span>
                <span className="text-text-1">{pending}</span>
                <br />
                <span>Receipts will be sent to this printer automatically on each sale.</span>
              </div>
            </div>
          )}

          {/* Test print */}
          {pending && (
            <div className="space-y-2">
              <button
                onClick={handleTestPrint}
                disabled={testStatus === 'printing'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-accent/40 bg-accent/10 text-accent text-sm font-semibold hover:bg-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testStatus === 'printing' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Printing test…</>
                ) : testStatus === 'ok' ? (
                  <><Check className="w-4 h-4" /> Test sent successfully</>
                ) : (
                  <><Printer className="w-4 h-4" /> Print Test Receipt</>
                )}
              </button>
              {testStatus === 'err' && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8 text-amber-300 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Silent print unavailable — opened print dialog instead.</p>
                    {testError && <p className="mt-0.5 opacity-70">{testError}</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-text-2 text-sm font-semibold hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-accent border border-accent/60 text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
