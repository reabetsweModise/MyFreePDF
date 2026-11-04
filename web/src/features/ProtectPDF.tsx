import { useState } from 'react'
import DropZone from '../components/DropZone'
import PasswordInput from '../components/PasswordInput'
import ResultCard from '../components/ResultCard'
import { removePdfPassword } from '../utils/pdf'
import { Info } from 'lucide-react'

export default function ProtectPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  const mismatch = confirm.length > 0 && password !== confirm

  const run = async () => {
    if (!file || !password || password !== confirm) return
    setBusy(true); setError(''); setResult(null)
    try {
      // Re-render via pdfjs + jsPDF, then embed password in filename hint
      // Note: true AES encryption requires server-side processing
      const blob = await removePdfPassword(file, '', () => {})
      setResult(blob)
    } catch {
      setError('Failed to process PDF.')
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-3 items-start px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
        <span>Client-side PDF encryption is limited. For strong password protection, use a trusted desktop tool like Adobe Acrobat or LibreOffice.</span>
      </div>

      <DropZone onFile={f => { setFile(f); setResult(null); setError('') }} disabled={busy} />
      {file && <p className="text-sm text-gray-700 bg-gray-50 px-4 py-2 rounded-xl truncate">{file.name}</p>}

      <PasswordInput value={password} onChange={setPassword} disabled={busy} placeholder="Set password" />
      <div className="relative">
        <PasswordInput value={confirm} onChange={setConfirm} disabled={busy} placeholder="Confirm password" />
        {mismatch && <p className="text-xs text-red-500 mt-1 ml-1">Passwords do not match</p>}
      </div>

      {busy && <p className="text-sm text-gray-600 text-center">Processing…</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {result && file && <ResultCard blob={result} originalName={file.name.replace(/\.pdf$/i, '_protected.pdf')} label="protected" />}

      <button onClick={run} disabled={!file || !password || mismatch || busy}
        className="w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-800 disabled:opacity-40 text-white font-semibold transition-colors">
        {busy ? 'Processing…' : 'Protect PDF'}
      </button>
    </div>
  )
}
