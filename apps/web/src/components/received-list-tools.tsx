'use client'

import { FormEvent, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { euro, operationLabel, todayIso } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { RowIconButton } from '@/components/list-row-actions'
import { Button, Card, ErrorNote, Field, control } from '@/components/shell'

export interface ReceivedListRow {
  id: string
  number: string
  date: string
  concept: string
  base: number
  vatRate: number
  operation: string
  vatDeductible: boolean
  total: number
  paidAmount: number
  status: string
  hasFile: boolean
  supplier: { name: string }
}

export function canDeleteReceived(row: Pick<ReceivedListRow, 'paidAmount'>) {
  return row.paidAmount <= 0
}

export async function openReceivedFile(id: string) {
  const blob = await api<Blob>(`/received-invoices/${id}/file`)
  window.open(URL.createObjectURL(blob), '_blank')
}

export function ReceivedRowActions({
  invoice,
  onEdit,
  onPay,
  onFile,
  onDelete,
  canDelete,
}: {
  invoice: ReceivedListRow
  onEdit: () => void
  onPay: () => void
  onFile: () => void
  onDelete: () => void
  canDelete: boolean
}) {
  const fileOk = invoice.hasFile
  const removeOk = canDelete && canDeleteReceived(invoice)
  const payOk = invoice.paidAmount < invoice.total
  return (
    <div className="flex items-center justify-center gap-1">
      <RowIconButton label={`Editar ${invoice.number}`} onClick={onEdit}>
        <EditIcon />
      </RowIconButton>
      <RowIconButton label={payOk ? `Pagar ${invoice.number}` : 'Ya está pagada'} disabled={!payOk} onClick={onPay}>
        <CoinIcon />
      </RowIconButton>
      <RowIconButton
        label={fileOk ? `Ver adjunto ${invoice.number}` : 'Esta factura no tiene archivo'}
        disabled={!fileOk}
        onClick={onFile}
      >
        <AttachmentIcon />
      </RowIconButton>
      <RowIconButton
        label={removeOk ? `Eliminar ${invoice.number}` : 'No se puede eliminar si tiene pagos'}
        tone="danger"
        disabled={!removeOk}
        onClick={onDelete}
      >
        <TrashIcon />
      </RowIconButton>
    </div>
  )
}

export function EditReceivedModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: ReceivedListRow
  onClose: () => void
  onSuccess: (updated: ReceivedListRow) => void
}) {
  const [number, setNumber] = useState(invoice.number)
  const [date, setDate] = useState(invoice.date)
  const [concept, setConcept] = useState(invoice.concept)
  const [base, setBase] = useState(String(invoice.base))
  const [vatRate, setVatRate] = useState(String(invoice.vatRate))
  const [operation, setOperation] = useState(invoice.operation)
  const [vatDeductible, setVatDeductible] = useState(invoice.vatDeductible)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const locked = invoice.paidAmount > 0

  useEffect(() => {
    setNumber(invoice.number)
    setDate(invoice.date)
    setConcept(invoice.concept)
    setBase(String(invoice.base))
    setVatRate(String(invoice.vatRate))
    setOperation(invoice.operation)
    setVatDeductible(invoice.vatDeductible)
    setError('')
  }, [invoice])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked) return
    setBusy(true)
    setError('')
    try {
      const updated = await api<ReceivedListRow>(`/received-invoices/${invoice.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          number,
          date,
          concept,
          base,
          vatRate,
          operation,
          vatDeductible,
        }),
      })
      toast('Factura recibida actualizada')
      onSuccess(updated)
      onClose()
    } catch (caught) {
      const message = reason(caught, 'No se pudo guardar')
      setError(message)
      toast(message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <Card>
          <h2 className="font-serif text-xl text-pine">Editar factura recibida</h2>
          <p className="mt-1 text-sm text-mist">{invoice.supplier.name}</p>
          {locked ? <p className="mt-2 text-sm text-clay">Tiene pagos registrados y no se puede editar.</p> : null}
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <Field label="Número" required><input className={control} required maxLength={40} value={number} disabled={locked} onChange={(e) => setNumber(e.target.value)} /></Field>
            <Field label="Fecha" required><input className={control} type="date" required min="1990-01-01" max="2100-12-31" value={date} disabled={locked} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Concepto" required><input className={control} required maxLength={240} value={concept} disabled={locked} onChange={(e) => setConcept(e.target.value)} /></Field>
            <Field label="Base imponible" required hint="Importe antes de IVA. El total lo calcula el servidor.">
              <input className={control} type="number" min="0" step="0.01" required value={base} disabled={locked} onChange={(e) => setBase(e.target.value)} />
            </Field>
            <Field label="IVA">
              <select className={control} value={vatRate} disabled={locked} onChange={(e) => setVatRate(e.target.value)}>
                {[0, 4, 10, 21].map((rate) => <option key={rate} value={rate}>{rate}</option>)}
              </select>
            </Field>
            <Field label="Operación">
              <select className={control} value={operation} disabled={locked} onChange={(e) => setOperation(e.target.value)}>
                {Object.entries(operationLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={vatDeductible} disabled={locked} onChange={(e) => setVatDeductible(e.target.checked)} />
              IVA deducible
            </label>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <div className="flex gap-2 pt-1">
              {!locked ? <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button> : null}
              <Button type="button" tone="ghost" onClick={onClose}>Cerrar</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20h4l10.5-10.5a1.8 1.8 0 0 0 0-2.5l-1.5-1.5a1.8 1.8 0 0 0-2.5 0L4 16v4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M13.5 6.5 17.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function AttachmentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4h8l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 4v4h4M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function PayReceivedModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: ReceivedListRow
  onClose: () => void
  onSuccess: (updated: ReceivedListRow) => void
}) {
  const pending = Math.round((invoice.total - invoice.paidAmount) * 100) / 100
  const [amount, setAmount] = useState(String(pending))
  const [date, setDate] = useState(todayIso)
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api<{ accounts: { id: string; name: string }[] }>('/banks')
      .then((data) => setAccounts(data.accounts))
      .catch(() => setAccounts([]))
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await api<ReceivedListRow>(`/received-invoices/${invoice.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), date, ...(bankAccountId ? { bankAccountId } : {}) }),
      })
      toast(bankAccountId ? 'Pago registrado y anotado en el banco' : 'Pago registrado')
      onSuccess(updated)
      onClose()
    } catch (caught) {
      const message = reason(caught, 'No se pudo registrar el pago')
      setError(message)
      toast(message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <Card>
          <h2 className="font-serif text-2xl text-pine">Registrar pago</h2>
          <p className="mt-1 text-sm text-mist">{invoice.number} · {invoice.supplier.name}</p>
          <p className="tabular mt-2 text-sm text-mist">Pendiente {euro.format(pending)}</p>
          <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
            <Field label="Importe" required>
              <input className={control} type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </Field>
            <Field label="Fecha" required>
              <input className={control} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </Field>
            {accounts.length > 0 ? (
              <Field label="Cuenta bancaria" hint="Si eliges una, el pago queda anotado en el banco.">
                <select className={control} value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
                  <option value="">No anotar en el banco</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </Field>
            ) : null}
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Pagar'}</Button>
              <Button type="button" tone="ghost" onClick={onClose}>Cancelar</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

function CoinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v8M9.5 10.2c.4-.8 1.3-1.2 2.5-1.2 1.4 0 2.3.7 2.3 1.7 0 2.2-4.8 1.2-4.8 3.3 0 1 .9 1.7 2.5 1.7 1.2 0 2.1-.4 2.5-1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 7l.8 12.2A1.5 1.5 0 0 0 9.3 20.5h5.4a1.5 1.5 0 0 0 1.5-1.3L17 7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 10.5v6M14 10.5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
