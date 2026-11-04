import { useState } from 'react'
import DropZone from '../components/DropZone'
import ResultCard from '../components/ResultCard'
import { addWatermark } from '../utils/pdflib'

export default function AddWatermark() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('CONFIDENTIAL')
  const [opacity, setOpacity] = useState(0.3)
  const [color, setColor] = useState('#888888')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  const run = async () => {
    if (!file || !text.trim()) return
    setBusy(true); setError(''); setResult(null)
    try {
      const blob = await addWatermark(file, text.trim(), opacity, color)
      setResult(blob)
    } catch {
      setError('Failed to add watermark.')
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <DropZone onFile={f => { setFile(f); setResult(null); setError('') }} disabled={busy} />
      {file && <p className="text-sm text-pink-700 bg-pink-50 px-4 py-2 rounded-xl truncate">{file.name}</p>}

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-gray-700">Watermark text</span>
          <input value={text} onChange={e => setText(e.target.value)} maxLength={40} placeholder="e.g. CONFIDENTIAL"
            className="px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-400 text-sm" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-gray-700">Opacity: {Math.round(opacity * 100)}%</span>
          <input type="range" min={5} max={80} step={5} value={Math.round(opacity * 100)}
            onChange={e => setOpacity(+e.target.value / 100)}
            className="accent-pink-500" />
        </label>

        <label className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">Color</span>
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200" />
          <span className="text-sm text-gray-500">{color}</span>
        </label>
      </div>

      {busy && <p className="text-sm text-pink-600 text-center">Adding watermark…</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {result && file && <ResultCard blob={result} originalName={file.name.replace(/\.pdf$/i, '_watermarked.pdf')} label="watermarked" />}

      <button onClick={run} disabled={!file || !text.trim() || busy}
        className="w-full py-3 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-40 text-white font-semibold transition-colors">
        {busy ? 'Adding watermark…' : 'Add Watermark'}
      </button>
    </div>
  )
}
