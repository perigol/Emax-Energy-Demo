'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { euro, todayIso } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { Button, Card, ErrorNote, Field, control } from '@/components/shell'

export interface IssuedListInvoice {
  id: string
  code: string
  issueDate: string
  status: string
  displayStatus: string
  total: number
  paidAmount: number
  rectifiesId: string | null
  hasRectificativa?: boolean
  contact: { name: string }
}

export function issuedPending(row: Pick<IssuedListInvoice, 'total' | 'paidAmount'>) {
  return Math.round((row.total - row.paidAmount) * 100) / 100
}

export function canCollectIssued(row: Pick<IssuedListInvoice, 'status' | 'rectifiesId' | 'total' | 'paidAmount'>) {
  return row.status !== 'BORRADOR' && !row.rectifiesId && issuedPending(row) > 0
}

export function canPdfIssued(row: Pick<IssuedListInvoice, 'status'>) {
  return row.status !== 'BORRADOR'
}

export function canEditIssued(row: Pick<IssuedListInvoice, 'paidAmount' | 'rectifiesId' | 'hasRectificativa'>) {
  return row.paidAmount <= 0 && !row.rectifiesId && !row.hasRectificativa
}

export async function openIssuedPdf(id: string) {
  const blob = await api<Blob>(`/issued-invoices/${id}/pdf`)
  window.open(URL.createObjectURL(blob), '_blank')
}

function RowIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-mist transition hover:border-gold hover:text-pine disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}

export function InvoiceRowActions({
  invoice,
  onCollect,
  onPdf,
}: {
  invoice: IssuedListInvoice
  onCollect: () => void
  onPdf: () => void
}) {
  const collect = canCollectIssued(invoice)
  const pdf = canPdfIssued(invoice)
  return (
    <div className="flex items-center justify-center gap-1">
      <Link
        href={`/facturas/${invoice.id}`}
        aria-label={`Ver factura ${invoice.code}`}
        title={`Ver factura ${invoice.code}`}
        className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-mist transition hover:border-gold hover:text-pine"
      >
        <EyeIcon />
      </Link>
      {canEditIssued(invoice) ? (
        <Link
          href={`/facturas/${invoice.id}?editar=1`}
          aria-label={`Editar factura ${invoice.code}`}
          title={`Editar factura ${invoice.code}`}
          className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-mist transition hover:border-gold hover:text-pine"
        >
          <EditIcon />
        </Link>
      ) : null}
      <RowIconButton label={collect ? `Cobrar ${invoice.code}` : 'Sin importe pendiente'} disabled={!collect} onClick={onCollect}>
        <CoinIcon />
      </RowIconButton>
      <RowIconButton label={pdf ? `PDF ${invoice.code}` : 'Emita la factura para ver el PDF'} disabled={!pdf} onClick={onPdf}>
        <PdfIcon />
      </RowIconButton>
    </div>
  )
}

export function CollectInvoiceModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: IssuedListInvoice
  onClose: () => void
  onSuccess: (updated: IssuedListInvoice) => void
}) {
  const pending = issuedPending(invoice)
  const [amount, setAmount] = useState(String(pending))
  const [date, setDate] = useState(todayIso)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [bankAccountId, setBankAccountId] = useState('')
  const toast = useToast()

  useEffect(() => {
    api<{ accounts: { id: string; name: string }[] }>('/banks')
      .then((data) => setAccounts(data.accounts))
      .catch(() => setAccounts([]))
  }, [])

  useEffect(() => {
    setAmount(String(pending))
    setDate(todayIso())
  }, [invoice.id, pending])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const updated = await api<IssuedListInvoice>(`/issued-invoices/${invoice.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), date, ...(bankAccountId ? { bankAccountId } : {}) }),
      })
      toast(bankAccountId ? 'Cobro registrado y anotado en el banco' : 'Cobro registrado')
      onSuccess(updated)
      onClose()
    } catch (caught) {
      const message = reason(caught, 'No se pudo registrar el cobro')
      setError(message)
      toast(message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div className="w-full max-w-md" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="collect-title">
      <Card className="!shadow-lg">
        <h2 id="collect-title" className="font-serif text-2xl text-pine">Registrar cobro</h2>
        <p className="mt-1 text-sm text-mist">
          {invoice.code} · {invoice.contact.name}
        </p>
        <p className="tabular mt-2 text-sm text-mist">Pendiente {euro.format(pending)}</p>
        <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
          <Field label="Importe" required>
            <input
              className={control}
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </Field>
          <Field label="Fecha" required>
            <input className={control} type="date" min="1990-01-01" max="2100-12-31" value={date} onChange={(event) => setDate(event.target.value)} required />
          </Field>
          {accounts.length > 0 ? (
            <Field label="Cuenta bancaria" hint="Si eliges una, el cobro queda anotado en el banco.">
              <select className={control} value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
                <option value="">No anotar en el banco</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </Field>
          ) : null}
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Cobrar'}</Button>
            <Button type="button" tone="ghost" onClick={onClose}>
              Cancelar
            </Button>
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
      <path
        d="M4 20h4l10.5-10.5a1.8 1.8 0 0 0 0-2.5l-1.5-1.5a1.8 1.8 0 0 0-2.5 0L4 16v4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5 17.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function CoinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8.5v7M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PdfIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4h8l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 4v4h4M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
