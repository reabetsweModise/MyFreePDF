import { useState } from 'react'
import DropZone from '../components/DropZone'
import ProgressBar from '../components/ProgressBar'
import { pdfToImages } from '../utils/pdf'
import { Download } from 'lucide-react'

type Format = 'png' | 'jpeg'

export default function PDFToImages() {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<Format>('png')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; ext: string; single: boolean } | null>(null)
  const [error, setError] = useState('')

  const run = async () => {
    if (!file) return
    setBusy(true); setError(''); setProgress(0); setResult(null)
    try {
      const res = await pdfToImages(file, format, setProgress)
      setResult(res)
    } catch {
      setError('Failed to convert PDF.')
    }
    setBusy(false)
  }

  const download = () => {
    if (!result || !file) return
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name.replace(/\.pdf$/i, result.single ? `.${result.ext}` : `_images.${result.ext}`)
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-5">
      <DropZone onFile={f => { setFile(f); setResult(null); setError('') }} disabled={busy} />
      {file && <p className="text-sm text-cyan-700 bg-cyan-50 px-4 py-2 rounded-xl truncate">{file.name}</p>}

      <div className="flex gap-3">
        {(['png', 'jpeg'] as Format[]).map(f => (
          <label key={f} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border cursor-pointer transition-colors
            ${format === f ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-cyan-300'}`}>
            <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="hidden" />
            {f.toUpperCase()}
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-400 -mt-3 text-center">
        {format === 'png' ? 'Lossless, larger files' : 'Smaller files, slight quality loss'}
      </p>

      {busy && <ProgressBar pct={progress} />}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      {result && (
        <div className="flex items-center gap-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-cyan-800">Conversion complete!</p>
            <p className="text-xs text-cyan-500 mt-0.5">
              {result.single ? '1 image file' : `ZIP archive of images`} · {(result.blob.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <button onClick={download}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-medium transition-colors shrink-0">
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      )}

      <button onClick={run} disabled={!file || busy}
        className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white font-semibold transition-colors">
        {busy ? 'Converting…' : 'Convert to Images'}
      </button>
    </div>
  )
}
