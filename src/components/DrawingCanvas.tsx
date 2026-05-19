import { useRef, useEffect, useState } from 'react'
import { Pencil, Square, Circle, Minus, Eraser, Trash2, X, Check, RotateCcw } from 'lucide-react'

type Tool = 'pencil' | 'line' | 'rect' | 'circle' | 'eraser'

const PALETTE = [
  '#000000', '#374151', '#6B7280',
  '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#3B82F6', '#8B5CF6',
  '#EC4899', '#06B6D4', '#FFFFFF',
]

interface Props {
  value?: string
  onSave: (dataUrl: string) => void
  onClose: () => void
}

export function DrawingCanvas({ value, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pencil')
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(2)
  const [historyLen, setHistoryLen] = useState(0)

  // Refs for drawing state (avoid re-renders during drawing)
  const isDrawing = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const preSnap = useRef<ImageData | null>(null)
  const historyStack = useRef<ImageData[]>([])
  const initialized = useRef(false)

  // Initialize canvas on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (value && value.startsWith('data:image/')) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = value
    }
  }, [])

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function pushHistory(snap: ImageData) {
    historyStack.current = [...historyStack.current.slice(-29), snap]
    setHistoryLen(historyStack.current.length)
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    isDrawing.current = true
    startPos.current = pos
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height)
    preSnap.current = snap
    pushHistory(snap)
    if (tool === 'pencil' || tool === 'eraser') {
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    if (tool === 'pencil') {
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    } else if (tool === 'eraser') {
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = brushSize * 5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    } else if (preSnap.current) {
      ctx.putImageData(preSnap.current, 0, 0)
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize
      ctx.beginPath()
      if (tool === 'line') {
        ctx.moveTo(startPos.current.x, startPos.current.y)
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()
      } else if (tool === 'rect') {
        ctx.strokeRect(
          startPos.current.x, startPos.current.y,
          pos.x - startPos.current.x, pos.y - startPos.current.y
        )
      } else if (tool === 'circle') {
        const rx = (pos.x - startPos.current.x) / 2
        const ry = (pos.y - startPos.current.y) / 2
        ctx.ellipse(startPos.current.x + rx, startPos.current.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  function onMouseUp() {
    isDrawing.current = false
    preSnap.current = null
  }

  function undo() {
    if (!historyStack.current.length) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const prev = historyStack.current[historyStack.current.length - 1]
    ctx.putImageData(prev, 0, 0)
    historyStack.current = historyStack.current.slice(0, -1)
    setHistoryLen(historyStack.current.length)
  }

  function clear() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    historyStack.current = []
    setHistoryLen(0)
  }

  function save() {
    onSave(canvasRef.current!.toDataURL('image/png'))
  }

  const tools: { id: Tool; icon: React.ElementType; label: string }[] = [
    { id: 'pencil', icon: Pencil, label: 'Pencil' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Oval' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ]

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex flex-col rounded-2xl border border-border bg-bg-card shadow-2xl overflow-hidden"
        style={{ width: 760, maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border flex-shrink-0">
          <Pencil className="w-4 h-4 text-accent" />
          <span className="font-bold text-text-1 text-sm flex-1">Structure Drawing</span>
          <button onClick={undo} disabled={historyLen === 0} title="Undo"
            className="w-7 h-7 rounded-lg bg-bg-hover flex items-center justify-center text-text-3 hover:text-text-1 disabled:opacity-30 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={clear} title="Clear canvas"
            className="w-7 h-7 rounded-lg bg-bg-hover flex items-center justify-center text-danger hover:bg-danger/20 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={save}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors">
            <Check className="w-3.5 h-3.5" /> Save Drawing
          </button>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg bg-bg-hover flex items-center justify-center text-text-3 hover:text-text-1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border flex-shrink-0 flex-wrap bg-bg-elevated/40">
          {/* Tool buttons */}
          {tools.map(t => (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${tool === t.id ? 'bg-accent text-white' : 'bg-bg-elevated text-text-2 hover:bg-bg-hover'}`}>
              <t.icon className="w-4 h-4" />
            </button>
          ))}

          <div className="h-6 w-px bg-border mx-1" />

          {/* Colour palette */}
          <div className="flex items-center gap-1 flex-wrap">
            {PALETTE.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${color === c ? 'border-accent scale-125' : 'border-transparent hover:scale-110'}`}
                style={{ backgroundColor: c, boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px #bbb' : undefined }} />
            ))}
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-border" title="Custom colour" />
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Brush size */}
          <label className="flex items-center gap-2 text-[11px] text-text-3 select-none">
            Size
            <input type="range" min={1} max={20} value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))} className="w-20" />
            <span className="w-5 text-text-2">{brushSize}</span>
          </label>
        </div>

        {/* Canvas */}
        <div className="flex-1 min-h-0 overflow-auto p-3 bg-gray-600/20 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={700}
            height={430}
            className="border border-border rounded-lg bg-white cursor-crosshair select-none"
            style={{ maxWidth: '100%', display: 'block' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
        </div>
      </div>
    </div>
  )
}
