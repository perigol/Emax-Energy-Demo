import { asNumber, invoiceCode } from '../common/money'
import type { PrismaService } from '../prisma/prisma.service'

type IssuedShape = {
  id: string
  issueDate: Date
  dueDate: Date | null
  status: string
  rectifiesId: string | null
  series: string | null
  number: number | null
  base: { toString(): string }
  vat: { toString(): string }
  irpfWithheld: { toString(): string }
  total: { toString(): string }
  paidAmount: { toString(): string }
  lines?: Array<{
    quantity: { toString(): string }
    unitPrice: { toString(): string }
    base: { toString(): string }
    vatAmount: { toString(): string }
    [key: string]: unknown
  }>
  payments?: Array<{ amount: { toString(): string }; date: Date; [key: string]: unknown }>
  [key: string]: unknown
}

export type RectifiedLookup = {
  originalIds: ReadonlySet<string>
  rectificativaByOriginal: ReadonlyMap<string, string>
}

export async function loadRectifiedLookup(prisma: PrismaService, invoiceIds: string[]): Promise<RectifiedLookup> {
  if (!invoiceIds.length) {
    return { originalIds: new Set(), rectificativaByOriginal: new Map() }
  }
  const links = await prisma.issuedInvoice.findMany({
    where: { rectifiesId: { in: invoiceIds } },
    select: { id: true, rectifiesId: true },
  })
  const rectificativaByOriginal = new Map<string, string>()
  for (const link of links) {
    if (link.rectifiesId) rectificativaByOriginal.set(link.rectifiesId, link.id)
  }
  return { originalIds: new Set(rectificativaByOriginal.keys()), rectificativaByOriginal }
}

export function resolveDisplayStatus(
  invoice: { id: string; status: string; dueDate: Date | null; rectifiesId: string | null },
  lookup: RectifiedLookup,
): string {
  if (invoice.rectifiesId != null && String(invoice.rectifiesId).length > 0) return 'RECTIFICATIVA'
  if (lookup.originalIds.has(invoice.id)) return 'RECTIFICADA'
  const today = new Date().toISOString().slice(0, 10)
  const due = invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null
  const status = invoice.status
  if (status === 'EMITIDA' && due && due < today) return 'VENCIDA'
  return status
}

export function presentIssuedInvoice(invoice: IssuedShape, lookup: RectifiedLookup) {
  const displayStatus = resolveDisplayStatus(invoice, lookup)
  const hasRectificativa = lookup.originalIds.has(invoice.id)
  const rectificativaId = lookup.rectificativaByOriginal.get(invoice.id) ?? null
  const due = invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null
  return {
    ...invoice,
    code: invoiceCode(invoice.series, invoice.issueDate, invoice.number),
    issueDate: invoice.issueDate.toISOString().slice(0, 10),
    dueDate: due,
    rectifiesId: invoice.rectifiesId ?? null,
    base: asNumber(invoice.base),
    vat: asNumber(invoice.vat),
    irpfWithheld: asNumber(invoice.irpfWithheld),
    total: asNumber(invoice.total),
    paidAmount: asNumber(invoice.paidAmount),
    hasRectificativa,
    rectificativaId,
    displayStatus,
    lines: invoice.lines?.map((line) => ({
      ...line,
      quantity: asNumber(line.quantity),
      unitPrice: asNumber(line.unitPrice),
      base: asNumber(line.base),
      vatAmount: asNumber(line.vatAmount),
    })),
    payments: invoice.payments?.map((payment) => ({
      ...payment,
      amount: asNumber(payment.amount),
      date: payment.date.toISOString().slice(0, 10),
    })),
  }
}
