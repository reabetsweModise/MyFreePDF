import * as pdfjs from 'pdfjs-dist'
import jsPDF from 'jspdf'
import JSZip from 'jszip'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

export async function removePdfPassword(
  file: File,
  password: string,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer, password })
  const pdfDoc = await loadingTask.promise
  const numPages = pdfDoc.numPages

  const firstPage = await pdfDoc.getPage(1)
  const firstViewport = firstPage.getViewport({ scale: 2 })
  const ptW = firstViewport.width / 2
  const ptH = firstViewport.height / 2

  const doc = new jsPDF({
    orientation: ptW > ptH ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [ptW, ptH],
    compress: true,
  })

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: ctx, viewport }).promise
    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    const pageW = viewport.width / 2
    const pageH = viewport.height / 2
    if (i > 1) doc.addPage([pageW, pageH])
    doc.addImage(imgData, 'JPEG', 0, 0, pageW, pageH)
    onProgress(Math.round((i / numPages) * 100))
  }

  return doc.output('blob')
}

export async function compressPDF(
  file: File,
  quality: 'low' | 'medium' | 'high',
  onProgress: (pct: number) => void,
): Promise<Blob> {
  const scale = quality === 'high' ? 1.5 : quality === 'medium' ? 1.0 : 0.75
  const jpegQ = quality === 'high' ? 0.8 : quality === 'medium' ? 0.55 : 0.4

  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
  const pdfDoc = await loadingTask.promise
  const numPages = pdfDoc.numPages

  const firstPage = await pdfDoc.getPage(1)
  const fvp = firstPage.getViewport({ scale })
  const ptW = fvp.width / scale
  const ptH = fvp.height / scale

  const doc = new jsPDF({
    orientation: ptW > ptH ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [ptW, ptH],
    compress: true,
  })

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: ctx, viewport }).promise
    const imgData = canvas.toDataURL('image/jpeg', jpegQ)
    const pageW = viewport.width / scale
    const pageH = viewport.height / scale
    if (i > 1) doc.addPage([pageW, pageH])
    doc.addImage(imgData, 'JPEG', 0, 0, pageW, pageH)
    onProgress(Math.round((i / numPages) * 100))
  }

  return doc.output('blob')
}

export async function pdfToImages(
  file: File,
  format: 'png' | 'jpeg',
  onProgress: (pct: number) => void,
): Promise<{ blob: Blob; ext: string; single: boolean }> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
  const pdfDoc = await loadingTask.promise
  const numPages = pdfDoc.numPages

  const renderPage = async (i: number): Promise<string> => {
    const page = await pdfDoc.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: ctx, viewport }).promise
    return canvas.toDataURL(`image/${format}`, 0.95)
  }

  if (numPages === 1) {
    const dataUrl = await renderPage(1)
    onProgress(100)
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    return { blob, ext: format === 'png' ? 'png' : 'jpg', single: true }
  }

  const zip = new JSZip()
  for (let i = 1; i <= numPages; i++) {
    const dataUrl = await renderPage(i)
    const base64 = dataUrl.split(',')[1]
    zip.file(`page-${String(i).padStart(3, '0')}.${format === 'png' ? 'png' : 'jpg'}`, base64, { base64: true })
    onProgress(Math.round((i / numPages) * 100))
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, ext: 'zip', single: false }
}
