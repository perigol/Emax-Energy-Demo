import PDFDocument from 'pdfkit'
import { asNumber, invoiceCode } from '../common/money'

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

const PINE = '#1e2a24'
const GOLD = '#c4a35a'
const PAPER = '#f3f0e8'
const INK = '#1c1915'
const MIST = '#6b645b'

const OPERATION: Record<string, string> = {
  NACIONAL: 'Nacional',
  INTRACOMUNITARIA_BIENES: 'Intracomunitaria, bienes',
  INTRACOMUNITARIA_SERVICIOS: 'Intracomunitaria, servicios',
  INVERSION_SUJETO_PASIVO: 'Inversión del sujeto pasivo',
}

type InvoicePdfInput = {
  series: string | null
  number: number | null
  issueDate: Date
  dueDate: Date | null
  operation: string
  rectifiesId: string | null
  base: { toString(): string }
  vat: { toString(): string }
  total: { toString(): string }
  contact: { name: string; nif: string; address: string | null }
  lines: Array<{
    concept: string
    quantity: { toString(): string }
    unitPrice: { toString(): string }
    vatRate: number
    base: { toString(): string }
    vatAmount: { toString(): string }
  }>
}

type OrgPdfInput = {
  legalName: string
  nif: string
  fiscalAddress: string
  logoData: Uint8Array | null
  logoMime: string | null
}

export function renderInvoicePdf(invoice: InvoicePdfInput, org: OrgPdfInput): Promise<Buffer> {
  const sign = invoice.rectifiesId ? -1 : 1
  const code = invoiceCode(invoice.series, invoice.issueDate, invoice.number)
  const title = invoice.rectifiesId ? `Factura rectificativa ${code}` : `Factura ${code}`

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.rect(0, 0, 595.28, 108).fill(PINE)
    doc.rect(0, 108, 595.28, 4).fill(GOLD)
    doc.fillColor(GOLD).font('Times-Bold').fontSize(11).text('ENERFACTURA', 40, 26)
    doc.fillColor(PAPER).font('Times-Bold').fontSize(22).text(title, 40, 44, { width: 360 })
    doc.font('Times-Roman').fontSize(10).fillColor('#d9d3c7').text(OPERATION[invoice.operation] || invoice.operation, 40, 78)

    doc.fillColor(PAPER).font('Times-Bold').fontSize(11).text(`Fecha ${fecha(invoice.issueDate)}`, 400, 36, {
      width: 155,
      align: 'right',
    })
    if (invoice.dueDate) {
      doc.font('Times-Roman').fontSize(10).text(`Vencimiento ${fecha(invoice.dueDate)}`, 380, 54, {
        width: 175,
        align: 'right',
      })
    }

    let y = 132
    let hasLogo = false
    if (org.logoData && org.logoMime && org.logoMime !== 'image/webp') {
      try {
        doc.image(Buffer.from(org.logoData), 40, y, { fit: [80, 44] })
        hasLogo = true
      } catch {
        // Un logo ilegible no impide emitir el PDF.
      }
    }
    const blockX = hasLogo ? 132 : 40
    doc.fillColor(INK).font('Times-Bold').fontSize(12).text(org.legalName, blockX, y, { width: 200 })
    doc.font('Times-Roman').fontSize(10).fillColor(MIST).text(`NIF ${org.nif}`, blockX, y + 16)
    doc.text(org.fiscalAddress, blockX, y + 30, { width: 220 })

    doc.fillColor(MIST).font('Times-Bold').fontSize(9).text('CLIENTE', 340, y)
    doc.fillColor(INK).font('Times-Bold').fontSize(11).text(invoice.contact.name, 340, y + 14, { width: 215 })
    doc.font('Times-Roman').fontSize(10).fillColor(MIST).text(invoice.contact.nif, 340, y + 30)
    if (invoice.contact.address) doc.text(invoice.contact.address, 340, y + 44, { width: 215 })

    y = 210
    const columns = [200, 52, 72, 48, 72, 72]
    y = tableHead(doc, y, ['Concepto', 'Cant.', 'P. unit.', 'IVA', 'Base', 'Cuota'], columns)
    doc.font('Times-Roman').fillColor(INK)
    for (const line of invoice.lines) {
      if (y > 680) {
        doc.addPage()
        y = 48
        y = tableHead(doc, y, ['Concepto', 'Cant.', 'P. unit.', 'IVA', 'Base', 'Cuota'], columns)
        doc.font('Times-Roman').fillColor(INK)
      }
      y = tableRow(
        doc,
        y,
        [
          line.concept,
          String(asNumber(line.quantity)),
          euro.format(asNumber(line.unitPrice)),
          `${line.vatRate} %`,
          euro.format(sign * asNumber(line.base)),
          euro.format(sign * asNumber(line.vatAmount)),
        ],
        columns,
      )
    }

    y += 10
    const bandTop = y
    doc.roundedRect(300, bandTop, 255, 78, 6).fill(PAPER)
    doc.roundedRect(300, bandTop, 255, 78, 6).lineWidth(1).strokeColor(GOLD).stroke()
    doc.fillColor(MIST).font('Times-Roman').fontSize(10).text('Base imponible', 316, bandTop + 12, { width: 110 })
    doc.fillColor(INK).font('Times-Bold').fontSize(11).text(euro.format(sign * asNumber(invoice.base)), 420, bandTop + 10, {
      width: 118,
      align: 'right',
    })
    doc.fillColor(MIST).font('Times-Roman').fontSize(10).text('IVA', 316, bandTop + 32, { width: 110 })
    doc.fillColor(INK).font('Times-Bold').fontSize(11).text(euro.format(sign * asNumber(invoice.vat)), 420, bandTop + 30, {
      width: 118,
      align: 'right',
    })
    doc.fillColor(PINE).font('Times-Bold').fontSize(13).text('Total', 316, bandTop + 52, { width: 80 })
    doc.fontSize(15).text(euro.format(sign * asNumber(invoice.total)), 400, bandTop + 50, { width: 138, align: 'right' })

    doc.fillColor(MIST).font('Times-Roman').fontSize(8).text(
      'Documento de demostración. No es una factura presentada ante la Agencia Tributaria.',
      40,
      800,
      { width: 515 },
    )

    doc.end()
  })
}

function tableHead(doc: PDFKit.PDFDocument, y: number, labels: string[], widths: number[]) {
  let x = 40
  doc.fillColor(MIST).font('Times-Bold').fontSize(9)
  labels.forEach((label, index) => {
    const width = widths[index] ?? 80
    doc.text(label, x, y, { width: width - 6, align: index === 0 ? 'left' : 'right' })
    x += width
  })
  doc.moveTo(40, y + 14).lineTo(555, y + 14).strokeColor(GOLD).lineWidth(1).stroke()
  return y + 22
}

function tableRow(doc: PDFKit.PDFDocument, y: number, cells: string[], widths: number[]) {
  const conceptWidth = (widths[0] ?? 200) - 6
  const conceptHeight = doc.heightOfString(cells[0] ?? '', { width: conceptWidth })
  const rowHeight = Math.max(18, conceptHeight + 4)
  let x = 40
  doc.font('Times-Roman').fontSize(10).fillColor(INK)
  cells.forEach((cell, index) => {
    const width = widths[index] ?? 80
    doc.text(cell, x, y, { width: width - 6, align: index === 0 ? 'left' : 'right' })
    x += width
  })
  return y + rowHeight
}

function fecha(value: Date) {
  const iso = value.toISOString().slice(0, 10)
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}
