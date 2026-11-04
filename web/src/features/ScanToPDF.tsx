import { useState } from 'react'
import { Camera, X, ImageIcon } from 'lucide-react'
import jsPDF from 'jspdf'
import ProgressBar from '../components/ProgressBar'
import ResultCard from '../components/ResultCard'

interface ScannedPage {
  id: string
  dataUrl: string
}

type ScanMode = 'document' | 'grayscale' | 'color'
type PageSize = 'a4' | 'fit'

const MODES: { id: ScanMode; label: string; desc: string; cssFilter: string }[] = [
  {
    id: 'document',
    label: 'Document',
    desc: 'B&W high contrast — text & forms',
    cssFilter: 'grayscale(100%) contrast(1.6) brightness(1.15)',
  },
  {
    id: 'grayscale',
    label: 'Grayscale',
    desc: 'Natural grey tones',
    cssFilter: 'grayscale(100%) contrast(1.15) brightness(1.05)',
  },
  {
    id: 'color',
    label: 'Color',
    desc: 'Enhanced color scan',
    cssFilter: 'contrast(1.2) saturate(1.15) brightness(1.05)',
  },
]

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new window.Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

function readFiles(files: FileList): Promise<ScannedPage[]> {
  return Promise.all(
    Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => new Promise<ScannedPage>((res, rej) => {
        const reader = new FileReader()
        reader.onload = e => res({ id: `${Date.now()}-${Math.random()}`, dataUrl: e.target!.result as string })
        reader.onerror = rej
        reader.readAsDataURL(f)
      }))
  )
}

/**
 * Apply scanner-style processing to an image on a canvas.
 * Returns a JPEG data URL.
 */
function applyScanEffect(img: HTMLImageElement, mode: ScanMode, noisy: boolean): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!

  // White paper background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)

  const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = id.data

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2]

    if (mode === 'document') {
      // Convert to gray
      let v = 0.299 * r + 0.587 * g + 0.114 * b
      // Gamma: brightens mid-tones / whites (simulates scanner auto-exposure)
      v = Math.pow(v / 255, 0.65) * 255
      // High contrast push — dark text goes dark, white background goes white
      v = (v - 128) * 2.0 + 128
      if (noisy) v += (Math.random() - 0.5) * 10
      v = Math.min(255, Math.max(0, v))
      d[i] = d[i + 1] = d[i + 2] = v
    } else if (mode === 'grayscale') {
      let v = 0.299 * r + 0.587 * g + 0.114 * b
      // Slight gamma to brighten whites
      v = Math.pow(v / 255, 0.80) * 255
      v = (v - 128) * 1.3 + 128
      if (noisy) v += (Math.random() - 0.5) * 8
      v = Math.min(255, Math.max(0, v))
      d[i] = d[i + 1] = d[i + 2] = v
    } else {
      // Color: gentle contrast + saturation via per-channel boost
      const avg = (r + g + b) / 3
      const sat = 1.2 // saturation factor
      let nr = avg + (r - avg) * sat
      let ng = avg + (g - avg) * sat
      let nb = avg + (b - avg) * sat
      // Contrast
      nr = (nr - 128) * 1.2 + 128
      ng = (ng - 128) * 1.2 + 128
      nb = (nb - 128) * 1.2 + 128
      if (noisy) {
        const n = (Math.random() - 0.5) * 6
        nr += n; ng += n; nb += n
      }
      d[i] = Math.min(255, Math.max(0, nr))
      d[i + 1] = Math.min(255, Math.max(0, ng))
      d[i + 2] = Math.min(255, Math.max(0, nb))
    }
    d[i + 3] = 255
  }

  ctx.putImageData(id, 0, 0)
  // JPEG at high quality — scanner output is not transparent
  return canvas.toDataURL('image/jpeg', 0.92)
}

export default function ScanToPDF() {
  const [pages, setPages] = useState<ScannedPage[]>([])
  const [scanMode, setScanMode] = useState<ScanMode>('document')
  const [noisy, setNoisy] = useState(true)
  const [pageSize, setPageSize] = useState<PageSize>('a4')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  const addFiles = async (files: FileList | null) => {
    if (!files) return
    setResult(null); setError('')
    const newPages = await readFiles(files)
    setPages(prev => [...prev, ...newPages])
  }

  const remove = (id: string) => { setPages(prev => prev.filter(p => p.id !== id)); setResult(null) }

  const run = async () => {
    if (pages.length === 0) return
    setBusy(true); setError(''); setProgress(0); setResult(null)

    try {
      const A4W = 595, A4H = 842
      let doc: jsPDF | null = null

      for (let i = 0; i < pages.length; i++) {
        const img = await loadImg(pages[i].dataUrl)
        const iw = img.naturalWidth, ih = img.naturalHeight
        const isLandscape = iw > ih

        let ptW: number, ptH: number
        if (pageSize === 'a4') {
          ptW = isLandscape ? A4H : A4W
          ptH = isLandscape ? A4W : A4H
        } else {
          const maxPt = 1200
          const scale = Math.min(1, maxPt / Math.max(iw, ih))
          ptW = iw * scale; ptH = ih * scale
        }

        if (!doc) {
          doc = new jsPDF({
            orientation: isLandscape ? 'landscape' : 'portrait',
            unit: 'pt',
            format: [ptW, ptH],
            compress: true,
          })
        } else {
          doc.addPage([ptW, ptH])
        }

        // Apply scanner effect via canvas
        const processed = applyScanEffect(img, scanMode, noisy)

        // Scale to fill page proportionally
        const scale = Math.min(ptW / iw, ptH / ih)
        const dw = iw * scale, dh = ih * scale
        const x = (ptW - dw) / 2, y = (ptH - dh) / 2

        doc.addImage(processed, 'JPEG', x, y, dw, dh)
        setProgress(Math.round(((i + 1) / pages.length) * 100))
      }

      setResult(doc!.output('blob'))
    } catch {
      setError('Failed to create PDF.')
    }
    setBusy(false)
  }

  const currentMode = MODES.find(m => m.id === scanMode)!

  return (
    <div className="flex flex-col gap-5">
      {/* Capture buttons */}
      <div className="flex gap-3">
        <label className="flex-1 flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl border-2 border-dashed border-violet-400 cursor-pointer hover:bg-violet-50 transition-colors">
          <Camera className="w-6 h-6 text-violet-500" />
          <span className="text-sm font-semibold text-violet-700">Camera</span>
          <input type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
        </label>
        <label className="flex-1 flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50 transition-colors">
          <ImageIcon className="w-6 h-6 text-gray-400" />
          <span className="text-sm font-semibold text-gray-600">Gallery</span>
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
        </label>
      </div>

      {/* Scan mode selector */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-500">Scan type</p>
        <div className="flex gap-2">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setScanMode(m.id)}
              className={`flex-1 py-2 px-1 rounded-xl border text-xs text-center transition-colors
                ${scanMode === m.id ? 'border-violet-500 bg-violet-50 text-violet-700 font-semibold' : 'border-gray-200 text-gray-500 hover:border-violet-300'}`}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">{currentMode.desc}</p>
      </div>

      {/* Options row */}
      <div className="flex gap-3 items-center">
        <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
          <div onClick={() => setNoisy(v => !v)}
            className={`w-9 h-5 rounded-full transition-colors ${noisy ? 'bg-violet-500' : 'bg-gray-200'} relative`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${noisy ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-gray-600">Scanner grain</span>
        </label>
        <div className="flex gap-2">
          {(['a4', 'fit'] as PageSize[]).map(s => (
            <button key={s} onClick={() => setPageSize(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                ${pageSize === s ? 'border-violet-500 bg-violet-50 text-violet-700 font-semibold' : 'border-gray-200 text-gray-500 hover:border-violet-300'}`}>
              {s === 'a4' ? 'A4' : 'Fit'}
            </button>
          ))}
        </div>
      </div>

      {/* Page thumbnails with live CSS preview of scan effect */}
      {pages.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {pages.map((p, i) => (
            <div key={p.id} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
              <img src={p.dataUrl} alt={`Page ${i + 1}`}
                className="w-full h-full object-cover"
                style={{ filter: currentMode.cssFilter }} />
              <span className="absolute top-1 left-1 bg-black/50 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                {i + 1}
              </span>
              <button onClick={() => remove(p.id)}
                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {busy && <ProgressBar pct={progress} />}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {result && <ResultCard blob={result} originalName="scan.pdf" label="Scan ready" />}

      <button onClick={run} disabled={pages.length === 0 || busy}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-semibold transition-colors">
        {busy ? 'Scanning…' : `Scan to PDF${pages.length > 0 ? ` · ${pages.length} page${pages.length !== 1 ? 's' : ''}` : ''}`}
      </button>

      {pages.length === 0 && (
        <p className="text-xs text-center text-gray-400">Take a photo or pick images from your gallery</p>
      )}
    </div>
  )
}
