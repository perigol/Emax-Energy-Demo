'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { euro, operationLabel } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { Button, Card, ErrorNote, Field, PageTitle, control } from '@/components/shell'

interface Contact { id: string; name: string; kind: string }
interface Service { id: string; name: string; unitPrice: number; vatRate: number }
interface Line { concept: string; quantity: number; unitPrice: number; vatRate: number }
interface LineRow extends Line { key: number }

const blankLine = (): Line => ({ concept: 'Asesoramiento energético', quantity: 1, unitPrice: 100, vatRate: 21 })

const lineGrid = 'grid gap-2 md:grid-cols-[minmax(0,1.4fr)_80px_120px_100px_40px]'

export default function NewInvoicePage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [contactId, setContactId] = useState('')
  const [issueDate, setIssueDate] = useState('2026-02-15')
  const [dueDate, setDueDate] = useState('2026-03-15')
  const [operation, setOperation] = useState('NACIONAL')
  const lineKey = useRef(0)
  const makeRow = (line: Line): LineRow => ({ ...line, key: lineKey.current++ })
  const [lines, setLines] = useState<LineRow[]>(() => [makeRow(blankLine())])
  const [error, setError] = useState('')
  const toast = useToast()

  useEffect(() => {
    Promise.all([api<Contact[]>('/contacts'), api<Service[]>('/services')]).then(([people, catalog]) => {
      setContacts(people.filter((item) => item.kind !== 'SUPPLIER'))
      setServices(catalog)
      setContactId(people.find((item) => item.kind !== 'SUPPLIER')?.id || '')
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

  function removeLine(index: number) {
    if (lines.length <= 1) return
    setLines(lines.filter((_, i) => i !== index))
  }

  async function submit(issue: boolean) {
    setError('')
    try {
      const created = await api<{ id: string }>('/issued-invoices', {
        method: 'POST',
        body: JSON.stringify({
          contactId,
          issueDate,
          dueDate,
          operation,
          issue,
          lines: lines.map(({ concept, quantity, unitPrice, vatRate }) => ({ concept, quantity, unitPrice, vatRate })),
        }),
      })
      toast(issue ? 'Factura emitida' : 'Borrador guardado')
      router.push(`/facturas/${created.id}`)
    } catch (caught) {
      const message = reason(caught, 'No se pudo guardar la factura')
      setError(message)
      toast(message, 'bad')
    }
  }

  return (
    <div>
      <PageTitle
        backFallback="/facturas"
        title="Nueva factura"
        text="La vista previa es orientativa. El número y el total definitivos los calcula la API al guardar."
      />
      <Card>
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            void submit(true)
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Cliente" required>
              <select className={control} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
              </select>
            </Field>
            <Field label="Operación" required>
              <select className={control} value={operation} onChange={(e) => setOperation(e.target.value)}>
                {Object.entries(operationLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Fecha" required><input className={control} type="date" required min="1990-01-01" max="2100-12-31" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
            <Field label="Vencimiento"><input className={control} type="date" min="1990-01-01" max="2100-12-31" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          </div>
          {services.length > 0 ? (
            <Field label="Añadir un servicio del catálogo">
              <select
                className={control}
                defaultValue=""
                onChange={(event) => {
                  const service = services.find((item) => item.id === event.target.value)
                  if (!service) return
                  setLines([
                    ...lines,
                    makeRow({
                      concept: service.name,
                      quantity: 1,
                      unitPrice: service.unitPrice,
                      vatRate: service.vatRate,
                    }),
                  ])
                  event.target.value = ''
                }}
              >
                <option value="">Elegir…</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label="Líneas de la factura" required>
            <div className="space-y-2">
              <div className={`${lineGrid} px-3 text-xs uppercase tracking-[0.14em] text-mist max-md:hidden`} aria-hidden>
                <span>Concepto</span>
                <span className="text-right">Cant.</span>
                <span className="text-right">Precio unit.</span>
                <span className="text-right">IVA</span>
                <span />
              </div>
              {lines.map((line, index) => (
                <div key={line.key} className={`${lineGrid} items-center rounded-lg bg-paper p-3`}>
                  <input
                    className={control}
                    maxLength={240}
                    aria-label="Concepto"
                    value={line.concept}
                    onChange={(e) => update(index, { concept: e.target.value })}
                  />
                  <input
                    className={control}
                    type="number"
                    min="0.01"
                    max="9999999999.99"
                    step="0.01"
                    aria-label="Cantidad"
                    value={line.quantity}
                    onChange={(e) => update(index, { quantity: Number(e.target.value) })}
                  />
                  <input
                    className={control}
                    type="number"
                    min="0"
                    max="9999999999.99"
                    step="0.01"
                    aria-label="Precio unitario"
                    value={line.unitPrice}
                    onChange={(e) => update(index, { unitPrice: Number(e.target.value) })}
                  />
                  <select
                    className={control}
                    aria-label="IVA"
                    value={line.vatRate}
                    onChange={(e) => update(index, { vatRate: Number(e.target.value) })}
                  >
                    {[0, 4, 10, 21].map((rate) => <option key={rate} value={rate}>{rate} %</option>)}
                  </select>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center justify-self-end rounded-lg border border-line bg-white text-mist transition hover:border-clay hover:text-clay disabled:pointer-events-none disabled:opacity-35 md:justify-self-center"
                    aria-label="Quitar línea"
                    title={lines.length <= 1 ? 'La factura necesita al menos una línea' : 'Quitar línea'}
                    disabled={lines.length <= 1}
                    onClick={() => removeLine(index)}
                  >
                    <span aria-hidden className="text-lg leading-none">×</span>
                  </button>
                </div>
              ))}
            </div>
          </Field>
          <button type="button" className="text-sm text-moss" onClick={() => setLines([...lines, makeRow(blankLine())])}>
            Añadir línea
          </button>
          <p className="tabular text-sm text-mist">
            Vista previa {euro.format(preview.base + preview.vat)} · base {euro.format(preview.base)} · IVA {euro.format(preview.vat)}
          </p>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <div className="flex gap-2">
            <Button type="submit">Emitir</Button>
            <Button type="button" tone="ghost" onClick={() => void submit(false)}>Guardar borrador</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
