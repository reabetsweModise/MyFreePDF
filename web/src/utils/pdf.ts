import * as pdfjs from 'pdfjs-dist'
import jsPDF from 'jspdf'

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
