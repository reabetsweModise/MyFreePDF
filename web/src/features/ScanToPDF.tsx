import { useState } from 'react'
import { Camera, X, ImageIcon } from 'lucide-react'
import jsPDF from 'jspdf'
import ProgressBar from '../components/ProgressBar'
import ResultCard from '../components/ResultCard'

interface ScannedPage {
  id: string
  dataUrl: string
}

type PageSize = 'a4' | 'fit'

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

export default function ScanToPDF() {
  const [pages, setPages] = useState<ScannedPage[]>([])
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
      // A4 dimensions in pt (72dpi): 595 x 842
      const A4W = 595, A4H = 842

      let doc: jsPDF | null = null

      for (let i = 0; i < pages.length; i++) {
        const img = await loadImg(pages[i].dataUrl)
        const iw = img.naturalWidth
        const ih = img.naturalHeight
        const isLandscape = iw > ih

        let ptW: number, ptH: number
        if (pageSize === 'a4') {
          ptW = isLandscape ? A4H : A4W
          ptH = isLandscape ? A4W : A4H
        } else {
          // Fit to image — cap at 1200pt max dimension for sanity
          const maxPt = 1200
          const scale = Math.min(1, maxPt / Math.max(iw, ih))
          ptW = iw * scale
          ptH = ih * scale
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

        // Scale image to fill the page proportionally
        const scale = Math.min(ptW / iw, ptH / ih)
        const dw = iw * scale
        const dh = ih * scale
        const x = (ptW - dw) / 2
        const y = (ptH - dh) / 2

        // Convert to JPEG for smaller size
        const canvas = document.createElement('canvas')
        canvas.width = iw; canvas.height = ih
        canvas.getContext('2d')!.drawImage(img, 0, 0)
        const jpeg = canvas.toDataURL('image/jpeg', 0.88)

        doc.addImage(jpeg, 'JPEG', x, y, dw, dh)
        setProgress(Math.round(((i + 1) / pages.length) * 100))
      }

      setResult(doc!.output('blob'))
    } catch {
      setError('Failed to create PDF.')
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Capture / upload buttons */}
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

      {/* Page thumbnails */}
      {pages.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {pages.map((p, i) => (
            <div key={p.id} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
              <img src={p.dataUrl} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
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

      {/* Page size option */}
      {pages.length > 0 && (
        <div className="flex gap-3">
          {(['a4', 'fit'] as PageSize[]).map(s => (
            <label key={s} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-sm transition-colors
              ${pageSize === s ? 'border-violet-500 bg-violet-50 text-violet-700 font-semibold' : 'border-gray-200 text-gray-500 hover:border-violet-300'}`}>
              <input type="radio" name="pageSize" value={s} checked={pageSize === s} onChange={() => setPageSize(s)} className="hidden" />
              {s === 'a4' ? 'A4 page' : 'Fit to image'}
            </label>
          ))}
        </div>
      )}

      {busy && <ProgressBar pct={progress} />}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {result && <ResultCard blob={result} originalName="scan.pdf" label="Scan ready" />}

      <button onClick={run} disabled={pages.length === 0 || busy}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-semibold transition-colors">
        {busy ? 'Creating PDF…' : `Create PDF${pages.length > 0 ? ` · ${pages.length} page${pages.length !== 1 ? 's' : ''}` : ''}`}
      </button>

      {pages.length === 0 && (
        <p className="text-xs text-center text-gray-400">Take a photo or pick images from your gallery</p>
      )}
    </div>
  )
}
