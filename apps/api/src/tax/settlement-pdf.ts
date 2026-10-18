import PDFDocument from 'pdfkit'
import type { Modelo111, Modelo303, Modelo349Line } from '@norteluz/tax'
import { quarterRange } from '@norteluz/tax'

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

const PINE = '#1e2a24'
const GOLD = '#c4a35a'
const PAPER = '#f3f0e8'
const INK = '#1c1915'
const MIST = '#6b645b'

const CLAVE: Record<string, string> = {
  A: 'Bienes',
  E: 'Entregas',
  S: 'Servicios',
  I: 'Servicios recibidos',
}

export interface SettlementPdfInput {
  year: number
  quarter: 1 | 2 | 3 | 4
  settledOn: string
  org: { legalName: string; nif: string; fiscalAddress: string; logoData: Uint8Array | null; logoMime: string | null }
  modelo303: Modelo303
  modelo111: Modelo111
  modelo349: Modelo349Line[]
}

export function renderSettlementPdf(input: SettlementPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    paint(doc, input)
    doc.end()
  })
}

function paint(doc: PDFKit.PDFDocument, input: SettlementPdfInput) {
  const range = quarterRange(input.year, input.quarter)
  doc.rect(0, 0, 595.28, 118).fill(PINE)
  doc.rect(0, 118, 595.28, 5).fill(GOLD)
  doc.fillColor(GOLD).font('Times-Bold').fontSize(11).text('NORTE LUZ', 40, 28)
  doc.fillColor(PAPER).font('Times-Bold').fontSize(24).text('Liquidación trimestral', 40, 48)
  doc.font('Times-Roman').fontSize(11).fillColor('#d9d3c7').text('Modelos 303, 111 y 349 · régimen general', 40, 82)
  doc.fillColor(PAPER).font('Times-Bold').fontSize(20).text(`${input.quarter}T ${input.year}`, 390, 52, {
    width: 165,
    align: 'right',
  })

  let y = 144
  let hasLogo = false
  if (input.org.logoData && input.org.logoMime && input.org.logoMime !== 'image/webp') {
    try {
      doc.image(Buffer.from(input.org.logoData), 40, y, { fit: [72, 36] })
      hasLogo = true
    } catch {
      // Un logo ilegible no impide la liquidación.
    }
  }
  const nameX = hasLogo ? 124 : 40
  doc.fillColor(INK).font('Times-Bold').fontSize(12).text(input.org.legalName, nameX, y, { width: 250 })
  doc.font('Times-Roman').fontSize(10).fillColor(MIST).text(`NIF ${input.org.nif}`, nameX, y + 16)
  doc.text(input.org.fiscalAddress, nameX, y + 30, { width: 250 })
  doc.fillColor(MIST).font('Times-Roman').fontSize(10).text('Periodo', 400, y, { width: 155, align: 'right' })
  doc.fillColor(INK).font('Times-Bold').fontSize(11).text(`${fecha(range.from)} – ${fecha(range.to)}`, 380, y + 14, {
    width: 175,
    align: 'right',
  })
  doc.fillColor(MIST).font('Times-Roman').fontSize(10).text(`Liquidada el ${fecha(input.settledOn)}`, 380, y + 32, {
    width: 175,
    align: 'right',
  })

  y = 214
  y = sectionTitle(doc, y, 'Modelo 303', 'IVA devengado y deducible')
  y = tableHead(doc, y, ['Tipo', 'Base', 'Cuota'])
  for (const row of input.modelo303.porTipo) {
    y = tableRow(doc, y, [`${row.rate} %`, euro.format(row.base), euro.format(row.cuota)])
  }
  y += 8
  y = pair(doc, y, 'Entregas intracomunitarias', euro.format(input.modelo303.entregasIntracomunitarias))
  y = pair(doc, y, 'Adquisiciones intracomunitarias', euro.format(input.modelo303.adquisicionesIntracomunitarias))
  y = pair(doc, y, 'IVA devengado', euro.format(input.modelo303.devengado))
  y = pair(doc, y, 'IVA deducible', euro.format(input.modelo303.deducible))
  y += 10
  y = resultBand(doc, y, input.modelo303.resultado)

  y += 22
  y = sectionTitle(doc, y, 'Modelo 111', 'Retenciones e ingresos a cuenta')
  y = three(
    doc,
    y,
    ['Perceptores', String(input.modelo111.perceptores)],
    ['Base de retención', euro.format(input.modelo111.base)],
    ['A ingresar', euro.format(input.modelo111.retencion)],
  )

  y += 22
  y = sectionTitle(doc, y, 'Modelo 349', 'Operaciones con la Unión Europea')
  if (input.modelo349.length === 0) {
    doc.fillColor(MIST).font('Times-Roman').fontSize(10).text('Sin operaciones intracomunitarias en este trimestre.', 40, y)
  } else {
    const columns = [120, 180, 130, 85]
    y = tableHead(doc, y, ['NIF-IVA', 'Operador', 'Clave', 'Base'], columns)
    for (const line of input.modelo349) {
      y = tableRow(
        doc,
        y,
        [line.vatId, line.name, `${line.clave} · ${CLAVE[line.clave] || line.clave}`, euro.format(line.base)],
        columns,
      )
    }
  }

  doc.fillColor(MIST).font('Times-Roman').fontSize(8).text(
    'Documento de demostración. No es una autoliquidación presentada ante la Agencia Tributaria.',
    40,
    800,
    { width: 515 },
  )
}

function sectionTitle(doc: PDFKit.PDFDocument, y: number, title: string, text: string) {
  doc.fillColor(PINE).font('Times-Bold').fontSize(14).text(title, 40, y)
  doc.fillColor(MIST).font('Times-Roman').fontSize(10).text(text, 160, y + 3)
  return y + 24
}

function tableHead(doc: PDFKit.PDFDocument, y: number, labels: string[], widths = [80, 200, 235]) {
  let x = 40
  doc.font('Times-Bold').fontSize(9).fillColor(MIST)
  labels.forEach((label, index) => {
    const width = widths[index] ?? 80
    doc.text(label, x, y, { width: width - 8, align: index === labels.length - 1 ? 'right' : 'left' })
    x += width
  })
  doc.moveTo(40, y + 14).lineTo(555, y + 14).strokeColor(GOLD).lineWidth(1).stroke()
  return y + 22
}

function tableRow(doc: PDFKit.PDFDocument, y: number, cells: string[], widths = [80, 200, 235]) {
  let x = 40
  doc.font('Times-Roman').fontSize(10).fillColor(INK)
  cells.forEach((cell, index) => {
    const width = widths[index] ?? 80
    doc.text(cell, x, y, { width: width - 8, align: index === cells.length - 1 ? 'right' : 'left' })
    x += width
  })
  return y + 18
}

function pair(doc: PDFKit.PDFDocument, y: number, label: string, value: string) {
  doc.font('Times-Roman').fontSize(10).fillColor(MIST).text(label, 40, y, { width: 280 })
  doc.font('Times-Bold').fillColor(INK).text(value, 340, y, { width: 215, align: 'right' })
  return y + 16
}

function three(
  doc: PDFKit.PDFDocument,
  y: number,
  left: [string, string],
  middle: [string, string],
  right: [string, string],
) {
  doc.rect(40, y, 515, 52).fill(PAPER)
  ;[left, middle, right].forEach(([label, value], index) => {
    const x = 52 + index * 168
    doc.fillColor(MIST).font('Times-Roman').fontSize(9).text(label, x, y + 10, { width: 150 })
    doc.fillColor(INK).font('Times-Bold').fontSize(13).text(value, x, y + 26, { width: 150 })
  })
  return y + 64
}

function resultBand(doc: PDFKit.PDFDocument, y: number, resultado: number, caption = 'Resultado del 303') {
  const label = resultado > 0 ? 'A ingresar' : resultado < 0 ? 'A compensar' : 'Resultado cero'
  const amount = euro.format(Math.abs(resultado))
  doc.rect(40, y, 515, 58).fill(PINE)
  doc.rect(40, y, 5, 58).fill(GOLD)
  doc.fillColor(GOLD).font('Times-Roman').fontSize(10).text(caption, 56, y + 10)
  doc.fillColor(PAPER).font('Times-Bold').fontSize(12).text(label, 56, y + 28)
  doc.fillColor(PAPER).font('Times-Bold').fontSize(18).text(amount, 300, y + 20, { width: 240, align: 'right' })
  return y + 58
}

export interface YearSettlementPdfInput {
  year: number
  settledOn: string
  org: SettlementPdfInput['org']
  quarters: Array<{
    quarter: 1 | 2 | 3 | 4
    modelo303: Modelo303
    modelo111: Modelo111
  }>
  total303: Pick<Modelo303, 'devengado' | 'deducible' | 'resultado'>
  total111: Modelo111
  modelo349: Modelo349Line[]
  empty: boolean
}

export function renderYearSettlementPdf(input: YearSettlementPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    paintYear(doc, input)
    doc.end()
  })
}

function paintYear(doc: PDFKit.PDFDocument, input: YearSettlementPdfInput) {
  doc.rect(0, 0, 595.28, 118).fill(PINE)
  doc.rect(0, 118, 595.28, 5).fill(GOLD)
  doc.fillColor(GOLD).font('Times-Bold').fontSize(11).text('NORTE LUZ', 40, 28)
  doc.fillColor(PAPER).font('Times-Bold').fontSize(24).text('Liquidación del ejercicio', 40, 48)
  doc.font('Times-Roman').fontSize(11).fillColor('#d9d3c7').text('Cuatro trimestres · modelos 303, 111 y 349', 40, 82)
  doc.fillColor(PAPER).font('Times-Bold').fontSize(20).text(String(input.year), 390, 52, { width: 165, align: 'right' })

  doc.fillColor(INK).font('Times-Bold').fontSize(12).text(input.org.legalName, 40, 144, { width: 320 })
  doc.font('Times-Roman').fontSize(10).fillColor(MIST).text(`NIF ${input.org.nif}`, 40, 162)
  doc.text(input.org.fiscalAddress, 40, 176, { width: 300 })
  doc.text(`Del 01/01/${input.year} al 31/12/${input.year}`, 340, 150, { width: 215, align: 'right' })
  doc.text(`Liquidada el ${fecha(input.settledOn)}`, 340, 166, { width: 215, align: 'right' })

  let y = 214
  if (input.empty) {
    doc.fillColor(MIST).font('Times-Roman').fontSize(10).text('Este ejercicio no tiene documentos contabilizados.', 40, y)
    y += 22
  }
  doc.fillColor(PINE).font('Times-Bold').fontSize(14).text('Los cuatro trimestres', 40, y)
  doc.fillColor(MIST).font('Times-Roman').fontSize(10).text('Cada fila conserva la liquidación de ese trimestre.', 40, y + 18)
  y += 40
  const columns = [70, 115, 110, 110, 110]
  y = tableHead(doc, y, ['Trimestre', 'Devengado', 'Deducible', '303', '111'], columns)
  for (const quarter of input.quarters) {
    y = yearRow(doc, y, [
      `${quarter.quarter}T`,
      euro.format(quarter.modelo303.devengado),
      euro.format(quarter.modelo303.deducible),
      euro.format(quarter.modelo303.resultado),
      euro.format(quarter.modelo111.retencion),
    ], columns, false)
  }
  y = yearRow(doc, y, [
    'Ejercicio',
    euro.format(input.total303.devengado),
    euro.format(input.total303.deducible),
    euro.format(input.total303.resultado),
    euro.format(input.total111.retencion),
  ], columns, true)
  y += 12
  y = resultBand(doc, y, input.total303.resultado, 'Resultado del ejercicio')
  y += 18
  y = sectionTitle(doc, y, 'Modelo 111', 'Suma de los perceptores de cada trimestre')
  y = three(
    doc,
    y,
    ['Perceptores', String(input.total111.perceptores)],
    ['Base de retención', euro.format(input.total111.base)],
    ['A ingresar', euro.format(input.total111.retencion)],
  )
  y += 16
  y = sectionTitle(doc, y, 'Modelo 349', 'Operadores del ejercicio, sumando los cuatro trimestres')
  if (input.modelo349.length === 0) {
    doc.fillColor(MIST).font('Times-Roman').fontSize(10).text('Sin operaciones intracomunitarias en el ejercicio.', 40, y)
  } else {
    const intra = [120, 180, 130, 85]
    y = tableHead(doc, y, ['NIF-IVA', 'Operador', 'Clave', 'Base'], intra)
    for (const line of input.modelo349) {
      if (y > 760) {
        doc.addPage()
        y = 48
      }
      y = tableRow(
        doc,
        y,
        [line.vatId, line.name, `${line.clave} · ${CLAVE[line.clave] || line.clave}`, euro.format(line.base)],
        intra,
      )
    }
  }

  doc.fillColor(MIST).font('Times-Roman').fontSize(8).text(
    'Documento de demostración. No es una autoliquidación presentada ante la Agencia Tributaria.',
    40,
    800,
    { width: 515 },
  )
}

function yearRow(doc: PDFKit.PDFDocument, y: number, cells: string[], widths: number[], strong: boolean) {
  let x = 40
  doc.font(strong ? 'Times-Bold' : 'Times-Roman').fontSize(10).fillColor(INK)
  cells.forEach((cell, index) => {
    const width = widths[index] ?? 80
    doc.text(cell, x, y, { width: width - 8, align: index === 0 ? 'left' : 'right' })
    x += width
  })
  if (strong) doc.moveTo(40, y - 4).lineTo(555, y - 4).strokeColor(GOLD).lineWidth(1).stroke()
  return y + 18
}

function fecha(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}
