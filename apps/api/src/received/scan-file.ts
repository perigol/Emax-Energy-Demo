import { BadRequestException } from '@nestjs/common'
import { parseInvoiceText, type ScannedInvoice } from './read-invoice'

const EMPTY: ScannedInvoice = {
  number: null,
  date: null,
  concept: null,
  base: null,
  vatRate: null,
  supplierName: null,
  supplierNif: null,
  note: 'No se han reconocido datos en el archivo. Complétalos a mano.',
}

export async function scanInvoiceFile(file: { mimetype: string; buffer: Buffer }): Promise<ScannedInvoice> {
  if (file.mimetype === 'application/pdf') return scanPdf(file.buffer)
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') return scanImage(file.buffer)
  if (file.mimetype === 'image/webp') {
    return { ...EMPTY, note: 'WebP se guarda, pero la lectura automática admite JPG y PNG.' }
  }
  throw new BadRequestException('Solo se admiten PDF, JPG, PNG o WebP')
}

async function scanPdf(buffer: Buffer): Promise<ScannedInvoice> {
  const { extractText, renderPageAsImage } = await import('unpdf')
  const data = new Uint8Array(buffer)
  const extracted = await extractText(data, { mergePages: true })
  const text = extracted.text.trim()
  if (text) return parseInvoiceText(text)
  try {
    const png = await renderPageAsImage(data, 1, { scale: 2 })
    return scanImage(Buffer.from(png))
  } catch {
    return {
      ...EMPTY,
      note: 'Este PDF es una foto y no se ha podido leer. Súbela en JPG o PNG.',
    }
  }
}

async function scanImage(buffer: Buffer): Promise<ScannedInvoice> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa')
  try {
    const result = await worker.recognize(buffer)
    return parseInvoiceText(result.data.text || '')
  } finally {
    await worker.terminate()
  }
}
