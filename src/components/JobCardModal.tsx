import { useState, useEffect } from 'react'
import {
  X, Save, Loader2, Scissors, Package, ChevronRight,
  CheckCircle, Link2, Plus, Trash2, PenLine, ImageIcon,
} from 'lucide-react'
import { useAuth, usePOS } from '../store'
import {
  apiCreatePlasticLaserJobCard,
  apiCreateEventProJobCard,
  apiLinkJobCard,
  apiGetPlasticLaserJobCards,
  apiGetEventProJobCards,
  type PlasticLaserJobCardInput,
  type EventProJobCardInput,
} from '../api'
import { DrawingCanvas } from './DrawingCanvas'

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'plastic-laser' | 'eventpro'

interface EPItem { item_name: string; item_code: string; qty: string; rate: string; amount: string }

interface Props {
  onClose: () => void
  /** If provided, the job card will be pre-linked to this transaction */
  posTransactionId?: number | null
  /** If provided, show link mode for existing cards */
  linkMode?: boolean
  onJobCardCreated?: (type: Tab, card: any) => void
}

// ── Shared input classes (matches POS dark theme) ─────────────────────────────
const IC = 'w-full bg-bg-card border border-border rounded-xl px-3 py-2 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/60 transition-colors'
const TA = `${IC} resize-none`

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold text-text-3 mb-1 uppercase tracking-wider">{children}</label>
}
function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}
function FieldWrap({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function JobCardModal({ onClose, posTransactionId, linkMode = false, onJobCardCreated }: Props) {
  const { user } = useAuth()
  const { selectedCustomer, setCustomer } = usePOS()
  const [tab, setTab] = useState<Tab>('plastic-laser')
  const [view, setView] = useState<'create' | 'link'>(linkMode ? 'link' : 'create')
  const [saved, setSaved] = useState<{ type: Tab; cardNo: string } | null>(null)

  // ── Plastic Laser form ─────────────────────────────────────────────────────
  const [pl, setPL] = useState<PlasticLaserJobCardInput>({
    date: new Date().toISOString().slice(0, 10),
    client_name: selectedCustomer?.name || '',
    customer_id: selectedCustomer?.id ?? null,
    pos_transaction_id: posTransactionId ?? null,
    created_by: user?.id ?? null,
  })
  const [savingPL, setSavingPL] = useState(false)
  const [errorPL, setErrorPL] = useState('')

  // ── EventPro form ──────────────────────────────────────────────────────────
  const [ep, setEP] = useState<EventProJobCardInput>({
    date: new Date().toISOString().slice(0, 10),
    customer_name: selectedCustomer?.name || '',
    customer_id: selectedCustomer?.id ?? null,
    tel: selectedCustomer?.phone || '',
    items: [],
    pos_transaction_id: posTransactionId ?? null,
    created_by: user?.id ?? null,
  })
  const [savingEP, setSavingEP] = useState(false)
  const [errorEP, setErrorEP] = useState('')

  // ── Link mode ──────────────────────────────────────────────────────────────
  const [linkSearch, setLinkSearch] = useState('')
  const [linkCards, setLinkCards] = useState<any[]>([])
  const [linkLoading, setLinkLoading] = useState(false)
  const [linking, setLinking] = useState<number | null>(null)

  useEffect(() => {
    if (view !== 'link') return
    const timer = setTimeout(fetchLinkCards, 300)
    return () => clearTimeout(timer)
  }, [view, tab, linkSearch])

  async function fetchLinkCards() {
    setLinkLoading(true)
    try {
      if (tab === 'plastic-laser') {
        const r = await apiGetPlasticLaserJobCards({ search: linkSearch, limit: 20 })
        setLinkCards(r.data || [])
      } else {
        const r = await apiGetEventProJobCards({ search: linkSearch, limit: 20 })
        setLinkCards(r.data || [])
      }
    } catch { /* ignore */ }
    setLinkLoading(false)
  }

  async function handleLink(card: any) {
    if (!posTransactionId) return
    setLinking(card.id)
    try {
      await apiLinkJobCard(tab, card.id, posTransactionId)
      onJobCardCreated?.(tab, card)
      setSaved({ type: tab, cardNo: tab === 'plastic-laser' ? card.job_card_no : card.job_no })
    } catch (e: any) { alert(e.message) }
    setLinking(null)
  }

  function setPlField(f: keyof PlasticLaserJobCardInput, v: any) {
    setPL(prev => ({ ...prev, [f]: v }))
  }
  function setEpField(f: keyof EventProJobCardInput, v: any) {
    setEP(prev => ({ ...prev, [f]: v }))
  }
  function setEPItem(idx: number, field: keyof EPItem, value: string) {
    setEP(prev => {
      const items = [...(prev.items || [])]
      items[idx] = { ...items[idx], [field]: value }
      if (field === 'qty' || field === 'rate') {
        const qty = parseFloat(field === 'qty' ? value : items[idx].qty) || 0
        const rate = parseFloat(field === 'rate' ? value : items[idx].rate) || 0
        items[idx].amount = qty && rate ? (qty * rate).toFixed(2) : ''
      }
      return { ...prev, items }
    })
  }
  function addEPItem() {
    setEP(prev => ({
      ...prev,
      items: [...(prev.items || []), { item_name: '', item_code: '', qty: '', rate: '', amount: '' }],
    }))
  }
  function removeEPItem(idx: number) {
    setEP(prev => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== idx),
    }))
  }

  async function savePL() {
    if (!pl.client_name.trim()) { setErrorPL('Client Name is required'); return }
    setSavingPL(true); setErrorPL('')
    try {
      const r = await apiCreatePlasticLaserJobCard(pl)
      onJobCardCreated?.('plastic-laser', r.data)
      setSaved({ type: 'plastic-laser', cardNo: r.job_card_no })
    } catch (e: any) { setErrorPL(e.message) }
    setSavingPL(false)
  }

  async function saveEP() {
    if (!ep.customer_name.trim()) { setErrorEP('Customer Name is required'); return }
    setSavingEP(true); setErrorEP('')
    try {
      const payload = { ...ep, items: ep.items?.filter(i => i.item_name || i.item_code) }
      const r = await apiCreateEventProJobCard(payload)
      onJobCardCreated?.('eventpro', r.data)
      setSaved({ type: 'eventpro', cardNo: r.job_no })
    } catch (e: any) { setErrorEP(e.message) }
    setSavingEP(false)
  }

  // ── Saved confirmation screen ──────────────────────────────────────────────
  if (saved) {
    return (
      <ModalShell onClose={onClose} title="Job Card Saved">
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <div className="text-center">
            <p className="text-text-1 font-bold text-lg">
              {saved.type === 'plastic-laser' ? 'Plastic/Laser' : 'EventPro'} Job Card Created
            </p>
            <p className="text-accent font-mono text-sm mt-1">{saved.cardNo}</p>
            {posTransactionId && (
              <p className="text-text-3 text-xs mt-2">Linked to Transaction #{posTransactionId}</p>
            )}
          </div>
          <button onClick={onClose}
            className="mt-4 px-6 py-2 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-hover transition-colors">
            Done
          </button>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell onClose={onClose} title="Job Card">
      {/* Tab + View switcher */}
      <div className="px-5 pt-4 pb-0">
        {/* Type tabs */}
        <div className="flex gap-1 bg-bg-primary rounded-xl p-1 border border-border mb-3">
          {(['plastic-laser', 'eventpro'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === t ? 'bg-accent text-white shadow-sm' : 'text-text-3 hover:text-text-1'
              }`}>
              {t === 'plastic-laser' ? <><Scissors className="w-3.5 h-3.5" />Plastic / Laser</> : <><Package className="w-3.5 h-3.5" />EventPro</>}
            </button>
          ))}
        </div>

        {/* View mode switcher (only when posTransactionId is set) */}
        {posTransactionId != null && (
          <div className="flex gap-1 mb-3">
            {(['create', 'link'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  view === v ? 'bg-bg-elevated text-text-1 border border-border' : 'text-text-3 hover:text-text-2'
                }`}>
                {v === 'create' ? '+ Create New' : 'Link Existing'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
        {view === 'link' ? (
          <LinkView
            cards={linkCards} loading={linkLoading} search={linkSearch}
            onSearch={setLinkSearch} linking={linking}
            type={tab} posTransactionId={posTransactionId}
            onLink={handleLink} />
        ) : tab === 'plastic-laser' ? (
          <PLForm form={pl} onChange={setPlField} error={errorPL} />
        ) : (
          <EPForm form={ep} onChange={setEpField} onItem={setEPItem} onAddItem={addEPItem} onRemoveItem={removeEPItem} error={errorEP} />
        )}
      </div>

      {/* Footer */}
      {view === 'create' && (
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-border flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl bg-bg-elevated border border-border text-text-2 hover:text-text-1 text-xs font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={tab === 'plastic-laser' ? savePL : saveEP}
            disabled={savingPL || savingEP}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {(savingPL || savingEP) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Create Job Card
          </button>
        </div>
      )}
    </ModalShell>
  )
}

// ── Modal Shell ───────────────────────────────────────────────────────────────
function ModalShell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[88vh] flex flex-col rounded-2xl border border-border bg-bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-shrink-0">
          <div className="flex-1 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5 text-accent" />
            </div>
            <span className="font-bold text-text-1 text-sm">{title}</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-bg-hover flex items-center justify-center text-text-3 hover:text-text-1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Plastic/Laser Form ────────────────────────────────────────────────────────
function PLForm({ form, onChange, error }: {
  form: PlasticLaserJobCardInput
  onChange: (f: keyof PlasticLaserJobCardInput, v: any) => void
  error: string
}) {
  const { customers, setCustomer } = usePOS()
  const [showDrawing, setShowDrawing] = useState(false)
  const isDrawing = form.structure?.startsWith('data:image/')

  function handleClientChange(name: string) {
    onChange('client_name', name)
    const match = customers.find(c => c.name === name)
    if (match) {
      setCustomer(match)
      onChange('customer_id', match.id)
    } else {
      onChange('customer_id', null)
    }
  }

  return (
    <div className="space-y-3 py-1">
      {showDrawing && (
        <DrawingCanvas
          value={form.structure || ''}
          onSave={(dataUrl) => { onChange('structure', dataUrl); setShowDrawing(false) }}
          onClose={() => setShowDrawing(false)}
        />
      )}
      <Row2>
        <div><Label>Date</Label><input type="date" value={form.date || ''} onChange={e => onChange('date', e.target.value)} className={IC} /></div>
        <div><Label>Time</Label><input type="time" value={form.time || ''} onChange={e => onChange('time', e.target.value)} className={IC} /></div>
      </Row2>
      <Row2>
        <div>
          <Label>Client Name *</Label>
          <input
            list="pl-customers-list"
            value={form.client_name}
            onChange={e => handleClientChange(e.target.value)}
            placeholder="Select or type client name…"
            className={IC}
          />
          <datalist id="pl-customers-list">
            {customers.map(c => <option key={c.id} value={c.name} />)}
          </datalist>
        </div>
        <div><Label>Artwork By</Label><input value={form.artwork_by || ''} onChange={e => onChange('artwork_by', e.target.value)} placeholder="Designer…" className={IC} /></div>
      </Row2>
      <Row2>
        <div><Label>Job Name</Label><input value={form.job_name || ''} onChange={e => onChange('job_name', e.target.value)} placeholder="Job name…" className={IC} /></div>
        <div><Label>Authorised By</Label><input value={form.autho_by || ''} onChange={e => onChange('autho_by', e.target.value)} placeholder="Authorised by…" className={IC} /></div>
      </Row2>
      <div><Label>Material</Label><textarea rows={2} value={form.material || ''} onChange={e => onChange('material', e.target.value)} placeholder="Material details…" className={TA} /></div>
      <Row2>
        <div><Label>Board Type</Label><input value={form.board_type || ''} onChange={e => onChange('board_type', e.target.value)} placeholder="Board type…" className={IC} /></div>
        <div><Label>Size & Qty</Label><input value={form.size_qty || ''} onChange={e => onChange('size_qty', e.target.value)} placeholder="e.g. 4×3 ft × 10" className={IC} /></div>
      </Row2>
      {/* Structure / Layout field with drawing canvas */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Structure / Layout</Label>
          <button type="button" onClick={() => setShowDrawing(true)}
            className="flex items-center gap-1 text-[10px] text-accent hover:underline font-semibold">
            <PenLine className="w-3 h-3" />{isDrawing ? 'Edit Drawing' : 'Open Drawing'}
          </button>
        </div>
        {isDrawing ? (
          <div className="relative rounded-xl border border-accent/30 overflow-hidden bg-bg-elevated">
            <img src={form.structure} className="w-full max-h-32 object-contain" />
            <button type="button"
              onClick={() => onChange('structure', '')}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-danger/80 text-white flex items-center justify-center text-[10px] hover:bg-danger">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <textarea rows={2} value={form.structure || ''} onChange={e => onChange('structure', e.target.value)} placeholder="Structure description… or click Open Drawing" className={TA} />
        )}
      </div>
      <div><Label>Special Note</Label><textarea rows={2} value={form.special_note || ''} onChange={e => onChange('special_note', e.target.value)} placeholder="Special instructions…" className={TA} /></div>
      <Row2>
        <div><Label>Laser Cut Time</Label><input value={form.laser_cut_time || ''} onChange={e => onChange('laser_cut_time', e.target.value)} placeholder="e.g. 2h 30m" className={IC} /></div>
        <div><Label>CNC Cut Time</Label><input value={form.cnc_cut_time || ''} onChange={e => onChange('cnc_cut_time', e.target.value)} placeholder="e.g. 1h" className={IC} /></div>
      </Row2>
      <Row2>
        <div><Label>Delivery Date</Label><input type="date" value={form.delivery_date || ''} onChange={e => onChange('delivery_date', e.target.value)} className={IC} /></div>
        <div><Label>Delivery Time</Label><input type="time" value={form.delivery_time || ''} onChange={e => onChange('delivery_time', e.target.value)} className={IC} /></div>
      </Row2>
      <div><Label>Invoice No</Label><input value={form.invoice_no || ''} onChange={e => onChange('invoice_no', e.target.value)} placeholder="Invoice number…" className={IC} /></div>
      {error && <div className="rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs px-3 py-2">{error}</div>}
    </div>
  )
}

// ── EventPro Form ─────────────────────────────────────────────────────────────
function EPForm({ form, onChange, onItem, onAddItem, onRemoveItem, error }: {
  form: EventProJobCardInput
  onChange: (f: keyof EventProJobCardInput, v: any) => void
  onItem: (idx: number, field: keyof EPItem, value: string) => void
  onAddItem: () => void
  onRemoveItem: (idx: number) => void
  error: string
}) {
  const { customers, setCustomer } = usePOS()
  const items = form.items || []
  const tdin = 'w-full bg-transparent text-text-1 text-[11px] px-1 py-1 focus:outline-none placeholder:text-text-3/50'

  function handleCustomerChange(name: string) {
    onChange('customer_name', name)
    const match = customers.find(c => c.name === name)
    if (match) {
      setCustomer(match)
      onChange('customer_id', match.id)
      if (!form.tel) onChange('tel', match.phone || '')
    } else {
      onChange('customer_id', null)
    }
  }

  return (
    <div className="space-y-3 py-1">
      <div className="grid grid-cols-3 gap-2">
        <div><Label>Autho. By</Label><input value={form.autho_by || ''} onChange={e => onChange('autho_by', e.target.value)} placeholder="Author…" className={IC} /></div>
        <div><Label>Date</Label><input type="date" value={form.date || ''} onChange={e => onChange('date', e.target.value)} className={IC} /></div>
        <div><Label>Invoice No</Label><input value={form.invoice_no || ''} onChange={e => onChange('invoice_no', e.target.value)} placeholder="Inv…" className={IC} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label>Artwork By</Label><input value={form.artwork_by || ''} onChange={e => onChange('artwork_by', e.target.value)} placeholder="Designer…" className={IC} /></div>
        <div><Label>Design Fee</Label><input type="number" step="0.01" value={form.design_fee || ''} onChange={e => onChange('design_fee', e.target.value)} placeholder="0.00" className={IC} /></div>
        <div />
      </div>
      <div className="h-px bg-border" />
      <Row2>
        <div>
          <Label>Customer Name *</Label>
          <input
            list="ep-customers-list"
            value={form.customer_name}
            onChange={e => handleCustomerChange(e.target.value)}
            placeholder="Select or type customer name…"
            className={IC}
          />
          <datalist id="ep-customers-list">
            {customers.map(c => <option key={c.id} value={c.name} />)}
          </datalist>
        </div>
        <div><Label>Job Title</Label><input value={form.job_title || ''} onChange={e => onChange('job_title', e.target.value)} placeholder="Job title…" className={IC} /></div>
      </Row2>
      <div><Label>Tel</Label><input value={form.tel || ''} onChange={e => onChange('tel', e.target.value)} placeholder="Phone…" className={IC} /></div>
      <div className="h-px bg-border" />
      <div className="grid grid-cols-3 gap-2">
        <div><Label>Plastic Material</Label><input value={form.plastic_material_detail || ''} onChange={e => onChange('plastic_material_detail', e.target.value)} placeholder="Material…" className={IC} /></div>
        <div><Label>Plastic Sqft</Label><input type="number" step="0.001" value={form.plastic_sqft || ''} onChange={e => onChange('plastic_sqft', e.target.value)} placeholder="0.000" className={IC} /></div>
        <div><Label>Other</Label><input value={form.other_details || ''} onChange={e => onChange('other_details', e.target.value)} placeholder="Other…" className={IC} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label>Sticker Type</Label><input value={form.sticker_type || ''} onChange={e => onChange('sticker_type', e.target.value)} placeholder="Type…" className={IC} /></div>
        <div><Label>Sticker Sqft</Label><input type="number" step="0.001" value={form.sticker_sqft || ''} onChange={e => onChange('sticker_sqft', e.target.value)} placeholder="0.000" className={IC} /></div>
        <div><Label>Delivery Date</Label><input type="date" value={form.to_be_delivered_date || ''} onChange={e => onChange('to_be_delivered_date', e.target.value)} className={IC} /></div>
      </div>
      <div className="h-px bg-border" />
      {/* Items mini table */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Items</Label>
          <button type="button" onClick={onAddItem}
            className="flex items-center gap-1 text-[10px] text-accent hover:underline font-semibold">
            <Plus className="w-3 h-3" />Add Item
          </button>
        </div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-bg-elevated/40 py-6 text-center text-text-3 text-xs">
            No items added yet. Click <span className="text-accent font-semibold">Add Item</span> to start.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-bg-elevated border-b border-border">
                  <th className="px-2 py-1.5 text-left text-text-3 w-5">#</th>
                  <th className="px-1 py-1.5 text-left text-text-3">Item Name</th>
                  <th className="px-1 py-1.5 text-left text-text-3 w-20">Code</th>
                  <th className="px-1 py-1.5 text-left text-text-3 w-12">Qty</th>
                  <th className="px-1 py-1.5 text-left text-text-3 w-16">Rate</th>
                  <th className="px-1 py-1.5 text-left text-text-3 w-16">Amt</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-bg-hover/40">
                    <td className="px-2 py-0.5 text-text-3">{i + 1}.</td>
                    <td className="px-1 py-0.5"><input value={item.item_name} onChange={e => onItem(i, 'item_name', e.target.value)} placeholder="Item…" className={tdin} /></td>
                    <td className="px-1 py-0.5"><input value={item.item_code} onChange={e => onItem(i, 'item_code', e.target.value)} placeholder="Code…" className={tdin} /></td>
                    <td className="px-1 py-0.5"><input type="number" value={item.qty} onChange={e => onItem(i, 'qty', e.target.value)} placeholder="0" className={tdin} /></td>
                    <td className="px-1 py-0.5"><input type="number" step="0.01" value={item.rate} onChange={e => onItem(i, 'rate', e.target.value)} placeholder="0.00" className={tdin} /></td>
                    <td className="px-1 py-0.5 text-text-2 font-mono">{item.amount || '—'}</td>
                    <td className="px-1 py-0.5">
                      <button type="button" onClick={() => onRemoveItem(i)}
                        className="w-4 h-4 flex items-center justify-center text-text-3 hover:text-danger transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div><Label>Special Note</Label><textarea rows={2} value={form.description_special_note || ''} onChange={e => onChange('description_special_note', e.target.value)} placeholder="Notes…" className={TA} /></div>
      <Row2>
        <div><Label>Finished By</Label><input value={form.finished_by || ''} onChange={e => onChange('finished_by', e.target.value)} placeholder="Name…" className={IC} /></div>
        <div><Label>Checked By</Label><input value={form.checked_by || ''} onChange={e => onChange('checked_by', e.target.value)} placeholder="Date/Name…" className={IC} /></div>
      </Row2>
      {error && <div className="rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs px-3 py-2">{error}</div>}
    </div>
  )
}

// ── Link View ─────────────────────────────────────────────────────────────────
function LinkView({ cards, loading, search, onSearch, linking, type, posTransactionId, onLink }: {
  cards: any[]; loading: boolean; search: string; onSearch: (s: string) => void
  linking: number | null; type: Tab; posTransactionId?: number | null
  onLink: (card: any) => void
}) {
  return (
    <div className="space-y-3 py-1">
      <div className="relative">
        <input value={search} onChange={e => onSearch(e.target.value)}
          placeholder={`Search ${type === 'plastic-laser' ? 'Plastic/Laser' : 'EventPro'} cards…`}
          className={`${IC} pl-3`} />
      </div>
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-bg-elevated animate-pulse" />)}
        </div>
      ) : !cards.length ? (
        <div className="text-center py-10 text-text-3 text-sm">No job cards found</div>
      ) : (
        <div className="space-y-2">
          {cards.map(c => (
            <div key={c.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                c.pos_transaction_id ? 'border-border bg-bg-elevated opacity-60' : 'border-border bg-bg-elevated hover:border-accent/40 hover:bg-bg-hover'
              }`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-accent font-mono">{type === 'plastic-laser' ? c.job_card_no : c.job_no}</p>
                <p className="text-sm text-text-1 truncate">{type === 'plastic-laser' ? c.client_name : c.customer_name}</p>
                <p className="text-[10px] text-text-3">{c.date?.slice(0, 10)}</p>
              </div>
              {c.pos_transaction_id ? (
                <span className="text-[10px] text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Link2 className="w-2.5 h-2.5" />#{c.pos_transaction_id}
                </span>
              ) : (
                <button onClick={() => onLink(c)} disabled={!posTransactionId || linking === c.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50">
                  {linking === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                  Link
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
