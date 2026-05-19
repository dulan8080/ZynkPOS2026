import { useState, useEffect, useRef } from 'react'
import { X, Search, Scissors, Package, ChevronLeft, ChevronRight } from 'lucide-react'
import { apiGetPlasticLaserJobCards, apiGetEventProJobCards } from '../api'

type Tab = 'plastic-laser' | 'eventpro'

const IC = 'w-full bg-bg-card border border-border rounded-xl px-3 py-2 text-text-1 text-sm placeholder:text-text-3 focus:outline-none focus:border-accent/60 transition-colors'

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-[10px] font-semibold text-text-3 mb-0.5 uppercase tracking-wider">{children}</span>
}

function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: 'default' | 'accent' | 'success' }) {
  const cls = {
    default: 'bg-bg-elevated border-border text-text-3',
    accent: 'bg-accent/10 border-accent/30 text-accent',
    success: 'bg-success/10 border-success/30 text-success',
  }[color]
  return <span className={`inline-flex items-center gap-1 text-[10px] font-bold border rounded-full px-2 py-0.5 ${cls}`}>{children}</span>
}

// ── Structure preview popup ────────────────────────────────────────────────────
function StructurePreview({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative max-w-2xl w-full bg-bg-card rounded-2xl border border-border shadow-2xl p-2">
        <button onClick={onClose} className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-bg-hover flex items-center justify-center text-text-3 hover:text-text-1 z-10">
          <X className="w-4 h-4" />
        </button>
        <img src={src} alt="Structure Drawing" className="w-full rounded-xl object-contain max-h-[80vh] bg-white" />
      </div>
    </div>
  )
}

// ── Field display helpers ──────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <Label>{label}</Label>
      <p className="text-xs text-text-1 whitespace-pre-wrap">{String(value)}</p>
    </div>
  )
}

// ── Plastic/Laser detail dialog ────────────────────────────────────────────────
function PLDetailDialog({ card, onClose }: { card: any; onClose: () => void }) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const drawingSrc = card.structure_drawing || (card.structure?.startsWith('data:image') ? card.structure : null)
  const structureText = card.structure && !card.structure.startsWith('data:image') ? card.structure : null
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      {previewSrc && <StructurePreview src={previewSrc} onClose={() => setPreviewSrc(null)} />}
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border bg-bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
            <Scissors className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-1">{card.client_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge color="accent">{card.job_card_no}</Badge>
              {card.pos_transaction_id && <Badge color="success">POS #{card.pos_transaction_id}</Badge>}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-bg-hover flex items-center justify-center text-text-3 hover:text-text-1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" value={card.date?.slice(0, 10)} />
            <Field label="Time" value={card.time} />
            <Field label="Job Name" value={card.job_name} />
            <Field label="Authorised By" value={card.autho_by} />
            <Field label="Artwork By" value={card.artwork_by} />
            <Field label="Invoice No" value={card.invoice_no} />
            <Field label="Material" value={card.material} />
            <Field label="Board Type" value={card.board_type} />
            <Field label="Size / Qty" value={card.size_qty} />
            <Field label="Delivery Date" value={card.delivery_date?.slice(0, 10)} />
            <Field label="Delivery Time" value={card.delivery_time} />
            <Field label="Laser Cut Time" value={card.laser_cut_time} />
            <Field label="CNC Cut Time" value={card.cnc_cut_time} />
          </div>
          {structureText && (
            <div>
              <Label>Structure</Label>
              <p className="text-xs text-text-1 whitespace-pre-wrap bg-bg-elevated rounded-xl p-3 border border-border">{structureText}</p>
            </div>
          )}
          {drawingSrc && (
            <div>
              <Label>Structure Drawing</Label>
              <button
                type="button"
                onClick={() => setPreviewSrc(drawingSrc)}
                className="w-full rounded-xl border border-border overflow-hidden bg-white hover:border-accent/60 transition-colors"
                title="Click to enlarge"
              >
                <img src={drawingSrc} alt="Structure Drawing" className="w-full object-contain max-h-52" />
              </button>
            </div>
          )}
          {card.special_note && (
            <div>
              <Label>Special Note</Label>
              <p className="text-xs text-text-1 whitespace-pre-wrap bg-bg-elevated rounded-xl p-3 border border-border">{card.special_note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── EventPro detail dialog ─────────────────────────────────────────────────────
function EPDetailDialog({ card, onClose }: { card: any; onClose: () => void }) {
  const items: any[] = Array.isArray(card.items) ? card.items.filter((i: any) => i.item_name || i.item_code || i.qty || i.rate) : []
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border bg-bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
            <Package className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-1">{card.customer_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge color="accent">{card.job_no}</Badge>
              {card.pos_transaction_id && <Badge color="success">POS #{card.pos_transaction_id}</Badge>}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-bg-hover flex items-center justify-center text-text-3 hover:text-text-1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" value={card.date?.slice(0, 10)} />
            <Field label="Job Title" value={card.job_title} />
            <Field label="Tel" value={card.tel} />
            <Field label="Authorised By" value={card.autho_by} />
            <Field label="Artwork By" value={card.artwork_by} />
            <Field label="Invoice No" value={card.invoice_no} />
            <Field label="Design Fee" value={card.design_fee} />
            <Field label="Delivery Date" value={card.to_be_delivered_date?.slice(0, 10)} />
            <Field label="Sticker Type" value={card.sticker_type} />
            <Field label="Sticker Sqft" value={card.sticker_sqft} />
            <Field label="Plastic Material" value={card.plastic_material_detail} />
            <Field label="Plastic Sqft" value={card.plastic_sqft} />
            <Field label="Finished By" value={card.finished_by} />
            <Field label="Checked By" value={card.checked_by} />
          </div>
          {card.other_details && (
            <div>
              <Label>Other Details</Label>
              <p className="text-xs text-text-1 whitespace-pre-wrap bg-bg-elevated rounded-xl p-3 border border-border">{card.other_details}</p>
            </div>
          )}
          {card.description_special_note && (
            <div>
              <Label>Special Note / Description</Label>
              <p className="text-xs text-text-1 whitespace-pre-wrap bg-bg-elevated rounded-xl p-3 border border-border">{card.description_special_note}</p>
            </div>
          )}
          {card.for_store_use && (
            <div>
              <Label>For Store Use</Label>
              <p className="text-xs text-text-1 whitespace-pre-wrap bg-bg-elevated rounded-xl p-3 border border-border">{card.for_store_use}</p>
            </div>
          )}
          {items.length > 0 && (
            <div>
              <Label>Items</Label>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-bg-elevated">
                    <tr>
                      <th className="px-3 py-2 text-left text-text-3 font-semibold">Item</th>
                      <th className="px-3 py-2 text-left text-text-3 font-semibold">Code</th>
                      <th className="px-3 py-2 text-right text-text-3 font-semibold">Qty</th>
                      <th className="px-3 py-2 text-right text-text-3 font-semibold">Rate</th>
                      <th className="px-3 py-2 text-right text-text-3 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-text-1">{item.item_name}</td>
                        <td className="px-3 py-2 text-text-2">{item.item_code}</td>
                        <td className="px-3 py-2 text-right text-text-2">{item.qty}</td>
                        <td className="px-3 py-2 text-right text-text-2">{item.rate}</td>
                        <td className="px-3 py-2 text-right text-text-1 font-medium">{item.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {card.items_released_from_stores && (
            <div>
              <Label>Items Released from Stores</Label>
              <p className="text-xs text-text-1 whitespace-pre-wrap bg-bg-elevated rounded-xl p-3 border border-border">{card.items_released_from_stores}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Plastic/Laser card row ─────────────────────────────────────────────────────
function PLRow({ card, onClick }: { card: any; onClick: () => void }) {
  const drawingSrc = card.structure_drawing || (card.structure?.startsWith('data:image') ? card.structure : null)
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-bg-elevated transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge color="accent">{card.job_card_no}</Badge>
          <span className="text-[10px] text-text-3">{card.date?.slice(0, 10)}</span>
          {card.pos_transaction_id && <Badge color="success">POS #{card.pos_transaction_id}</Badge>}
        </div>
        <p className="text-sm font-semibold text-text-1 truncate">{card.client_name}</p>
        {card.job_name && <p className="text-[11px] text-text-2 truncate">{card.job_name}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {card.material && <span className="text-[10px] text-text-3 truncate max-w-[160px]">{card.material}</span>}
          {card.size_qty && <span className="text-[10px] text-text-3">{card.size_qty}</span>}
          {card.delivery_date && <span className="text-[10px] text-text-3">Delivery: {card.delivery_date?.slice(0, 10)}</span>}
        </div>
        {card.structure && !card.structure.startsWith('data:image') && (
          <p className="text-[10px] text-text-3 mt-1 truncate max-w-xs">{card.structure}</p>
        )}
      </div>
      {drawingSrc && (
        <div className="flex-shrink-0 w-16 h-16 rounded-xl border border-border overflow-hidden bg-white">
          <img src={drawingSrc} alt="Structure" className="w-full h-full object-contain" />
        </div>
      )}
    </button>
  )
}

// ── EventPro card row ─────────────────────────────────────────────────────────
function EPRow({ card, onClick }: { card: any; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-bg-elevated transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge color="accent">{card.job_no}</Badge>
          <span className="text-[10px] text-text-3">{card.date?.slice(0, 10)}</span>
          {card.pos_transaction_id && <Badge color="success">POS #{card.pos_transaction_id}</Badge>}
        </div>
        <p className="text-sm font-semibold text-text-1 truncate">{card.customer_name}</p>
        {card.job_title && <p className="text-[11px] text-text-2 truncate">{card.job_title}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {card.autho_by && <span className="text-[10px] text-text-3">Autho: {card.autho_by}</span>}
          {card.to_be_delivered_date && <span className="text-[10px] text-text-3">Delivery: {card.to_be_delivered_date?.slice(0, 10)}</span>}
          {card.invoice_no && <span className="text-[10px] text-text-3">Inv: {card.invoice_no}</span>}
        </div>
      </div>
    </button>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function JobCardsListModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('plastic-laser')
  const [search, setSearch] = useState('')
  const [cards, setCards] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<{ type: Tab; card: any } | null>(null)
  const limit = 20
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setPage(1)
    setCards([])
  }, [tab, search])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(fetchCards, 250)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [tab, search, page])

  async function fetchCards() {
    setLoading(true)
    try {
      const params = { page, limit, search }
      const res = tab === 'plastic-laser'
        ? await apiGetPlasticLaserJobCards(params)
        : await apiGetEventProJobCards(params)
      setCards(res.data || [])
      setTotal(res.total || 0)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-border bg-bg-card shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
            <Scissors className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="font-bold text-text-1 text-sm flex-1">All Job Cards</span>
          <span className="text-[11px] text-text-3">{total} total</span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-bg-hover flex items-center justify-center text-text-3 hover:text-text-1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs + Search */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0 space-y-2">
          <div className="flex gap-1 bg-bg-primary rounded-xl p-1 border border-border">
            {(['plastic-laser', 'eventpro'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tab === t ? 'bg-accent text-white shadow-sm' : 'text-text-3 hover:text-text-1'
                }`}>
                {t === 'plastic-laser'
                  ? <><Scissors className="w-3.5 h-3.5" />Plastic / Laser</>
                  : <><Package className="w-3.5 h-3.5" />EventPro</>}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-3" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'plastic-laser' ? 'Search by client name, job card no…' : 'Search by customer name, job no…'}
              className={`${IC} pl-9`}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-text-3 text-sm">Loading…</div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-3">
              <Scissors className="w-8 h-8 opacity-30" />
              <span className="text-sm">No job cards found</span>
            </div>
          ) : (
            tab === 'plastic-laser'
              ? cards.map(c => <PLRow key={c.id} card={c} onClick={() => setSelected({ type: 'plastic-laser', card: c })} />)
              : cards.map(c => <EPRow key={c.id} card={c} onClick={() => setSelected({ type: 'eventpro', card: c })} />)
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-border flex-shrink-0">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-7 h-7 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-2 hover:text-text-1 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-text-3">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-7 h-7 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-2 hover:text-text-1 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
    {selected?.type === 'plastic-laser' && <PLDetailDialog card={selected.card} onClose={() => setSelected(null)} />}
    {selected?.type === 'eventpro' && <EPDetailDialog card={selected.card} onClose={() => setSelected(null)} />}
    </>
  )
}
