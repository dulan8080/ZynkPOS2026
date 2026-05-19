import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  X, Printer, RefreshCw, Check, AlertTriangle, Loader2,
  ToggleLeft, ToggleRight, Settings, Info, Monitor,
  Phone, Mail, Globe, Copyright, User, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../store'
import { printDotMatrixReceipt, buildReceiptHtml } from '../utils/printDotMatrix'

// ── Types ─────────────────────────────────────────────────────────────────────
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

type SettingsSection = 'general' | 'printer' | 'customer-display'

interface NavItem {
  id: SettingsSection
  label: string
  description: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Company info & about',
    icon: <Info className="w-4 h-4" />,
  },
  {
    id: 'printer',
    label: 'Printer Setup',
    description: 'Receipt printer config',
    icon: <Printer className="w-4 h-4" />,
  },
  {
    id: 'customer-display',
    label: 'Customer Display',
    description: 'Second screen display',
    icon: <Monitor className="w-4 h-4" />,
  },
]

// ── General Section ───────────────────────────────────────────────────────────
function GeneralSection() {
  const { companyName } = useAuth()

  return (
    <div className="space-y-5">
      {/* Company from DB */}
      <div>
        <p className="text-text-3 text-[11px] font-semibold uppercase tracking-wider mb-3">
          Company Info
        </p>
        <div className="p-4 rounded-2xl border border-border bg-bg-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
              <Settings className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-text-1 font-bold text-base leading-tight">{companyName}</p>
              <p className="text-text-3 text-xs mt-0.5">Registered company name</p>
            </div>
          </div>
          <p className="text-text-3 text-xs leading-relaxed border-t border-border pt-3">
            This name is pulled from your server settings and is displayed throughout the POS system.
          </p>
        </div>
      </div>

      {/* Developer / System Info */}
      <div>
        <p className="text-text-3 text-[11px] font-semibold uppercase tracking-wider mb-3">
          System & Support
        </p>
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          {/* Header with gradient */}
          <div className="px-4 pt-4 pb-3 bg-gradient-to-r from-accent/8 to-transparent border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <Copyright className="w-3.5 h-3.5 text-accent" />
              <span className="text-accent font-bold text-sm">Zynknet Technology Solutions</span>
            </div>
            <p className="text-text-3 text-xs">All rights reserved.</p>
          </div>

          {/* Contact Details */}
          <div className="divide-y divide-border/50">
            <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Developer">
              Dulan Chamara Abeywickrama
            </InfoRow>
            <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone">
              +94 77 406 6636
            </InfoRow>
            <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="Email">
              <div className="space-y-0.5">
                <a
                  href="mailto:dulan@zynknet.com"
                  className="block text-accent/80 hover:text-accent transition-colors"
                >
                  dulan@zynknet.com
                </a>
                <a
                  href="mailto:info@zynknet.com"
                  className="block text-accent/80 hover:text-accent transition-colors"
                >
                  info@zynknet.com
                </a>
              </div>
            </InfoRow>
            <InfoRow icon={<Globe className="w-3.5 h-3.5" />} label="Web">
              <div className="space-y-0.5">
                <a
                  href="https://zynknet.com"
                  target="_blank"
                  rel="noreferrer"
                  className="block text-accent/80 hover:text-accent transition-colors"
                >
                  https://zynknet.com
                </a>
                <a
                  href="https://serverlk.com"
                  target="_blank"
                  rel="noreferrer"
                  className="block text-accent/80 hover:text-accent transition-colors"
                >
                  https://serverlk.com
                </a>
              </div>
            </InfoRow>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-bg-elevated/40 border-t border-border">
            <p className="text-text-3 text-[10px] text-center leading-relaxed">
              © Zynknet Technology Solutions · All rights reserved.
              <br />
              ZynkPOS — Professional Point of Sale System
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <div className="text-text-3 mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-text-3 text-[10px] font-semibold uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <div className="text-text-1 text-xs">{children}</div>
      </div>
    </div>
  )
}

// ── Printer Section ───────────────────────────────────────────────────────────
function PrinterSection({ onDone }: { onDone: () => void }) {
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
    if (pending) {
      try {
        await invoke('set_default_printer', { printerName: pending })
      } catch {
        // Non-fatal
      }
    }
    setSaving(false)
    onDone()
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
      setTestError(String(e))
      setTestStatus('err')
      printDotMatrixReceipt(DEMO_RECEIPT)
    }
  }

  const windowsDefault = printers.find((p) => p.is_default)?.name

  return (
    <div className="space-y-5">
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
          <div className="flex items-center justify-center py-8 text-text-3 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading printers…</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-danger/30 bg-danger/8 text-danger">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Failed to load printers</p>
              <p className="text-xs mt-0.5 opacity-75">{error}</p>
            </div>
          </div>
        ) : printers.length === 0 ? (
          <p className="text-center text-text-3 text-sm py-6">No printers found.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
            {printers.map((p) => {
              const isSelected = pending === p.name
              return (
                <button
                  key={p.name}
                  onClick={() => { setPending(p.name); setTestStatus('idle') }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-left ${
                    isSelected
                      ? 'border-accent/50 bg-accent/10'
                      : 'border-border bg-bg-card hover:bg-bg-hover'
                  }`}
                >
                  <Printer className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-accent' : 'text-text-3'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-accent' : 'text-text-1'}`}>
                      {p.name}
                    </p>
                    {(p.is_default || p.name === windowsDefault) && (
                      <p className="text-[10px] text-text-3 mt-0.5">Windows default</p>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Current selection */}
      {pending && (
        <div className="p-3 rounded-xl border border-border bg-bg-card text-xs text-text-3 flex items-start gap-2">
          <Printer className="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" />
          <div>
            <span className="text-text-2 font-medium">Selected: </span>
            <span className="text-text-1">{pending}</span>
          </div>
        </div>
      )}

      {/* Test print */}
      {pending && (
        <div className="space-y-2">
          <button
            onClick={handleTestPrint}
            disabled={testStatus === 'printing'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-accent/40 bg-accent/10 text-accent text-sm font-semibold hover:bg-accent/20 transition-all disabled:opacity-50"
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

      {/* Save */}
      <div className="pt-2 border-t border-border flex items-center justify-end gap-3">
        <button
          onClick={onDone}
          className="px-4 py-2 rounded-xl border border-border text-text-2 text-sm font-semibold hover:bg-bg-hover transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Printer
        </button>
      </div>
    </div>
  )
}

// ── Customer Display Section ──────────────────────────────────────────────────
function CustomerDisplaySection() {
  const { customerDisplayEnabled, setCustomerDisplayEnabled } = useAuth()

  return (
    <div className="space-y-5">
      {/* Toggle */}
      <div className="p-4 rounded-2xl border border-border bg-bg-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Monitor className="w-4 h-4 text-accent" />
              <p className="text-text-1 font-bold text-sm">Customer Display</p>
            </div>
            <p className="text-text-3 text-xs leading-relaxed">
              Open a second-screen window that shows cart items and prices to the customer in real time.
              When payment is complete, an animated thank-you screen is shown.
            </p>
          </div>
          <button
            onClick={() => setCustomerDisplayEnabled(!customerDisplayEnabled)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              customerDisplayEnabled
                ? 'bg-success/15 border-success/30 text-success'
                : 'bg-bg-elevated border-border text-text-3'
            }`}
          >
            {customerDisplayEnabled ? (
              <><ToggleRight className="w-4 h-4" /> ON</>
            ) : (
              <><ToggleLeft className="w-4 h-4" /> OFF</>
            )}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div>
        <p className="text-text-3 text-[11px] font-semibold uppercase tracking-wider mb-3">
          How It Works
        </p>
        <div className="space-y-2">
          {[
            {
              step: '1',
              title: 'Enable the display',
              desc: 'Toggle ON above — a new display window will open automatically.',
            },
            {
              step: '2',
              title: 'Position the window',
              desc: 'Drag the window to your customer-facing screen and maximize it.',
            },
            {
              step: '3',
              title: 'Real-time updates',
              desc: 'As items are added to the cart, the customer sees live prices and totals.',
            },
            {
              step: '4',
              title: 'Payment animation',
              desc: 'On payment completion, a beautiful thank-you animation is displayed.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-bg-card">
              <div className="w-6 h-6 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-[10px] font-bold text-accent flex-shrink-0 mt-0.5">
                {step}
              </div>
              <div>
                <p className="text-text-1 text-xs font-semibold">{title}</p>
                <p className="text-text-3 text-[11px] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status indicator */}
      <div
        className={`flex items-center gap-3 p-3 rounded-xl border ${
          customerDisplayEnabled
            ? 'border-success/30 bg-success/8'
            : 'border-border bg-bg-card'
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            customerDisplayEnabled ? 'bg-success animate-pulse' : 'bg-text-3'
          }`}
        />
        <div>
          <p className={`text-xs font-semibold ${customerDisplayEnabled ? 'text-success' : 'text-text-3'}`}>
            {customerDisplayEnabled ? 'Customer display is active' : 'Customer display is disabled'}
          </p>
          <p className="text-text-3 text-[10px] mt-0.5">
            {customerDisplayEnabled
              ? 'A display window is open and syncing with the cart.'
              : 'Enable to open the customer-facing display window.'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<SettingsSection>('general')

  const activeNav = NAV_ITEMS.find((n) => n.id === section)!

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-elevated border border-border rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
              <Settings className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-text-1 font-bold text-base">Settings</h2>
              <p className="text-text-3 text-xs">System configuration &amp; preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 flex-shrink-0 border-r border-border bg-bg-card/40 p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = item.id === section
              return (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                    active
                      ? 'bg-accent/12 border border-accent/25 text-accent'
                      : 'hover:bg-bg-hover text-text-2 border border-transparent hover:border-border/50'
                  }`}
                >
                  <div className={`mt-0.5 flex-shrink-0 ${active ? 'text-accent' : 'text-text-3'}`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${active ? 'text-accent' : 'text-text-1'}`}>
                      {item.label}
                    </p>
                    <p className="text-[10px] text-text-3 mt-0.5 leading-tight">{item.description}</p>
                  </div>
                  {active && <ChevronRight className="w-3 h-3 text-accent/60 flex-shrink-0 mt-1" />}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Section heading */}
            <div className="flex items-center gap-2 mb-5">
              <div className="text-accent">{activeNav.icon}</div>
              <div>
                <h3 className="text-text-1 font-bold text-sm">{activeNav.label}</h3>
                <p className="text-text-3 text-xs">{activeNav.description}</p>
              </div>
            </div>

            {section === 'general' && <GeneralSection />}
            {section === 'printer' && <PrinterSection onDone={onClose} />}
            {section === 'customer-display' && <CustomerDisplaySection />}
          </div>
        </div>

        {/* Footer (only for non-printer sections; printer has its own save) */}
        {section !== 'printer' && (
          <div className="flex items-center justify-end px-6 py-4 border-t border-border flex-shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
