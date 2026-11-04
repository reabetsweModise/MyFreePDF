import { Download, CheckCircle } from 'lucide-react'

interface Props {
  blob: Blob
  originalName: string
}

export default function ResultCard({ blob, originalName }: Props) {
  const download = () => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = originalName.replace(/\.pdf$/i, '_unlocked.pdf')
    a.click()
    URL.revokeObjectURL(url)
  }

  const sizeMB = (blob.size / 1024 / 1024).toFixed(2)

  return (
    <div className="w-full rounded-2xl border border-green-200 bg-green-50 p-5 flex items-center gap-4">
      <CheckCircle className="w-8 h-8 text-green-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-green-800">Password removed!</p>
        <p className="text-sm text-green-600 truncate">{originalName.replace(/\.pdf$/i, '_unlocked.pdf')}</p>
        <p className="text-xs text-green-500 mt-0.5">{sizeMB} MB</p>
      </div>
      <button
        onClick={download}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors shrink-0"
      >
        <Download className="w-4 h-4" />
        Download
      </button>
    </div>
  )
}
