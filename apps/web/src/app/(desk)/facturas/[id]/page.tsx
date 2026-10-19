'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { euro, fecha, issuedDisplayStatus, operationLabel, todayIso } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { BackButton, Button, Card, ErrorNote, Field, PageTitle, Pill, control } from '@/components/shell'

interface Invoice {
  id: string
  code: string
  issueDate: string
  dueDate: string | null
  displayStatus: string
  status: string
  operation: string
  rectifiesId: string | null
  hasRectificativa: boolean
  rectificativaId: string | null
  base: number
  vat: number
  total: number
  paidAmount: number
  contactId: string
  contact: { id: string; name: string; nif: string }
  lines: { id: string; concept: string; quantity: number; unitPrice: number; vatRate: number; base: number; vatAmount: number }[]
  payments: { id: string; amount: number; date: string }[]
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso)
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const toast = useToast()

  function load() {
    api<Invoice>(`/issued-invoices/${params.id}`).then(setInvoice).catch((caught: Error) => setError(caught.message))
  }
  useEffect(load, [params.id])
  useEffect(() => {
    api<{ accounts: { id: string; name: string }[] }>('/banks')
      .then((data) => setAccounts(data.accounts))
      .catch(() => setAccounts([]))
  }, [])

  useEffect(() => {
    if (!invoice) return
    const editar = new URLSearchParams(window.location.search).get('editar')
    if (editar === '1' && invoice.paidAmount <= 0 && !invoice.rectifiesId && !invoice.hasRectificativa) {
      setEditing(true)
    }
  }, [invoice])

  async function run(path: string, body?: unknown) {
    setError('')
    try {
      const next = await api<Invoice>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
      if (path.endsWith('/rectify')) {
        toast('Rectificativa creada')
        router.push(`/facturas/${next.id}`)
        return
      }
      setInvoice(next)
      toast(path.endsWith('/issue') ? 'Factura emitida' : 'Cobro registrado')
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
  const canEdit = invoice.paidAmount <= 0 && !invoice.rectifiesId && !invoice.hasRectificativa

  return (
    <div>
      <PageTitle
        backFallback="/facturas"
        title={invoice.rectifiesId ? `Rectificativa ${invoice.code}` : invoice.code}
        text={`${invoice.contact.name} · ${invoice.contact.nif} · ${operationLabel[invoice.operation]}`}
        action={<Pill status={issuedDisplayStatus(invoice)} />}
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        {editing ? (
          <EditIssued
            invoice={invoice}
            onCancel={() => setEditing(false)}
            onSaved={(next) => {
              setInvoice(next)
              setEditing(false)
              toast('Factura actualizada')
            }}
          />
        ) : (
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
        )}
        <div className="space-y-4">
          <Card className="space-y-3">
            <Button onClick={() => void pdf()}>Ver PDF</Button>
            {canEdit ? <Button tone="ghost" onClick={() => setEditing((value) => !value)}>{editing ? 'Cerrar edición' : 'Editar'}</Button> : null}
            {invoice.status === 'BORRADOR' ? <Button onClick={() => void run(`/issued-invoices/${invoice.id}/issue`)}>Emitir</Button> : null}
            {invoice.status !== 'BORRADOR' && !invoice.rectifiesId && !invoice.hasRectificativa ? (
              <Button
                tone="ghost"
                onClick={() => {
                  const ok = window.confirm(
                    'Se emitirá una rectificativa con los mismos importes que esta factura. En impuestos anula el efecto de la original. ¿Continuar?',
                  )
                  if (ok) void run(`/issued-invoices/${invoice.id}/rectify`)
                }}
              >
                Crear rectificativa
              </Button>
            ) : null}
            {invoice.status !== 'BORRADOR' && !invoice.rectifiesId && !invoice.hasRectificativa ? (
              <p className="text-sm text-mist">Una rectificativa anula esta factura en el IVA.</p>
            ) : null}
            {invoice.hasRectificativa && invoice.rectificativaId ? (
              <Link href={`/facturas/${invoice.rectificativaId}`} className="block text-sm text-moss hover:text-pine">
                Ver rectificativa
              </Link>
            ) : null}
            {invoice.rectifiesId ? (
              <Link href={`/facturas/${invoice.rectifiesId}`} className="block text-sm text-moss hover:text-pine">
                Ver factura original
              </Link>
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
                  void run(`/issued-invoices/${invoice.id}/payments`, { amount: Number(amount), date, ...(bankAccountId ? { bankAccountId } : {}) })
                }}
              >
                <Field label="Importe" required>
                  <input className="w-full rounded-md border border-line px-3 py-2" type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </Field>
                <input className="w-full rounded-md border border-line px-3 py-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                {accounts.length > 0 ? (
                  <Field label="Cuenta bancaria" hint="Si eliges una, el cobro queda anotado en el banco.">
                    <select className={control} value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
                      <option value="">No anotar en el banco</option>
                      {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </Field>
                ) : null}
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

function EditIssued({
  invoice,
  onCancel,
  onSaved,
}: {
  invoice: Invoice
  onCancel: () => void
  onSaved: (next: Invoice) => void
}) {
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([])
  const [contactId, setContactId] = useState(invoice.contactId)
  const [issueDate, setIssueDate] = useState(invoice.issueDate)
  const [dueDate, setDueDate] = useState(invoice.dueDate || '')
  const [operation, setOperation] = useState(invoice.operation)
  const [lines, setLines] = useState(invoice.lines.map((line) => ({
    concept: line.concept,
    quantity: String(line.quantity),
    unitPrice: String(line.unitPrice),
    vatRate: line.vatRate,
  })))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api<{ id: string; name: string; kind: string }[]>('/contacts')
      .then((rows) => setContacts(rows.filter((row) => row.kind !== 'SUPPLIER')))
      .catch(() => setContacts([{ id: invoice.contactId, name: invoice.contact.name }]))
  }, [invoice.contactId, invoice.contact.name])

  function updateLine(index: number, patch: Partial<(typeof lines)[number]>) {
    setLines((current) => current.map((line, item) => (item === index ? { ...line, ...patch } : line)))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const next = await api<Invoice>(`/issued-invoices/${invoice.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          contactId,
          issueDate,
          dueDate: dueDate || undefined,
          operation,
          issue: false,
          lines: lines.map((line) => ({
            concept: line.concept,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            vatRate: operation === 'NACIONAL' ? line.vatRate : 0,
          })),
        }),
      })
      onSaved(next)
    } catch (caught) {
      const message = reason(caught, 'No se pudo guardar')
      setError(message)
      toast(message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="font-serif text-xl text-pine">Editar factura</h2>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <Field label="Cliente" required>
          <select className={control} value={contactId} onChange={(event) => setContactId(event.target.value)}>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha" required>
            <input className={control} type="date" required min="1990-01-01" max="2100-12-31" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          </Field>
          <Field label="Vencimiento">
            <input className={control} type="date" min="1990-01-01" max="2100-12-31" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Operación" required>
          <select className={control} value={operation} onChange={(event) => setOperation(event.target.value)}>
            {Object.entries(operationLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_5rem_6rem_5rem_auto]">
            <input className={control} required maxLength={240} value={line.concept} aria-label="Concepto" onChange={(event) => updateLine(index, { concept: event.target.value })} />
            <input className={control} required type="number" min="0.01" step="0.01" value={line.quantity} aria-label="Cantidad" onChange={(event) => updateLine(index, { quantity: event.target.value })} />
            <input className={control} required type="number" min="0" step="0.01" value={line.unitPrice} aria-label="Precio" onChange={(event) => updateLine(index, { unitPrice: event.target.value })} />
            <select className={control} value={line.vatRate} aria-label="IVA" disabled={operation !== 'NACIONAL'} onChange={(event) => updateLine(index, { vatRate: Number(event.target.value) })}>
              {[0, 4, 10, 21].map((rate) => <option key={rate} value={rate}>{rate} %</option>)}
            </select>
            <Button type="button" tone="ghost" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, item) => item !== index))}>Quitar</Button>
          </div>
        ))}
        <div>
          <Button type="button" tone="ghost" onClick={() => setLines((current) => [...current, { concept: '', quantity: '1', unitPrice: '0', vatRate: 21 }])}>Añadir línea</Button>
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
          <Button type="button" tone="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </form>
    </Card>
  )
}
