'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { euro, operationLabel, todayIso } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { Button, Card, ErrorNote, Field, PageTitle, control } from '@/components/shell'

interface Contact { id: string; name: string; kind: string; nif: string }
interface Service { id: string; name: string; unitPrice: number; vatRate: number }
interface Line { concept: string; quantity: number; unitPrice: number; vatRate: number }
interface LineRow extends Line { key: number }

const blankLine = (): Line => ({ concept: 'Asesoramiento energético', quantity: 1, unitPrice: 100, vatRate: 21 })

function plusDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function NewQuotePage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [contactId, setContactId] = useState('')
  const [date, setDate] = useState(todayIso)
  const [validUntil, setValidUntil] = useState(() => plusDays(todayIso(), 30))
  const [operation, setOperation] = useState('NACIONAL')
  const lineKey = useRef(0)
  const makeRow = (line: Line): LineRow => ({ ...line, key: lineKey.current++ })
  const [lines, setLines] = useState<LineRow[]>(() => [makeRow(blankLine())])
  const [error, setError] = useState('')
  const toast = useToast()

  useEffect(() => {
    Promise.all([api<Contact[]>('/contacts'), api<Service[]>('/services')]).then(([people, catalog]) => {
      const clients = people.filter((item) => item.kind !== 'SUPPLIER')
      setContacts(clients)
      setServices(catalog)
      setContactId(clients[0]?.id || '')
    })
  }, [])

  const preview = lines.reduce(
    (sum, line) => {
      const base = line.quantity * line.unitPrice
      const rate = operation === 'NACIONAL' ? line.vatRate : 0
      return { base: sum.base + base, vat: sum.vat + (base * rate) / 100 }
    },
    { base: 0, vat: 0 },
  )

  function update(index: number, patch: Partial<Line>) {
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const created = await api<{ id: string }>('/quotes', {
        method: 'POST',
        body: JSON.stringify({
          contactId,
          date,
          validUntil,
          operation,
          lines: lines.map(({ concept, quantity, unitPrice, vatRate }) => ({ concept, quantity, unitPrice, vatRate })),
        }),
      })
      toast('Presupuesto guardado')
      router.push(`/presupuestos/${created.id}`)
    } catch (caught) {
      const message = reason(caught, 'No se pudo guardar el presupuesto')
      setError(message)
      toast(message, 'bad')
    }
  }

  const client = contacts.find((item) => item.id === contactId)

  return (
    <div>
      <PageTitle
        backFallback="/presupuestos"
        title="Nuevo presupuesto"
        text="El total es orientativo. No entra en los impuestos hasta que lo conviertas en factura."
      />
      <Card>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Cliente" required hint={client?.nif ? `NIF ${client.nif}. No hace falta repetirlo.` : undefined}>
              <select className={control} value={contactId} onChange={(event) => setContactId(event.target.value)} required>
                {contacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Operación" required hint="En España se aplica el IVA. Dentro de la UE, el IVA suele ser cero.">
              <select className={control} value={operation} onChange={(event) => setOperation(event.target.value)}>
                {Object.entries(operationLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Fecha" required>
              <input className={control} type="date" required min="1990-01-01" max="2100-12-31" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Válido hasta">
              <input className={control} type="date" min="1990-01-01" max="2100-12-31" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
            </Field>
          </div>
          {services.length > 0 ? (
            <Field label="Añadir un servicio del catálogo">
              <select
                className={control}
                defaultValue=""
                onChange={(event) => {
                  const service = services.find((item) => item.id === event.target.value)
                  if (!service) return
                  setLines([...lines, makeRow({ concept: service.name, quantity: 1, unitPrice: service.unitPrice, vatRate: service.vatRate })])
                  event.target.value = ''
                }}
              >
                <option value="">Elegir…</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </Field>
          ) : null}
          <div className="hidden px-3 text-xs uppercase tracking-[0.14em] text-mist md:grid md:grid-cols-[minmax(0,1fr)_80px_110px_96px_44px]">
            <span>Concepto</span>
            <span className="text-center">Cant.</span>
            <span className="text-center">Precio</span>
            <span className="text-center">IVA</span>
          </div>
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={line.key} className="grid gap-2 rounded-lg bg-paper p-3 md:grid-cols-[minmax(0,1fr)_80px_110px_96px_44px]">
                <input className={control} aria-label="Concepto" maxLength={240} value={line.concept} onChange={(event) => update(index, { concept: event.target.value })} />
                <input className={`${control} tabular-nums text-center`} aria-label="Cantidad" type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} />
                <input className={`${control} tabular-nums text-center`} aria-label="Precio unitario" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => update(index, { unitPrice: Number(event.target.value) })} />
                <select className={control} aria-label="IVA" value={line.vatRate} onChange={(event) => update(index, { vatRate: Number(event.target.value) })}>
                  {[0, 4, 10, 21].map((rate) => <option key={rate} value={rate}>{rate} %</option>)}
                </select>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-mist disabled:opacity-35"
                  aria-label="Quitar línea"
                  disabled={lines.length <= 1}
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="text-sm text-moss" onClick={() => setLines([...lines, makeRow(blankLine())])}>Añadir línea</button>
          <p className="tabular text-sm text-mist">
            Vista previa {euro.format(preview.base + preview.vat)} · base {euro.format(preview.base)} · IVA {euro.format(preview.vat)}
          </p>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button type="submit">Guardar presupuesto</Button>
        </form>
      </Card>
    </div>
  )
}
