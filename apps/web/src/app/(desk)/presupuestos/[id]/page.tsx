'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { euro, fecha, operationLabel, todayIso } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { Button, Card, ErrorNote, PageTitle, Pill } from '@/components/shell'

interface Quote {
  id: string
  code: string
  date: string
  validUntil: string | null
  status: string
  operation: string
  base: number
  vat: number
  total: number
  issuedInvoiceId: string | null
  contact: { name: string; nif: string }
  lines: { id: string; concept: string; quantity: number; unitPrice: number; vatRate: number }[]
}

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api<Quote>(`/quotes/${params.id}`).then(setQuote).catch((caught: Error) => setError(caught.message))
  }, [params.id])

  async function convert() {
    if (!quote) return
    const ok = window.confirm('Se emitirá una factura con estas líneas. A partir de ahí entra en el IVA. ¿Continuar?')
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      const result = await api<{ id: string }>(`/quotes/${quote.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({ issueDate: todayIso() }),
      })
      toast('Factura emitida')
      router.push(`/facturas/${result.id}`)
    } catch (caught) {
      const message = reason(caught, 'No se pudo convertir el presupuesto')
      setError(message)
      toast(message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!quote) return
    const ok = window.confirm(`¿Eliminar el presupuesto ${quote.code}?`)
    if (!ok) return
    try {
      await api(`/quotes/${quote.id}`, { method: 'DELETE' })
      toast('Presupuesto eliminado')
      router.push('/presupuestos')
    } catch (caught) {
      toast(reason(caught, 'No se pudo eliminar'), 'bad')
    }
  }

  if (!quote) {
    return (
      <div>
        <PageTitle backFallback="/presupuestos" title="Presupuesto" />
        {error ? <ErrorNote>{error}</ErrorNote> : <p className="text-mist">Cargando…</p>}
      </div>
    )
  }

  return (
    <div>
      <PageTitle
        backFallback="/presupuestos"
        title={quote.code}
        text={`${quote.contact.name} · NIF ${quote.contact.nif}. Un presupuesto abierto no suma en el panel.`}
        action={<Pill status={quote.status} />}
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <p className="text-sm text-mist">{fecha(quote.date)}{quote.validUntil ? ` · válido hasta ${fecha(quote.validUntil)}` : ''}</p>
          <p className="mt-1 text-sm text-mist">{operationLabel[quote.operation] || quote.operation}</p>
          <ul className="mt-4 divide-y divide-line/70">
            {quote.lines.map((line) => (
              <li key={line.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                <span>{line.concept} · {line.quantity} × {euro.format(line.unitPrice)}</span>
                <span className="tabular">{euro.format(line.quantity * line.unitPrice)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-serif text-2xl text-pine">Total {euro.format(quote.total)}</p>
          <p className="text-sm text-mist">Base {euro.format(quote.base)} · IVA {euro.format(quote.vat)}</p>
        </Card>
        <Card className="space-y-3">
          {quote.status !== 'CONVERTIDO' ? (
            <>
              <p className="text-sm text-mist">Al convertirlo se emite la factura de hoy y el presupuesto queda cerrado.</p>
              <Button disabled={busy} onClick={() => void convert()}>{busy ? 'Emitiendo…' : 'Convertir en factura'}</Button>
              <Button tone="ghost" onClick={() => void remove()}>Eliminar</Button>
            </>
          ) : quote.issuedInvoiceId ? (
            <Link href={`/facturas/${quote.issuedInvoiceId}`} className="text-sm text-moss hover:text-pine">Ver factura</Link>
          ) : null}
          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </Card>
      </div>
    </div>
  )
}
