'use client'

import { FormEvent, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { euro, todayIso } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { RowIconButton } from '@/components/list-row-actions'
import { Button, Card, ErrorNote, Field, control } from '@/components/shell'

export interface ExpenseListRow {
  id: string
  concept: string
  supplierName: string
  total: number
  paidAmount: number
  hasFile: boolean
}

export async function openExpenseFile(id: string) {
  const blob = await api<Blob>(`/expenses/${id}/file`)
  window.open(URL.createObjectURL(blob), '_blank')
}

export function ExpenseRowActions({
  expense,
  onPay,
  onFile,
  onDelete,
  canDelete,
}: {
  expense: ExpenseListRow
  onPay: () => void
  onFile: () => void
  onDelete: () => void
  canDelete: boolean
}) {
  const payOk = expense.paidAmount < expense.total
  const removeOk = canDelete && expense.paidAmount <= 0
  return (
    <div className="flex items-center justify-center gap-1">
      <RowIconButton label={payOk ? `Pagar ${expense.concept}` : 'Ya está pagado'} disabled={!payOk} onClick={onPay}>
        <CoinIcon />
      </RowIconButton>
      <RowIconButton
        label={expense.hasFile ? `Ver adjunto: ${expense.concept}` : 'Este gasto no tiene archivo'}
        disabled={!expense.hasFile}
        onClick={onFile}
      >
        <AttachmentIcon />
      </RowIconButton>
      <RowIconButton
        label={removeOk ? `Eliminar ${expense.concept}` : 'No se puede eliminar si tiene pagos'}
        tone="danger"
        disabled={!removeOk}
        onClick={onDelete}
      >
        <TrashIcon />
      </RowIconButton>
    </div>
  )
}

export function PayExpenseModal({
  expense,
  onClose,
  onSuccess,
}: {
  expense: ExpenseListRow
  onClose: () => void
  onSuccess: (updated: ExpenseListRow) => void
}) {
  const pending = Math.round((expense.total - expense.paidAmount) * 100) / 100
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
      const updated = await api<ExpenseListRow>(`/expenses/${expense.id}/payments`, {
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
          <p className="mt-1 text-sm text-mist">{expense.concept} · {expense.supplierName}</p>
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

function AttachmentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4h8l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 4v4h4M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
