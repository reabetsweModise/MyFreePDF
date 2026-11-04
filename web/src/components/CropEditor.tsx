import { useEffect, useRef, useState } from 'react'
import { Zap } from 'lucide-react'

interface CropRect { x1: number; y1: number; x2: number; y2: number }
type Handle = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'rc' | 'bc' | 'lc' | 'move'

interface Props {
  dataUrl: string
  onDone: (cropped: string) => void
  onCancel: () => void
}

// ── Auto-detect document bounds ───────────────────────────────────────────────
function detectBounds(img: HTMLImageElement): CropRect {
  const W = 320
  const H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W))
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, W, H)
  const { data } = ctx.getImageData(0, 0, W, H)

  const gray = (x: number, y: number) => {
    const i = (y * W + x) * 4
    return (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
  }

  // Sample the outer border strips to estimate background colour
  const bord = Math.max(2, Math.floor(Math.min(W, H) * 0.07))
  let sum = 0, cnt = 0
  for (let y = 0; y < H; y += 2) {
    for (let b = 0; b < bord; b++) { sum += gray(b, y) + gray(W - 1 - b, y); cnt += 2 }
  }
  for (let x = 0; x < W; x += 2) {
    for (let b = 0; b < bord; b++) { sum += gray(x, b) + gray(x, H - 1 - b); cnt += 2 }
  }
  const bg = cnt > 0 ? sum / cnt : 180

  const THRESH = 24
  let x1 = W, y1 = H, x2 = 0, y2 = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (Math.abs(gray(x, y) - bg) > THRESH) {
        if (x < x1) x1 = x; if (x > x2) x2 = x
        if (y < y1) y1 = y; if (y > y2) y2 = y
      }
    }
  }

  // Fallback: entire image with small inset
  if (x2 <= x1 || y2 <= y1 || (x2 - x1) < W * 0.15 || (y2 - y1) < H * 0.15) {
    return { x1: 0.03, y1: 0.03, x2: 0.97, y2: 0.97 }
  }

  const pad = 0.015
  return {
    x1: Math.max(0, x1 / W - pad), y1: Math.max(0, y1 / H - pad),
    x2: Math.min(1, x2 / W + pad), y2: Math.min(1, y2 / H + pad),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getImgRect(iw: number, ih: number, cw: number, ch: number) {
  const s = Math.min(cw / iw, ch / ih)
  const w = iw * s, h = ih * s
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }
}

function getHandlePositions(cx1: number, cy1: number, cx2: number, cy2: number) {
  const mx = (cx1 + cx2) / 2, my = (cy1 + cy2) / 2
  return [
    { id: 'tl' as Handle, x: cx1, y: cy1 }, { id: 'tr' as Handle, x: cx2, y: cy1 },
    { id: 'bl' as Handle, x: cx1, y: cy2 }, { id: 'br' as Handle, x: cx2, y: cy2 },
    { id: 'tc' as Handle, x: mx,  y: cy1 }, { id: 'rc' as Handle, x: cx2, y: my  },
    { id: 'bc' as Handle, x: mx,  y: cy2 }, { id: 'lc' as Handle, x: cx1, y: my  },
  ]
}

// ── Canvas render ─────────────────────────────────────────────────────────────
function renderCrop(
  canvas: HTMLCanvasElement,
  cssW: number, cssH: number,
  img: HTMLImageElement,
  crop: CropRect,
  activeH: Handle | null,
) {
  const dpr = window.devicePixelRatio || 1
  const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr)
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw; canvas.height = ph
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const ir = getImgRect(img.naturalWidth, img.naturalHeight, cssW, cssH)
  const cx1 = ir.x + crop.x1 * ir.w, cy1 = ir.y + crop.y1 * ir.h
  const cx2 = ir.x + crop.x2 * ir.w, cy2 = ir.y + crop.y2 * ir.h

  // Background + image
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, cssW, cssH)
  ctx.drawImage(img, ir.x, ir.y, ir.w, ir.h)

  // Dark overlay outside crop (4 rects forming a frame)
  ctx.fillStyle = 'rgba(0,0,0,0.58)'
  ctx.fillRect(0, 0, cssW, cy1)
  ctx.fillRect(0, cy2, cssW, cssH - cy2)
  ctx.fillRect(0, cy1, cx1, cy2 - cy1)
  ctx.fillRect(cx2, cy1, cssW - cx2, cy2 - cy1)

  // Rule-of-thirds grid
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1
  for (let i = 1; i < 3; i++) {
    const gx = cx1 + (cx2 - cx1) * i / 3, gy = cy1 + (cy2 - cy1) * i / 3
    ctx.beginPath(); ctx.moveTo(gx, cy1); ctx.lineTo(gx, cy2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx1, gy); ctx.lineTo(cx2, gy); ctx.stroke()
  }

  // Crop border
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5
  ctx.strokeRect(cx1, cy1, cx2 - cx1, cy2 - cy1)

  // Corner L-brackets (visual emphasis)
  const L = Math.max(12, Math.min(28, (cx2 - cx1) * 0.14, (cy2 - cy1) * 0.14))
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'square'
  ;([[cx1, cy1, 1, 1], [cx2, cy1, -1, 1], [cx1, cy2, 1, -1], [cx2, cy2, -1, -1]] as [number, number, number, number][])
    .forEach(([x, y, dx, dy]) => {
      ctx.beginPath()
      ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y)
      ctx.stroke()
    })

  // 8 drag handles
  getHandlePositions(cx1, cy1, cx2, cy2).forEach(({ id, x, y }) => {
    const active = id === activeH
    ctx.beginPath(); ctx.arc(x, y, active ? 10 : 7, 0, Math.PI * 2)
    ctx.fillStyle = active ? '#7c3aed' : 'rgba(255,255,255,0.92)'; ctx.fill()
    ctx.strokeStyle = active ? '#ede9fe' : '#7c3aed'; ctx.lineWidth = 2; ctx.stroke()
  })
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CropEditor({ dataUrl, onDone, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<CropRect>({ x1: 0.03, y1: 0.03, x2: 0.97, y2: 0.97 })
  const [activeHandle, setActiveHandle] = useState<Handle | null>(null)
  const [detecting, setDetecting] = useState(true)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const cropRef = useRef(crop)
  const dragRef = useRef<{ handle: Handle; startCrop: CropRect; startNx: number; startNy: number } | null>(null)

  useEffect(() => { cropRef.current = crop }, [crop])

  // Load image + run auto-detect
  useEffect(() => {
    setDetecting(true)
    const image = new window.Image()
    image.onload = () => {
      imgRef.current = image
      setImg(image)
      requestAnimationFrame(() => {
        setCrop(detectBounds(image))
        setDetecting(false)
      })
    }
    image.src = dataUrl
  }, [dataUrl])

  // Redraw on every relevant state change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      renderCrop(canvas, rect.width, rect.height, img, crop, activeHandle)
    }
  })

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { px: e.clientX - rect.left, py: e.clientY - rect.top, rect }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!img) return
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    const { px, py, rect } = getPos(e)
    const ir = getImgRect(img.naturalWidth, img.naturalHeight, rect.width, rect.height)
    const c = cropRef.current
    const cx1 = ir.x + c.x1 * ir.w, cy1 = ir.y + c.y1 * ir.h
    const cx2 = ir.x + c.x2 * ir.w, cy2 = ir.y + c.y2 * ir.h
    const handles = getHandlePositions(cx1, cy1, cx2, cy2)

    let nearest: Handle | null = null; let minD = 30
    handles.forEach(({ id, x, y }) => {
      const d = Math.hypot(px - x, py - y)
      if (d < minD) { minD = d; nearest = id }
    })
    if (!nearest && px > cx1 && px < cx2 && py > cy1 && py < cy2) nearest = 'move'

    if (nearest) {
      const nx = (px - ir.x) / ir.w, ny = (py - ir.y) / ir.h
      dragRef.current = { handle: nearest, startCrop: { ...c }, startNx: nx, startNy: ny }
      setActiveHandle(nearest)
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!img || !dragRef.current) return
    e.preventDefault()
    const { px, py, rect } = getPos(e)
    const ir = getImgRect(img.naturalWidth, img.naturalHeight, rect.width, rect.height)
    const curNx = (px - ir.x) / ir.w, curNy = (py - ir.y) / ir.h
    const { handle, startCrop: sc, startNx, startNy } = dragRef.current
    const MIN = 0.07
    let next = { ...sc }

    if (handle === 'move') {
      const w = sc.x2 - sc.x1, h = sc.y2 - sc.y1
      const nx1 = Math.max(0, Math.min(1 - w, sc.x1 + curNx - startNx))
      const ny1 = Math.max(0, Math.min(1 - h, sc.y1 + curNy - startNy))
      next = { x1: nx1, y1: ny1, x2: nx1 + w, y2: ny1 + h }
    } else {
      if (['tl', 'lc', 'bl'].includes(handle)) next.x1 = Math.min(sc.x2 - MIN, Math.max(0, curNx))
      if (['tr', 'rc', 'br'].includes(handle)) next.x2 = Math.max(sc.x1 + MIN, Math.min(1, curNx))
      if (['tl', 'tc', 'tr'].includes(handle)) next.y1 = Math.min(sc.y2 - MIN, Math.max(0, curNy))
      if (['bl', 'bc', 'br'].includes(handle)) next.y2 = Math.max(sc.y1 + MIN, Math.min(1, curNy))
    }

    cropRef.current = next
    setCrop(next)
  }

  const onPointerUp = () => { dragRef.current = null; setActiveHandle(null) }

  const autoDetect = () => {
    if (!imgRef.current) return
    setDetecting(true)
    setTimeout(() => {
      setCrop(detectBounds(imgRef.current!))
      setDetecting(false)
    }, 10)
  }

  const apply = () => {
    if (!img) return
    const iw = img.naturalWidth, ih = img.naturalHeight
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round((crop.x2 - crop.x1) * iw))
    c.height = Math.max(1, Math.round((crop.y2 - crop.y1) * ih))
    c.getContext('2d')!.drawImage(img, -crop.x1 * iw, -crop.y1 * ih, iw, ih)
    onDone(c.toDataURL('image/jpeg', 0.94))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none">
      {/* Header hint */}
      <div className="text-center py-2 text-xs text-gray-400">
        {detecting ? 'Detecting document edges…' : 'Drag handles to adjust crop'}
      </div>

      {/* Canvas fills remaining space */}
      <canvas
        ref={canvasRef}
        className="flex-1 w-full touch-none"
        style={{ cursor: activeHandle === 'move' ? 'move' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {/* Controls */}
      <div className="bg-black/90 px-4 pt-4 flex items-center gap-3"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))' }}>
        <button onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-gray-600 text-gray-300 text-sm font-semibold">
          Skip
        </button>
        <button onClick={autoDetect} disabled={detecting || !img}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-violet-500 text-violet-300 text-sm font-semibold disabled:opacity-40">
          <Zap className="w-4 h-4" />
          Auto
        </button>
        <button onClick={apply} disabled={!img}
          className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-40">
          Use Crop
        </button>
      </div>
    </div>
  )
}
