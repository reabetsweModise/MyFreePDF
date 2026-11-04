import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib'

// pdf-lib returns Uint8Array<ArrayBufferLike>; this bridges to BlobPart safely
function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes.buffer as unknown as ArrayBuffer], { type: 'application/pdf' })
}

export async function mergePDFs(files: File[], onProgress: (pct: number) => void): Promise<Blob> {
  const merged = await PDFDocument.create()
  for (let i = 0; i < files.length; i++) {
    const bytes = await files[i].arrayBuffer()
    const doc = await PDFDocument.load(bytes)
    const copied = await merged.copyPages(doc, doc.getPageIndices())
    copied.forEach(p => merged.addPage(p))
    onProgress(Math.round(((i + 1) / files.length) * 100))
  }
  const out = await merged.save()
  return pdfBlob(out)
}

export async function splitPDF(file: File, fromPage: number, toPage: number): Promise<Blob> {
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes)
  const total = doc.getPageCount()
  const from = Math.max(1, fromPage)
  const to = Math.min(total, toPage)
  const newDoc = await PDFDocument.create()
  const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i)
  const pages = await newDoc.copyPages(doc, indices)
  pages.forEach(p => newDoc.addPage(p))
  const out = await newDoc.save()
  return pdfBlob(out)
}

export async function rotatePages(file: File, rotation: number): Promise<Blob> {
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes)
  doc.getPages().forEach(page => {
    const current = page.getRotation().angle
    page.setRotation(degrees((current + rotation) % 360))
  })
  const out = await doc.save()
  return pdfBlob(out)
}

export async function addWatermark(
  file: File,
  text: string,
  opacity: number,
  colorHex: string,
): Promise<Blob> {
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)

  const r = parseInt(colorHex.slice(1, 3), 16) / 255
  const g = parseInt(colorHex.slice(3, 5), 16) / 255
  const b = parseInt(colorHex.slice(5, 7), 16) / 255

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const fontSize = Math.max(28, Math.min(width, height) / 7)
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    page.drawText(text, {
      x: (width - textWidth * 0.7) / 2,
      y: height / 2 - fontSize / 2,
      size: fontSize,
      font,
      opacity,
      rotate: degrees(45),
      color: rgb(r, g, b),
    })
  }

  const out = await doc.save()
  return pdfBlob(out)
}

export async function getPDFPageCount(file: File): Promise<number> {
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes)
  return doc.getPageCount()
}
