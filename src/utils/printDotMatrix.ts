import { invoke } from '@tauri-apps/api/core'

/**
 * Dot Matrix Print Utility for LassanaPata POS
 *
 * Fetches the print template config from localStorage (synced from the
 * Next.js main app), builds the receipt HTML, and triggers the print dialog.
 *
 * Usage:
 *   printDotMatrixReceipt(transaction, items, apiBase)
 *   reprintDotMatrixReceipt(transactionId, apiBase, token)
 */

const STORAGE_KEY = 'pos_print_template_config'

// ── Default template (must mirror the Next.js app default) ───────────────────
const DEFAULT_CONFIG = {
  paper_width_cm: 24,
  paper_height_cm: 14,
  header_height_cm: 3.5,
  invoice_no:  { right: 6,    bottom: 10 },
  customer:    { right: 6,    bottom: 9  },
  date:        { right: 19,   bottom: 10 },
  job_no:      { right: 19,   bottom: 9  },
  col_qty:     { left: 0,     bottom: 8  },
  col_desc:    { left: 3,     bottom: 8  },
  col_rate:    { left: 17.5,  bottom: 8  },
  col_amount:  { left: 19,    bottom: 8  },
  items_per_page: 10,
  row_height_cm: 0.5,
  totals_label_right: 5,
  totals_value_left: 19,
  totals_top_offset_cm: 0,
}

export type DotMatrixConfig = typeof DEFAULT_CONFIG

export interface PrintItem {
  qty: number
  desc: string
  rate: number
  amount: number
}

export interface PrintTotals {
  items_total: number
  paid_amount: number
  change_amount: number
  balance_due: number
}

export interface PrintData {
  invoice_no: string
  customer: string
  date: string
  job_no: string
  items: PrintItem[]
  totals?: PrintTotals
}

// ── Load config: try localStorage first, then use default ────────────────────
function loadConfig(): DotMatrixConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Deep-merge: nested position objects from server must not be null/partial
      const merged: DotMatrixConfig = { ...DEFAULT_CONFIG }
      for (const k of Object.keys(DEFAULT_CONFIG) as (keyof DotMatrixConfig)[]) {
        const def = DEFAULT_CONFIG[k]
        const srv = parsed[k]
        if (def !== null && typeof def === 'object') {
          // Only use server value if it has both required numeric fields
          if (srv && typeof srv === 'object' &&
              typeof (srv as any).bottom === 'number') {
            ;(merged as any)[k] = { ...def, ...srv }
          }
        } else if (srv !== undefined && srv !== null) {
          ;(merged as any)[k] = srv
        }
      }
      return merged
    }
  } catch {}
  return DEFAULT_CONFIG
}

// ── Fetch config from Next.js app and cache it locally ───────────────────────
export async function syncPrintConfig(apiBase: string): Promise<DotMatrixConfig> {
  try {
    const res = await fetch(`${apiBase}/api/pos/print-template-config`)
    if (res.ok) {
      const config = await res.json()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      return { ...DEFAULT_CONFIG, ...config }
    }
  } catch {}
  return loadConfig()
}

// ── Build the printable HTML page ────────────────────────────────────────────
function buildPrintHTML(config: DotMatrixConfig, data: PrintData): string {
  const {
    paper_width_cm, paper_height_cm,
    col_qty, col_desc, col_rate, col_amount,
    items_per_page, row_height_cm,
    invoice_no: invPos, customer: custPos, date: datePos, job_no: jobPos,
    totals_label_right, totals_value_left, totals_top_offset_cm,
  } = config

  // Convert "bottom from bottom" to "top from top" for CSS
  const topFromBottom = (bottomCm: number) => paper_height_cm - bottomCm

  const fieldCSS = (rightCm: number, bottomCm: number) =>
    `position:absolute;right:${rightCm}cm;top:${topFromBottom(bottomCm)}cm;` +
    `transform:translateY(-50%);font-family:monospace;font-size:10pt;font-weight:bold;white-space:nowrap;color:#000;`

  const colCSS = (leftCm: number, bottomCm: number) =>
    `position:absolute;left:${leftCm}cm;top:${topFromBottom(bottomCm)}cm;` +
    `transform:translateY(-50%);font-family:monospace;font-size:9pt;font-weight:bold;white-space:nowrap;color:#000;`

  const itemCSS = (leftCm: number, rowIndex: number, maxWidth?: string) =>
    `position:absolute;left:${leftCm}cm;` +
    `top:${topFromBottom(col_qty.bottom) + (rowIndex + 1) * row_height_cm}cm;` +
    `transform:translateY(-50%);font-family:monospace;font-size:9pt;white-space:nowrap;color:#000;` +
    (maxWidth ? `max-width:${maxWidth};overflow:hidden;` : '')

  // Split items into pages
  const pages: PrintItem[][] = []
  for (let i = 0; i < data.items.length; i += items_per_page) {
    pages.push(data.items.slice(i, i + items_per_page))
  }
  if (pages.length === 0) pages.push([])

  const descMaxWidth = `${col_rate.left - col_desc.left - 0.3}cm`

  const pageHTMLs = pages.map((pageItems, pageIdx) => `
    <div class="page" style="width:${paper_width_cm}cm;height:${paper_height_cm}cm;position:relative;overflow:hidden;box-sizing:border-box;">
      ${pageIdx === 0 ? `
        <div style="${fieldCSS(invPos.right, invPos.bottom)}">${escHtml(data.invoice_no)}</div>
        <div style="${fieldCSS(custPos.right, custPos.bottom)}">${escHtml(data.customer)}</div>
        <div style="${fieldCSS(datePos.right, datePos.bottom)}">${escHtml(data.date)}</div>
        <div style="${fieldCSS(jobPos.right, jobPos.bottom)}">${escHtml(data.job_no)}</div>
      ` : ''}
      ${pageItems.map((item, i) => `
        <div style="${itemCSS(col_qty.left, i)}">${escHtml(String(item.qty))}</div>
        <div style="${itemCSS(col_desc.left, i, descMaxWidth)}">${escHtml(item.desc)}</div>
        <div style="${itemCSS(col_rate.left, i)}">${item.rate.toFixed(2)}</div>
        <div style="${itemCSS(col_amount.left, i)}">${item.amount.toFixed(2)}</div>
      `).join('')}
      ${pageIdx === pages.length - 1 && data.totals ? (() => {
        const t = data.totals
        // Use items_per_page as fixed anchor so totals always stay at the same
        // position on the form regardless of how many items are in the cart.
        const lastItemRow = items_per_page
        const totalRowCSS = (row: number) =>
          `position:absolute;font-family:monospace;font-size:9pt;font-weight:bold;white-space:nowrap;color:#000;` +
          `top:${topFromBottom(col_qty.bottom) + (lastItemRow + row + 0.5) * row_height_cm + totals_top_offset_cm}cm;`
        // Use left+width+text-align instead of 'right' for IE/Trident compatibility
        const labelCSS = (row: number) => totalRowCSS(row) +
          `left:0;width:${paper_width_cm - totals_label_right}cm;text-align:right;transform:translateY(-50%);`
        const valueCSS = (row: number) => totalRowCSS(row) + `left:${totals_value_left}cm;transform:translateY(-50%);`
        const rows = [
          ['ITEMS TOTAL:', t.items_total.toFixed(2)],
          ['PAID AMOUNT:', t.paid_amount.toFixed(2)],
          ['CHANGE:', t.change_amount.toFixed(2)],
          ['BALANCE DUE:', t.balance_due.toFixed(2)],
        ]
        return rows.map(([label, val], i) =>
          `<div style="${labelCSS(i)}">${label}</div>` +
          `<div style="${valueCSS(i)}">${val}</div>`
        ).join('')
      })() : ''}
    </div>`.trim()).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${escHtml(data.invoice_no)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      width: ${paper_width_cm}cm;
      height: ${paper_height_cm}cm;
      overflow: hidden;
      background: white;
    }
    @page {
      size: ${paper_width_cm}cm ${paper_height_cm}cm;
      margin: 0;
    }
    @media print {
      html, body { margin: 0; padding: 0; overflow: hidden; }
      .page { page-break-inside: avoid; }
      .page:not(:last-child) { page-break-after: always; }
    }
  </style>
</head>
<body>${pageHTMLs}</body>
</html>`
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Open print window and trigger print ──────────────────────────────────────
function openAndPrint(html: string): void {
  const win = window.open('', '_blank', 'width=800,height=600,scrollbars=no')
  if (!win) {
    console.error('[DotMatrixPrint] Pop-up blocked — allow pop-ups for printing.')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  // Small delay to ensure content is fully rendered before printing
  setTimeout(() => {
    win.print()
    // Auto-close after print dialog dismissal
    win.onafterprint = () => win.close()
  }, 350)
}

// ── Shared: build HTML string from a transaction ─────────────────────────────
type ReceiptTransaction = {
  transaction_number: string
  customer_name?: string | null
  created_at?: string
  items?: Array<{
    product_name: string
    quantity: number
    unit_price: number
    line_total: number
  }>
}

export function buildReceiptHtml(transaction: ReceiptTransaction): string {
  const config = loadConfig()
  const date = transaction.created_at
    ? new Date(transaction.created_at).toLocaleDateString('en-LK')
    : new Date().toLocaleDateString('en-LK')

  const items: PrintItem[] = (transaction.items || []).map(item => ({
    qty: Number(item.quantity),
    desc: item.product_name,
    rate: Number(item.unit_price),
    amount: Number(item.line_total),
  }))

  const itemsTotal = items.reduce((s, i) => s + i.amount, 0)
  const paidAmount = (transaction as any).paid_amount ?? itemsTotal
  const changeAmount = (transaction as any).change_amount ?? 0
  const balanceDue = (transaction as any).balance_due ?? 0

  const data: PrintData = {
    invoice_no: transaction.transaction_number || '',
    customer: transaction.customer_name || 'CASH CUSTOMER',
    date,
    job_no: '',
    items,
    totals: {
      items_total: itemsTotal,
      paid_amount: paidAmount,
      change_amount: changeAmount,
      balance_due: balanceDue,
    },
  }

  return buildPrintHTML(config, data)
}

// ── Print silently to a specific Windows printer via Tauri command ────────────
// Falls back to the browser print dialog on failure.
export async function printWithWindowsPrinter(
  transaction: ReceiptTransaction,
  printerName: string,
  apiBase?: string,
): Promise<{ silent: boolean }> {
  // Fetch latest config from server before printing
  if (apiBase) await syncPrintConfig(apiBase)
  const html = buildReceiptHtml(transaction)

  try {
    await invoke('print_receipt_html', { html, printerName })
    return { silent: true }
  } catch (err) {
    console.warn('[DotMatrixPrint] Silent print failed, falling back to dialog:', err)
    openAndPrint(html)
    return { silent: false }
  }
}

// ── Print a just-completed sale receipt ──────────────────────────────────────
export async function printDotMatrixReceipt(
  transaction: ReceiptTransaction,
  apiBase?: string,
): Promise<void> {
  // Fetch latest config from server before printing
  if (apiBase) await syncPrintConfig(apiBase)
  openAndPrint(buildReceiptHtml(transaction))
}

// ── Reprint by fetching transaction data from API ─────────────────────────────
export async function reprintDotMatrixReceipt(
  transactionId: number,
  apiBase: string,
  token?: string,
): Promise<void> {
  try {
    const config = loadConfig()
    const headers: HeadersInit = token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }

    const res = await fetch(`${apiBase}/api/pos/transactions/${transactionId}`, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const result = await res.json()

    const tx = result.transaction
    const txItems = result.items || []

    const date = tx.created_at
      ? new Date(tx.created_at).toLocaleDateString('en-LK')
      : ''

    const items: PrintItem[] = txItems.map((item: any) => ({
      qty: Number(item.quantity),
      desc: String(item.product_name || ''),
      rate: Number(item.unit_price),
      amount: Number(item.line_total),
    }))

    const data: PrintData = {
      invoice_no: tx.transaction_number || '',
      customer: tx.customer_name || '',
      date,
      job_no: '',
      items,
    }

    openAndPrint(buildPrintHTML(config, data))
  } catch (err) {
    console.error('[DotMatrixPrint] Reprint failed:', err)
    throw err
  }
}
