import { Download, CheckCircle } from 'lucide-react'

interface Props {
  blob: Blob
  originalName: string
  label?: string
}

export default function ResultCard({ blob, originalName, label = 'done' }: Props) {
  const download = () => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = originalName
    a.click()
    URL.revokeObjectURL(url)
  }

  const sizeMB = (blob.size / 1024).toFixed(0)

  return (
    <div className="w-full rounded-2xl border border-green-200 bg-green-50 p-5 flex items-center gap-4">
      <CheckCircle className="w-8 h-8 text-green-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-green-800 capitalize">{label}!</p>
        <p className="text-sm text-green-600 truncate">{originalName}</p>
        <p className="text-xs text-green-500 mt-0.5">{sizeMB} KB</p>
      </div>
      <button onClick={download}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors shrink-0">
        <Download className="w-4 h-4" /> Download
      </button>
    </div>
  )
}
