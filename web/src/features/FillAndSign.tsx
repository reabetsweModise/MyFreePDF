import { useState, useRef, useEffect } from 'react'
import { PenLine, Type, X } from 'lucide-react'
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib'
import DropZone from '../components/DropZone'
import ProgressBar from '../components/ProgressBar'
import ResultCard from '../components/ResultCard'

interface FieldDef {
  name: string
  type: 'text' | 'checkbox'
}

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1]
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

function getXY(
  e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  el: HTMLCanvasElement,
) {
  const rect = el.getBoundingClientRect()
  const sx = el.width / rect.width
  const sy = el.height / rect.height
  const src = 'touches' in e ? e.touches[0] : e
  return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy }
}

export default function FillAndSign() {
  const [file, setFile] = useState<File | null>(null)
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({})
  const [signMode, setSignMode] = useState<'draw' | 'type'>('draw')
  const [typedName, setTypedName] = useState('')
  const [hasDrawing, setHasDrawing] = useState(false)
  const [placement, setPlacement] = useState('last-br')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  useEffect(() => {
    if (!file) { setFieldDefs([]); setFieldValues({}); return }
    setFieldDefs([]); setFieldValues({})
    file.arrayBuffer().then(bytes =>
      PDFDocument.load(bytes, { ignoreEncryption: true }).then(doc => {
        const form = doc.getForm()
        const defs: FieldDef[] = []
        for (const f of form.getFields()) {
          if (f instanceof PDFTextField) defs.push({ name: f.getName(), type: 'text' })
          else if (f instanceof PDFCheckBox) defs.push({ name: f.getName(), type: 'checkbox' })
        }
        setFieldDefs(defs)
        const init: Record<string, string | boolean> = {}
        defs.forEach(d => { init[d.name] = d.type === 'checkbox' ? false : '' })
        setFieldValues(init)
      }).catch(() => {})
    )
  }, [file])

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    drawing.current = true
    const { x, y } = getXY(e, canvas)
    const ctx = canvas.getContext('2d')!
    ctx.beginPath(); ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current; if (!canvas) return
    const { x, y } = getXY(e, canvas)
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#1e3a5f'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.lineTo(x, y); ctx.stroke()
    setHasDrawing(true)
  }

  const stopDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    drawing.current = false
    canvasRef.current?.getContext('2d')?.closePath()
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawing(false)
  }

  const hasSign = signMode === 'draw' ? hasDrawing : typedName.trim().length > 0
  const canRun = !!file && (fieldDefs.length > 0 || hasSign)

  const run = async () => {
    if (!file) return
    setBusy(true); setError(''); setProgress(0); setResult(null)

    try {
      const bytes = await file.arrayBuffer()
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
      setProgress(20)

      // Fill form fields
      if (fieldDefs.length > 0) {
        const form = doc.getForm()
        for (const fd of fieldDefs) {
          const val = fieldValues[fd.name]
          try {
            if (fd.type === 'text') form.getTextField(fd.name).setText(val as string)
            else if (fd.type === 'checkbox') {
              const cb = form.getCheckBox(fd.name)
              val ? cb.check() : cb.uncheck()
            }
          } catch {}
        }
        try { form.flatten() } catch {}
      }
      setProgress(50)

      // Embed signature
      if (hasSign) {
        let sigPng: string
        if (signMode === 'draw') {
          sigPng = canvasRef.current!.toDataURL('image/png')
        } else {
          const c = document.createElement('canvas')
          c.width = 500; c.height = 120
          const ctx = c.getContext('2d')!
          ctx.font = '64px cursive'
          ctx.fillStyle = '#1e3a5f'
          ctx.fillText(typedName.trim(), 12, 80)
          sigPng = c.toDataURL('image/png')
        }

        const img = await doc.embedPng(dataUrlToUint8(sigPng))
        const { width: imgW, height: imgH } = img.scale(1)
        const sigW = Math.min(220, imgW)
        const sigH = imgH * (sigW / imgW)

        const allPages = placement === 'all-br'
          ? doc.getPages()
          : [doc.getPages()[doc.getPageCount() - 1]]

        for (const page of allPages) {
          const { width: pW, height: pH } = page.getSize()
          let x = 0
          if (placement === 'last-br' || placement === 'all-br') x = pW - sigW - 30
          else if (placement === 'last-bc') x = (pW - sigW) / 2
          else x = 30
          // y=30 means 30pt from bottom in PDF coordinate system
          page.drawImage(img, { x, y: 30, width: sigW, height: sigH })
        }
      }

      setProgress(90)
      const out = await doc.save()
      setResult(new Blob([out.buffer as unknown as ArrayBuffer], { type: 'application/pdf' }))
    } catch {
      setError('Failed to process PDF.')
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <DropZone onFile={f => { setFile(f); setResult(null); setError('') }} disabled={busy} />

      {/* Filled file name */}
      {file && (
        <p className="text-sm text-gray-600 font-medium truncate">
          📄 {file.name}
          {fieldDefs.length > 0 && (
            <span className="ml-2 text-xs text-violet-600 font-normal">
              {fieldDefs.length} fillable field{fieldDefs.length !== 1 ? 's' : ''} detected
            </span>
          )}
        </p>
      )}

      {/* Form fields */}
      {file && fieldDefs.length > 0 && (
        <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fill Form</p>
          {fieldDefs.map(fd => (
            <div key={fd.name}>
              {fd.type === 'checkbox' ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={!!fieldValues[fd.name]}
                    onChange={e => setFieldValues(v => ({ ...v, [fd.name]: e.target.checked }))}
                    className="w-4 h-4 accent-violet-600 rounded" />
                  <span className="text-sm text-gray-700 truncate">{fd.name}</span>
                </label>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block truncate">{fd.name}</label>
                  <input type="text" value={fieldValues[fd.name] as string}
                    onChange={e => setFieldValues(v => ({ ...v, [fd.name]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Signature section */}
      {file && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-700 flex-1">Signature</p>
            {(['draw', 'type'] as const).map(m => (
              <button key={m} onClick={() => setSignMode(m)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors
                  ${signMode === m ? 'bg-violet-100 text-violet-700 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
                {m === 'draw' ? <PenLine className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
                {m === 'draw' ? 'Draw' : 'Type'}
              </button>
            ))}
          </div>

          {signMode === 'draw' ? (
            <div className="relative">
              <canvas ref={canvasRef} width={500} height={130}
                className="w-full border-2 border-dashed border-gray-200 rounded-2xl cursor-crosshair bg-gray-50 touch-none select-none"
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
              {!hasDrawing && (
                <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none">
                  Draw your signature here
                </p>
              )}
              {hasDrawing && (
                <button onClick={clearCanvas}
                  className="absolute top-2 right-2 flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          ) : (
            <input type="text" value={typedName} onChange={e => setTypedName(e.target.value)}
              placeholder="Type your name"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400 text-2xl bg-gray-50"
              style={{ fontFamily: 'cursive' }} />
          )}

          {/* Placement options (only shown when there's a signature) */}
          {hasSign && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-500">Placement</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'last-bl', label: 'Last page — left' },
                  { id: 'last-bc', label: 'Last page — center' },
                  { id: 'last-br', label: 'Last page — right' },
                  { id: 'all-br', label: 'All pages — right' },
                ].map(opt => (
                  <label key={opt.id}
                    className={`flex items-center px-3 py-2 rounded-xl border cursor-pointer text-xs transition-colors
                      ${placement === opt.id ? 'border-violet-500 bg-violet-50 text-violet-700 font-semibold' : 'border-gray-200 text-gray-500 hover:border-violet-300'}`}>
                    <input type="radio" name="placement" value={opt.id} checked={placement === opt.id}
                      onChange={() => setPlacement(opt.id)} className="hidden" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {busy && <ProgressBar pct={progress} />}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {result && (
        <ResultCard
          blob={result}
          originalName={(file?.name ?? 'document').replace(/\.pdf$/i, '_signed.pdf')}
          label="Signed & ready"
        />
      )}

      <button onClick={run} disabled={!canRun || busy}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-semibold transition-colors">
        {busy ? 'Processing…' : 'Fill & Sign PDF'}
      </button>

      {!file && (
        <p className="text-xs text-center text-gray-400">
          Upload a PDF to fill form fields or add your signature
        </p>
      )}
    </div>
  )
}
