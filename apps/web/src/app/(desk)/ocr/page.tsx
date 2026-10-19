'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { todayIso } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { useSession } from '@/lib/session'
import { Button, Card, ErrorNote, Field, PageTitle, control } from '@/components/shell'

interface Contact { id: string; name: string; nif: string; kind: string }
interface Scan {
  number: string | null
  date: string | null
  concept: string | null
  base: number | null
  vatRate: number | null
  supplierName: string | null
  supplierNif: string | null
  note: string
}

export default function OcrPage() {
  const router = useRouter()
  const { user } = useSession()
  const canPick = user?.role !== 'FACTURAS'
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactId, setContactId] = useState('')
  const [newSupplier, setNewSupplier] = useState(false)
  const [supplierName, setSupplierName] = useState('')
  const [supplierNif, setSupplierNif] = useState('')
  const [number, setNumber] = useState('')
  const [date, setDate] = useState(todayIso)
  const [concept, setConcept] = useState('')
  const [base, setBase] = useState('')
  const [vatRate, setVatRate] = useState('21')
  const [file, setFile] = useState<File | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!canPick) return
    api<Contact[]>('/contacts')
      .then((rows) => {
        const suppliers = rows.filter((row) => row.kind !== 'CLIENT')
        setContacts(suppliers)
        setContactId(suppliers[0]?.id || '')
        setNewSupplier(suppliers.length === 0)
      })
      .catch(() => setContacts([]))
  }, [canPick])

  async function save(current: File, fields: { number: string; date: string; concept: string; base: string; vatRate: string; contactId: string; supplierName: string; supplierNif: string; known: boolean }) {
    const body = new FormData()
    body.set('file', current)
    body.set('number', fields.number)
    body.set('date', fields.date)
    body.set('concept', fields.concept || 'Factura recibida')
    body.set('base', fields.base)
    body.set('vatRate', fields.vatRate || '21')
    body.set('operation', 'NACIONAL')
    body.set('vatDeductible', 'true')
    if (fields.known && fields.contactId) body.set('contactId', fields.contactId)
    else {
      body.set('supplierName', fields.supplierName)
      body.set('supplierNif', fields.supplierNif)
    }
    await api('/received-invoices', { method: 'POST', body })
  }

  async function readFile(next: File | undefined) {
    if (!next) return
    setFile(next)
    setReading(true)
    setError('')
    const body = new FormData()
    body.set('file', next)
    try {
      const scanned = await api<Scan>('/received-invoices/scan', { method: 'POST', body })
      const nif = (scanned.supplierNif || '').replace(/\s/g, '').toUpperCase()
      const known = nif ? contacts.find((row) => row.nif.replace(/\s/g, '').toUpperCase() === nif) : undefined
      if (scanned.number) setNumber(scanned.number)
      if (scanned.date) setDate(scanned.date)
      if (scanned.concept) setConcept(scanned.concept)
      if (scanned.base != null) setBase(String(scanned.base))
      if (scanned.vatRate != null) setVatRate(String(scanned.vatRate))
      if (known) {
        setNewSupplier(false)
        setContactId(known.id)
      } else if (scanned.supplierName || nif) {
        setNewSupplier(true)
        if (scanned.supplierName) setSupplierName(scanned.supplierName)
        if (nif) setSupplierNif(nif)
      }
      const gaps: string[] = []
      if (!scanned.number) gaps.push('número de factura')
      if (!scanned.date) gaps.push('fecha')
      if (scanned.base == null) gaps.push('base')
      if (!known && !(scanned.supplierName && nif)) gaps.push('proveedor y NIF')
      setMissing(gaps)
      if (gaps.length === 0 && scanned.number && scanned.date && scanned.base != null) {
        try {
          await save(next, {
            number: scanned.number,
            date: scanned.date,
            concept: scanned.concept || 'Factura recibida',
            base: String(scanned.base),
            vatRate: String(scanned.vatRate ?? 21),
            contactId: known?.id || '',
            supplierName: scanned.supplierName || '',
            supplierNif: nif,
            known: Boolean(known),
          })
          toast('Factura registrada. Revísala en el listado.')
          router.push('/recibidas')
          return
        } catch (caught) {
          const message = reason(caught, 'No se pudo registrar la factura')
          setError(message)
          toast(message, 'bad')
          return
        }
      }
      toast(gaps.length ? `Falta: ${gaps.join(', ')}` : scanned.note, gaps.length ? 'bad' : 'ok')
    } catch (caught) {
      toast(reason(caught, 'No se pudo leer el archivo'), 'bad')
    } finally {
      setReading(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setError('Adjunta el PDF o la foto de la factura')
      return
    }
    setError('')
    const known = canPick && !newSupplier && Boolean(contactId)
    try {
      await save(file, { number, date, concept, base, vatRate, contactId, supplierName, supplierNif, known })
      toast('Factura registrada. Revísala en el listado.')
      router.push('/recibidas')
    } catch (caught) {
      const message = reason(caught, 'No se pudo registrar la factura')
      setError(message)
      toast(message, 'bad')
    }
  }

  const showSupplier = !canPick || newSupplier || contacts.length === 0

  return (
    <div>
      <PageTitle
        title="Leer factura"
        text="Sube un PDF o una foto. Si se leen el número, la fecha, la base y un NIF válido, la factura queda registrada."
      />
      <Card>
        <form onSubmit={(event) => void submit(event)} className="grid gap-3 md:grid-cols-2">
          <Field label="Archivo" hint={reading ? 'Leyendo el archivo…' : 'PDF, JPG o PNG, hasta 2 MB.'}>
            <input className={control} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => void readFile(event.target.files?.[0])} />
          </Field>
          {canPick && contacts.length > 0 ? (
            <Field label="Proveedor" hint="Si no está en la lista, elige Nuevo proveedor.">
              <select
                className={control}
                value={newSupplier ? '__new__' : contactId}
                onChange={(event) => {
                  if (event.target.value === '__new__') {
                    setNewSupplier(true)
                    setContactId('')
                  } else {
                    setNewSupplier(false)
                    setContactId(event.target.value)
                  }
                }}
              >
                {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                <option value="__new__">Nuevo proveedor</option>
              </select>
            </Field>
          ) : null}
          {showSupplier ? (
            <>
              <Field label="Proveedor" required>
                <input className={control} required minLength={2} maxLength={120} value={supplierName} onChange={(event) => setSupplierName(event.target.value)} />
              </Field>
              <Field label="NIF" required hint="Si el dígito no cuadra, la factura no se guarda.">
                <input className={control} required minLength={3} maxLength={20} value={supplierNif} onChange={(event) => setSupplierNif(event.target.value)} />
              </Field>
            </>
          ) : null}
          <Field label="Número" required>
            <input className={control} required maxLength={40} value={number} onChange={(event) => setNumber(event.target.value)} />
          </Field>
          <Field label="Fecha" required>
            <input className={control} type="date" required min="1990-01-01" max="2100-12-31" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Concepto" required>
            <input className={control} required maxLength={240} value={concept} onChange={(event) => setConcept(event.target.value)} />
          </Field>
          <Field label="Base imponible" required hint="Importe antes de IVA.">
            <input className={control} type="number" min="0" step="0.01" required value={base} onChange={(event) => setBase(event.target.value)} />
          </Field>
          <Field label="IVA">
            <select className={control} value={vatRate} onChange={(event) => setVatRate(event.target.value)}>
              {[0, 4, 10, 21].map((rate) => <option key={rate}>{rate}</option>)}
            </select>
          </Field>
          {missing.length > 0 ? <div className="md:col-span-2"><ErrorNote>Falta: {missing.join(', ')}. Complétalo y guarda.</ErrorNote></div> : null}
          {error ? <div className="md:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
          <div><Button type="submit" disabled={reading}>{reading ? 'Leyendo…' : 'Registrar factura'}</Button></div>
        </form>
      </Card>
    </div>
  )
}
