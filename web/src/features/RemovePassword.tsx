import { useState } from 'react'
import DropZone from '../components/DropZone'
import PasswordInput from '../components/PasswordInput'
import ProgressBar from '../components/ProgressBar'
import ResultCard from '../components/ResultCard'
import { removePdfPassword } from '../utils/pdf'

export default function RemovePassword() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  const reset = () => { setFile(null); setPassword(''); setResult(null); setError(''); setProgress(0) }

  const run = async () => {
    if (!file) return
    setBusy(true); setError(''); setProgress(0); setResult(null)
    try {
      const blob = await removePdfPassword(file, password, setProgress)
      setResult(blob)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.toLowerCase().includes('password') ? 'Incorrect password.' : 'Failed to process PDF.')
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <DropZone onFile={f => { setFile(f); setResult(null); setError('') }} disabled={busy} />
      {file && (
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-xl">
          <p className="flex-1 text-sm font-medium text-indigo-800 truncate">{file.name}</p>
          <button onClick={reset} className="text-xs text-indigo-400 hover:text-indigo-600">Remove</button>
        </div>
      )}
      <PasswordInput value={password} onChange={setPassword} disabled={busy} />
      {busy && <ProgressBar pct={progress} />}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {result && file && <ResultCard blob={result} originalName={file.name} label="unlocked" />}
      <button onClick={run} disabled={!file || busy}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold transition-colors">
        {busy ? 'Removing password…' : 'Remove Password'}
      </button>
    </div>
  )
}
