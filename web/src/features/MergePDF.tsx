import { useState } from 'react'
import { X, GripVertical } from 'lucide-react'
import ResultCard from '../components/ResultCard'
import { mergePDFs } from '../utils/pdflib'

export default function MergePDF() {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []).filter(f => f.type === 'application/pdf')
    setFiles(prev => [...prev, ...picked])
    setResult(null); setError('')
    e.target.value = ''
  }

  const remove = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const run = async () => {
    if (files.length < 2) return
    setBusy(true); setError(''); setProgress(0); setResult(null)
    try {
      const blob = await mergePDFs(files, setProgress)
      setResult(blob)
    } catch {
      setError('Failed to merge PDFs.')
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-blue-400 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors">
        <span className="text-sm font-semibold text-blue-700">+ Add PDF files</span>
        <span className="text-xs text-gray-500">Select multiple files</span>
        <input type="file" accept="application/pdf" multiple className="hidden" onChange={addFiles} disabled={busy} />
      </label>

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
              <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
              <span className="flex-1 text-sm text-gray-700 truncate">{f.name}</span>
              <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {busy && (
        <div className="w-full">
          <div className="flex justify-between text-sm text-gray-600 mb-1"><span>Merging…</span><span>{progress}%</span></div>
          <div className="w-full bg-gray-200 rounded-full h-3"><div className="h-3 rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {result && <ResultCard blob={result} originalName="merged.pdf" label="merged" />}

      <button onClick={run} disabled={files.length < 2 || busy}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold transition-colors">
        {busy ? 'Merging…' : `Merge ${files.length} PDFs`}
      </button>
      {files.length < 2 && <p className="text-xs text-center text-gray-400">Add at least 2 PDF files</p>}
    </div>
  )
}
