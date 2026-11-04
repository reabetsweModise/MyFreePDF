import { useState } from 'react'
import { Lock } from 'lucide-react'
import DropZone from './components/DropZone'
import PasswordInput from './components/PasswordInput'
import ProgressBar from './components/ProgressBar'
import ResultCard from './components/ResultCard'
import { removePdfPassword } from './utils/pdf'

type State = 'idle' | 'processing' | 'done' | 'error'

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [state, setState] = useState<State>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  const handleFile = (f: File) => {
    setFile(f)
    setState('idle')
    setResult(null)
    setError('')
  }

  const handleUnlock = async () => {
    if (!file) return
    setState('processing')
    setProgress(0)
    setError('')
    try {
      const blob = await removePdfPassword(file, password, setProgress)
      setResult(blob)
      setState('done')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.toLowerCase().includes('password')) {
        setError('Incorrect password. Please try again.')
      } else {
        setError('Failed to process the PDF. Make sure it is a valid file.')
      }
      setState('error')
    }
  }

  const reset = () => {
    setFile(null)
    setPassword('')
    setState('idle')
    setResult(null)
    setError('')
    setProgress(0)
  }

  const busy = state === 'processing'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <div className="bg-indigo-600 rounded-2xl p-3">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">MyFreePDF</h1>
          <p className="text-gray-500 text-sm text-center">
            Remove password protection from any PDF — 100% private, processed in your browser.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col gap-5">
          <DropZone onFile={handleFile} disabled={busy} />

          {file && (
            <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-indigo-800 truncate">{file.name}</p>
                <p className="text-xs text-indigo-500">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={reset} className="text-xs text-indigo-400 hover:text-indigo-600">
                Remove
              </button>
            </div>
          )}

          <PasswordInput value={password} onChange={setPassword} disabled={busy} />

          {state === 'processing' && <ProgressBar pct={progress} />}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
          )}

          {result && file && state === 'done' && (
            <ResultCard blob={result} originalName={file.name} />
          )}

          <button
            onClick={handleUnlock}
            disabled={!file || busy}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors"
          >
            {busy ? 'Unlocking…' : 'Remove Password'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your file never leaves your device.
        </p>
      </div>
    </div>
  )
}
