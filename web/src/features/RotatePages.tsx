import { useState } from 'react'
import DropZone from '../components/DropZone'
import ResultCard from '../components/ResultCard'
import { rotatePages } from '../utils/pdflib'

const options = [
  { deg: 90, label: '90° Clockwise' },
  { deg: 270, label: '90° Counter-clockwise' },
  { deg: 180, label: '180°' },
]

export default function RotatePages() {
  const [file, setFile] = useState<File | null>(null)
  const [rotation, setRotation] = useState(90)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  const run = async () => {
    if (!file) return
    setBusy(true); setError(''); setResult(null)
    try {
      const blob = await rotatePages(file, rotation)
      setResult(blob)
    } catch {
      setError('Failed to rotate PDF.')
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <DropZone onFile={f => { setFile(f); setResult(null); setError('') }} disabled={busy} />
      {file && <p className="text-sm text-yellow-700 bg-yellow-50 px-4 py-2 rounded-xl truncate">{file.name}</p>}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-700">Rotation (all pages)</p>
        {options.map(o => (
          <label key={o.deg} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors
            ${rotation === o.deg ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-300'}`}>
            <input type="radio" name="rotation" value={o.deg} checked={rotation === o.deg}
              onChange={() => setRotation(o.deg)} className="accent-yellow-500" />
            <span className="text-sm font-medium text-gray-800">{o.label}</span>
          </label>
        ))}
      </div>

      {busy && <p className="text-sm text-yellow-600 text-center">Rotating pages…</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {result && file && <ResultCard blob={result} originalName={file.name.replace(/\.pdf$/i, '_rotated.pdf')} label="rotated" />}

      <button onClick={run} disabled={!file || busy}
        className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 disabled:opacity-40 text-white font-semibold transition-colors">
        {busy ? 'Rotating…' : 'Rotate All Pages'}
      </button>
    </div>
  )
}
