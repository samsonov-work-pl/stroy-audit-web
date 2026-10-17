export type PdfPagePreview = {
  number: number
  imageUrl: string
  width: number
  height: number
  text: string
}

export type PdfPreview = {
  totalPages: number
  pages: PdfPagePreview[]
}

const RENDER_WIDTH_PX = 900

export async function loadPdfPreview(url: string, maxPages: number): Promise<PdfPreview> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

  const loadingTask = pdfjs.getDocument({ url })
  const doc = await loadingTask.promise
  const count = Math.min(doc.numPages, maxPages)
  const pages: PdfPagePreview[] = []

  for (let number = 1; number <= count; number++) {
    const page = await doc.getPage(number)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: RENDER_WIDTH_PX / base.width })

    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvas, viewport }).promise

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    pages.push({
      number,
      imageUrl: blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
      text,
    })
    page.cleanup()
  }

  const totalPages = doc.numPages
  await loadingTask.destroy()
  return { totalPages, pages }
}
