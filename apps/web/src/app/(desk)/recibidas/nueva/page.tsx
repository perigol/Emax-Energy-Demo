'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { operationLabel, todayIso } from '@/lib/format'
import { CountrySelect } from '@/lib/countries'
import { reason, useToast } from '@/lib/toast'
import { Button, Card, ErrorNote, Field, PageTitle, control } from '@/components/shell'
import { useSession } from '@/lib/session'

interface Contact { id: string; name: string; nif: string; kind: string }

export default function NewReceivedPage() {
  const router = useRouter()
  const { user } = useSession()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactId, setContactId] = useState('')
  const [newSupplier, setNewSupplier] = useState(false)
  const [supplierName, setSupplierName] = useState('')
  const [supplierNif, setSupplierNif] = useState('')
  const [error, setError] = useState('')
  const [number, setNumber] = useState('')
  const [date, setDate] = useState(todayIso)
  const [concept, setConcept] = useState('')
  const [base, setBase] = useState('')
  const [vatRate, setVatRate] = useState('21')
  const [operation, setOperation] = useState('NACIONAL')
  const [services, setServices] = useState<{ name: string }[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [reading, setReading] = useState(false)
  const toast = useToast()
  const canPick = user?.role !== 'FACTURAS'

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
    api<{ name: string }[]>('/services').then(setServices).catch(() => setServices([]))
  }, [canPick])

  async function readFile(file: File | undefined) {
    if (!file) return
    setReading(true)
    const body = new FormData()
    body.set('file', file)
    try {
      const scanned = await api<{
        number: string | null
        date: string | null
        concept: string | null
        base: number | null
        vatRate: number | null
        supplierName: string | null
        supplierNif: string | null
        note: string
      }>('/received-invoices/scan', { method: 'POST', body })
      if (scanned.number) setNumber(scanned.number)
      if (scanned.date) setDate(scanned.date)
      const catalog = scanned.concept
        ? services.find((item) => item.name.length >= 4 && scanned.concept!.toLowerCase().includes(item.name.toLowerCase()))
        : undefined
      const conceptText = catalog?.name || scanned.concept || ''
      if (conceptText) setConcept(conceptText)
      if (scanned.base != null) setBase(String(scanned.base))
      if (scanned.vatRate != null) setVatRate(String(scanned.vatRate))
      const nif = (scanned.supplierNif || '').replace(/\s/g, '').toUpperCase()
      const known = nif ? contacts.find((row) => row.nif.replace(/\s/g, '').toUpperCase() === nif) : undefined
      if (known) {
        setNewSupplier(false)
        setContactId(known.id)
      } else if (canPick && (scanned.supplierName || nif)) {
        setNewSupplier(true)
        setContactId('')
        if (scanned.supplierName) setSupplierName(scanned.supplierName)
        if (nif) setSupplierNif(nif)
      } else if (!canPick) {
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
        const save = new FormData()
        save.set('file', file)
        save.set('number', scanned.number)
        save.set('date', scanned.date)
        save.set('concept', conceptText || 'Factura recibida')
        save.set('base', String(scanned.base))
        save.set('vatRate', String(scanned.vatRate ?? 21))
        save.set('operation', 'NACIONAL')
        save.set('vatDeductible', 'true')
        if (known) save.set('contactId', known.id)
        else {
          save.set('supplierName', scanned.supplierName || '')
          save.set('supplierNif', nif)
        }
        try {
          await api('/received-invoices', { method: 'POST', body: save })
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
      setError('')
      toast(gaps.length ? `Falta: ${gaps.join(', ')}` : scanned.note, gaps.length ? 'bad' : 'ok')
    } catch (caught) {
      toast(reason(caught, 'No se pudo leer el archivo'), 'bad')
    } finally {
      setReading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    if (canPick && !newSupplier && contactId) form.set('contactId', contactId)
    else form.delete('contactId')
    try {
      await api('/received-invoices', { method: 'POST', body: form })
      toast('Factura recibida guardada')
      router.push('/recibidas')
    } catch (caught) {
      const message = reason(caught, 'No se pudo subir la factura')
      setError(message)
      toast(message, 'bad')
    }
  }

  return (
    <div>
      <PageTitle
        backFallback="/recibidas"
        title="Subir factura recibida"
        text="PDF o imagen, hasta 2 MB. El IVA y la retención los calcula el servidor."
      />
      <Card>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
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
          {!canPick || newSupplier || contacts.length === 0 ? (
            <>
              <Field label="Proveedor" required>
                <input className={control} name="supplierName" required minLength={2} maxLength={120} value={supplierName} onChange={(event) => setSupplierName(event.target.value)} />
              </Field>
              <Field label="NIF" required hint="Por ejemplo B66521089 o 12345678Z.">
                <input className={control} name="supplierNif" required minLength={3} maxLength={20} value={supplierNif} onChange={(event) => setSupplierNif(event.target.value)} />
              </Field>
              <Field label="País"><CountrySelect name="country" /></Field>
              {operation !== 'NACIONAL' ? (
                <Field label="NIF-IVA" hint="Identificador europeo, solo si la factura lo trae. Al guardar se comprueba en VIES.">
                  <input className={control} name="vatNumber" maxLength={20} />
                </Field>
              ) : null}
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" name="isProfessional" value="true" /> Es un autónomo: se le retiene un 15 %
              </label>
            </>
          ) : null}
          <Field label="Número" required><input className={control} name="number" required maxLength={40} value={number} onChange={(event) => setNumber(event.target.value)} /></Field>
          <Field label="Fecha" required><input className={control} type="date" name="date" required min="1990-01-01" max="2100-12-31" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label="Concepto" required><input className={control} name="concept" required maxLength={240} value={concept} onChange={(event) => setConcept(event.target.value)} /></Field>
          <Field label="Base imponible" required hint="Importe antes de IVA. El total lo calcula el servidor.">
            <input className={control} name="base" type="number" min="0" max="9999999999.99" step="0.01" required value={base} onChange={(event) => setBase(event.target.value)} />
          </Field>
          <Field label="IVA">
            <select className={control} name="vatRate" value={vatRate} onChange={(event) => setVatRate(event.target.value)}>{[0, 4, 10, 21].map((rate) => <option key={rate}>{rate}</option>)}</select>
          </Field>
          <Field label="Operación" hint="En España se aplica el IVA. Dentro de la UE, el IVA suele ser cero.">
            <select className={control} name="operation" value={operation} onChange={(event) => setOperation(event.target.value)}>
              {Object.entries(operationLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="vatDeductible" value="true" defaultChecked /> IVA deducible
          </label>
          <Field label="Archivo" hint={reading ? 'Leyendo el archivo…' : 'PDF, JPG o PNG. Los datos leídos se pueden corregir antes de guardar.'}>
            <input className={control} type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => void readFile(event.target.files?.[0])} />
          </Field>
          {missing.length > 0 ? <div className="md:col-span-2"><ErrorNote>Falta: {missing.join(', ')}.</ErrorNote></div> : null}
          {error ? <div className="md:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
          <div><Button type="submit">Registrar factura</Button></div>
        </form>
      </Card>
    </div>
  )
}
