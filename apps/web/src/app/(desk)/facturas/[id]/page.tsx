'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { euro, fecha, operationLabel } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { BackButton, Button, Card, ErrorNote, Field, PageTitle, Pill } from '@/components/shell'

interface Invoice {
  id: string
  code: string
  issueDate: string
  dueDate: string | null
  displayStatus: string
  status: string
  operation: string
  rectifiesId: string | null
  base: number
  vat: number
  total: number
  paidAmount: number
  contact: { name: string; nif: string }
  lines: { id: string; concept: string; quantity: number; unitPrice: number; vatRate: number; base: number; vatAmount: number }[]
  payments: { id: string; amount: number; date: string }[]
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('2026-06-15')
  const [error, setError] = useState('')
  const toast = useToast()

  function load() {
    api<Invoice>(`/issued-invoices/${params.id}`).then(setInvoice).catch((caught: Error) => setError(caught.message))
  }
  useEffect(load, [params.id])

  async function run(path: string, body?: unknown) {
    setError('')
    try {
      const next = await api<Invoice>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
      setInvoice(next)
      toast(path.endsWith('/issue') ? 'Factura emitida' : path.endsWith('/rectify') ? 'Rectificativa creada' : 'Cobro registrado')
    } catch (caught) {
      const message = reason(caught, 'No se pudo completar')
      setError(message)
      toast(message, 'bad')
    }
  }

  async function pdf() {
    try {
      const blob = await api<Blob>(`/issued-invoices/${params.id}/pdf`)
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (caught) {
      toast(reason(caught, 'No se pudo abrir el PDF'), 'bad')
    }
  }

  if (!invoice) {
    return (
      <div>
        <BackButton fallback="/facturas" />
        <p className="text-mist">{error || 'Cargando factura…'}</p>
      </div>
    )
  }
  const sign = invoice.rectifiesId ? -1 : 1
  const pending = Math.round((invoice.total - invoice.paidAmount) * 100) / 100

  return (
    <div>
      <PageTitle
        backFallback="/facturas"
        title={invoice.rectifiesId ? `Rectificativa ${invoice.code}` : invoice.code}
        text={`${invoice.contact.name} · ${invoice.contact.nif} · ${operationLabel[invoice.operation]}`}
        action={<Pill status={invoice.displayStatus} />}
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <p className="text-sm text-mist">{fecha(invoice.issueDate)}{invoice.dueDate ? ` · vence ${fecha(invoice.dueDate)}` : ''}</p>
          <table className="book mt-4">
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-b border-line">
                  <td className="py-2">{line.concept}</td>
                  <td className="tabular py-2 text-right">{line.quantity} × {euro.format(line.unitPrice)}</td>
                  <td className="tabular py-2 text-right">{line.vatRate} %</td>
                  <td className="tabular py-2 text-right">{euro.format(sign * line.base)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-1 text-right">
            <p>Base {euro.format(sign * invoice.base)}</p>
            <p>IVA {euro.format(sign * invoice.vat)}</p>
            <p className="font-serif text-2xl text-pine">Total {euro.format(sign * invoice.total)}</p>
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="space-y-3">
            <Button onClick={() => void pdf()}>Ver PDF</Button>
            {invoice.status === 'BORRADOR' ? <Button onClick={() => void run(`/issued-invoices/${invoice.id}/issue`)}>Emitir</Button> : null}
            {invoice.status !== 'BORRADOR' && !invoice.rectifiesId ? (
              <Button tone="ghost" onClick={() => void run(`/issued-invoices/${invoice.id}/rectify`)}>Crear rectificativa</Button>
            ) : null}
          </Card>
          {pending > 0 && !invoice.rectifiesId && invoice.status !== 'BORRADOR' ? (
            <Card>
              <h2 className="font-serif text-xl">Registrar cobro</h2>
              <p className="mb-3 text-sm text-mist">Pendiente {euro.format(pending)}</p>
              <form
                className="space-y-2"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault()
                  void run(`/issued-invoices/${invoice.id}/payments`, { amount: Number(amount), date })
                }}
              >
                <Field label="Importe" required>
                  <input className="w-full rounded-md border border-line px-3 py-2" type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </Field>
                <input className="w-full rounded-md border border-line px-3 py-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Button type="submit">Cobrar</Button>
              </form>
            </Card>
          ) : null}
          {invoice.payments.length > 0 ? (
            <Card>
              <h2 className="mb-2 font-serif text-xl">Cobros</h2>
              {invoice.payments.map((payment) => (
                <p key={payment.id} className="flex justify-between text-sm">
                  <span>{fecha(payment.date)}</span>
                  <span className="tabular">{euro.format(payment.amount)}</span>
                </p>
              ))}
            </Card>
          ) : null}
          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </div>
      </div>
    </div>
  )
}
