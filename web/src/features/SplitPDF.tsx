import { useState } from 'react'
import DropZone from '../components/DropZone'
import ResultCard from '../components/ResultCard'
import { splitPDF, getPDFPageCount } from '../utils/pdflib'

export default function SplitPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(1)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  const handleFile = async (f: File) => {
    setFile(f); setResult(null); setError('')
    try {
      const count = await getPDFPageCount(f)
      setTotalPages(count)
      setFrom(1); setTo(count)
    } catch {
      setError('Could not read PDF page count.')
    }
  }

  const run = async () => {
    if (!file) return
    setBusy(true); setError(''); setResult(null)
    try {
      const blob = await splitPDF(file, from, to)
      setResult(blob)
    } catch {
      setError('Failed to split PDF.')
    }
    setBusy(false)
  }

  const pageRange = to - from + 1

  return (
    <div className="flex flex-col gap-5">
      <DropZone onFile={handleFile} disabled={busy} />
      {file && (
        <div className="px-4 py-3 bg-orange-50 rounded-xl">
          <p className="text-sm font-medium text-orange-800 truncate">{file.name}</p>
          <p className="text-xs text-orange-500 mt-0.5">{totalPages} pages</p>
        </div>
      )}

      {totalPages > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-700">Select page range</p>
          <div className="flex gap-4">
            <label className="flex-1">
              <span className="text-xs text-gray-500 mb-1 block">From page</span>
              <input type="number" min={1} max={to} value={from}
                onChange={e => setFrom(Math.min(to, Math.max(1, +e.target.value)))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
            </label>
            <label className="flex-1">
              <span className="text-xs text-gray-500 mb-1 block">To page</span>
              <input type="number" min={from} max={totalPages} value={to}
                onChange={e => setTo(Math.min(totalPages, Math.max(from, +e.target.value)))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
            </label>
          </div>
          <p className="text-xs text-gray-400">{pageRange} page{pageRange !== 1 ? 's' : ''} will be extracted</p>
        </div>
      )}

      {busy && <p className="text-sm text-orange-600 text-center">Splitting…</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {result && file && <ResultCard blob={result} originalName={file.name.replace(/\.pdf$/i, `_p${from}-${to}.pdf`)} label="split" />}

      <button onClick={run} disabled={!file || busy}
        className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold transition-colors">
        {busy ? 'Splitting…' : 'Extract Pages'}
      </button>
    </div>
  )
}
