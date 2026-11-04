import { useState } from 'react'
import { Unlock, Layers, Scissors, Minimize2, Image, RotateCw, Stamp, Shield, Camera, PenLine, ArrowLeft, FileText } from 'lucide-react'
import RemovePassword from './features/RemovePassword'
import MergePDF from './features/MergePDF'
import SplitPDF from './features/SplitPDF'
import CompressPDF from './features/CompressPDF'
import PDFToImages from './features/PDFToImages'
import RotatePages from './features/RotatePages'
import AddWatermark from './features/AddWatermark'
import ProtectPDF from './features/ProtectPDF'
import ScanToPDF from './features/ScanToPDF'
import FillAndSign from './features/FillAndSign'

type ToolId = 'remove-password' | 'merge' | 'split' | 'compress' | 'to-images' | 'rotate' | 'watermark' | 'protect' | 'scan' | 'fill-sign'

interface Tool {
  id: ToolId
  label: string
  desc: string
  icon: React.ElementType
  bg: string
  fg: string
  accent: string
}

const tools: Tool[] = [
  { id: 'remove-password', label: 'Remove Password', desc: 'Unlock password-protected PDFs', icon: Unlock, bg: 'bg-indigo-50', fg: 'text-indigo-700', accent: 'bg-indigo-600' },
  { id: 'merge', label: 'Merge PDFs', desc: 'Combine multiple PDFs into one', icon: Layers, bg: 'bg-blue-50', fg: 'text-blue-700', accent: 'bg-blue-600' },
  { id: 'split', label: 'Split PDF', desc: 'Extract specific pages', icon: Scissors, bg: 'bg-orange-50', fg: 'text-orange-700', accent: 'bg-orange-500' },
  { id: 'compress', label: 'Compress PDF', desc: 'Reduce file size', icon: Minimize2, bg: 'bg-green-50', fg: 'text-green-700', accent: 'bg-green-600' },
  { id: 'to-images', label: 'PDF to Images', desc: 'Export pages as PNG or JPEG', icon: Image, bg: 'bg-cyan-50', fg: 'text-cyan-700', accent: 'bg-cyan-600' },
  { id: 'rotate', label: 'Rotate Pages', desc: 'Fix page orientation', icon: RotateCw, bg: 'bg-yellow-50', fg: 'text-yellow-700', accent: 'bg-yellow-500' },
  { id: 'watermark', label: 'Add Watermark', desc: 'Stamp text on all pages', icon: Stamp, bg: 'bg-pink-50', fg: 'text-pink-700', accent: 'bg-pink-500' },
  { id: 'protect', label: 'Protect PDF', desc: 'Add a password to your PDF', icon: Shield, bg: 'bg-gray-50', fg: 'text-gray-700', accent: 'bg-gray-700' },
  { id: 'scan', label: 'Scan to PDF', desc: 'Take a photo and convert to PDF', icon: Camera, bg: 'bg-violet-50', fg: 'text-violet-700', accent: 'bg-violet-600' },
  { id: 'fill-sign', label: 'Fill & Sign', desc: 'Fill form fields and sign your PDF', icon: PenLine, bg: 'bg-teal-50', fg: 'text-teal-700', accent: 'bg-teal-600' },
]

const featureMap: Record<ToolId, React.ElementType> = {
  'remove-password': RemovePassword,
  'merge': MergePDF,
  'split': SplitPDF,
  'compress': CompressPDF,
  'to-images': PDFToImages,
  'rotate': RotatePages,
  'watermark': AddWatermark,
  'protect': ProtectPDF,
  'scan': ScanToPDF,
  'fill-sign': FillAndSign,
}

function HomeScreen({ onSelect }: { onSelect: (id: ToolId) => void }) {
  return (
    <div className="min-h-screen px-4 py-10"
      style={{ paddingLeft: 'max(16px, env(safe-area-inset-left,0px))', paddingRight: 'max(16px, env(safe-area-inset-right,0px))' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center mb-10 gap-2">
          <div className="bg-indigo-600 rounded-2xl p-3 mb-1">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">MyFreePDF</h1>
          <p className="text-gray-500 text-sm text-center max-w-xs">
            All your PDF tools in one place — 100% private, processed in your browser.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tools.map(tool => {
            const Icon = tool.icon
            return (
              <button key={tool.id} onClick={() => onSelect(tool.id)}
                className={`${tool.bg} flex items-center gap-4 p-5 rounded-2xl border border-transparent hover:border-gray-200 hover:shadow-sm transition-all text-left group`}>
                <div className={`${tool.accent} rounded-xl p-2.5 shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className={`font-semibold text-sm ${tool.fg}`}>{tool.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tool.desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Your files never leave your device.
        </p>
      </div>
    </div>
  )
}

function ToolScreen({ toolId, onBack }: { toolId: ToolId; onBack: () => void }) {
  const tool = tools.find(t => t.id === toolId)!
  const Feature = featureMap[toolId]
  const Icon = tool.icon

  return (
    <div className="min-h-screen px-4 py-6"
      style={{ paddingLeft: 'max(16px, env(safe-area-inset-left,0px))', paddingRight: 'max(16px, env(safe-area-inset-right,0px))' }}>
      <div className="max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> All tools
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className={`${tool.accent} rounded-xl p-2.5`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{tool.label}</h2>
            <p className="text-xs text-gray-500">{tool.desc}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <Feature />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Your file never leaves your device.</p>
      </div>
    </div>
  )
}

export default function App() {
  const [tool, setTool] = useState<ToolId | null>(null)

  if (!tool) return <HomeScreen onSelect={setTool} />
  return <ToolScreen toolId={tool} onBack={() => setTool(null)} />
}
