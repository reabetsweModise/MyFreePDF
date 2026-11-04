import { useCallback } from 'react'
import { Upload } from 'lucide-react'

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
}

export default function DropZone({ onFile, disabled }: Props) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (disabled) return
      const file = e.dataTransfer.files[0]
      if (file?.type === 'application/pdf') onFile(file)
    },
    [onFile, disabled],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = ''
  }

  return (
    <label
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`flex flex-col items-center justify-center gap-3 w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-colors
        ${disabled ? 'opacity-50 cursor-not-allowed border-gray-300' : 'border-indigo-400 hover:bg-indigo-50 hover:border-indigo-500'}`}
    >
      <Upload className="w-10 h-10 text-indigo-400" />
      <div className="text-center">
        <p className="font-semibold text-gray-700">Drop your PDF here</p>
        <p className="text-sm text-gray-500">or click to browse</p>
      </div>
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </label>
  )
}
