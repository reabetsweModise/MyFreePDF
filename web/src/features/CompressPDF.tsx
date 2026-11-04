import { useState } from 'react'
import DropZone from '../components/DropZone'
import ProgressBar from '../components/ProgressBar'
import ResultCard from '../components/ResultCard'
import { compressPDF } from '../utils/pdf'

type Quality = 'low' | 'medium' | 'high'

const levels: { value: Quality; label: string; desc: string }[] = [
  { value: 'high', label: 'High quality', desc: 'Smaller reduction, better visuals' },
  { value: 'medium', label: 'Balanced', desc: 'Good reduction, decent quality' },
  { value: 'low', label: 'Maximum compression', desc: 'Smallest size, lower quality' },
]

export default function CompressPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [quality, setQuality] = useState<Quality>('medium')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  const run = async () => {
    if (!file) return
    setBusy(true); setError(''); setProgress(0); setResult(null)
    try {
      const blob = await compressPDF(file, quality, setProgress)
      setResult(blob)
    } catch {
      setError('Failed to compress PDF.')
    }
    setBusy(false)
  }

  const saving = result ? Math.round((1 - result.size / file!.size) * 100) : 0

  return (
    <div className="flex flex-col gap-5">
      <DropZone onFile={f => { setFile(f); setResult(null); setError('') }} disabled={busy} />
      {file && (
        <p className="text-sm text-green-700 bg-green-50 px-4 py-2 rounded-xl truncate">
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-700">Compression level</p>
        {levels.map(l => (
          <label key={l.value} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors
            ${quality === l.value ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
            <input type="radio" name="quality" value={l.value} checked={quality === l.value}
              onChange={() => setQuality(l.value)} className="accent-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-800">{l.label}</p>
              <p className="text-xs text-gray-500">{l.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {busy && <ProgressBar pct={progress} />}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {result && file && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm px-1">
            <span className="text-gray-500">Original: {(file.size / 1024).toFixed(0)} KB</span>
            <span className="text-green-600 font-semibold">Saved: {saving}%</span>
          </div>
          <ResultCard blob={result} originalName={file.name.replace(/\.pdf$/i, '_compressed.pdf')} label="compressed" />
        </div>
      )}

      <button onClick={run} disabled={!file || busy}
        className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold transition-colors">
        {busy ? 'Compressing…' : 'Compress PDF'}
      </button>
    </div>
  )
}
