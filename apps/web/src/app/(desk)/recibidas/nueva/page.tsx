'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { operationLabel } from '@/lib/format'
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
  const [error, setError] = useState('')
  const toast = useToast()
  const canPick = user?.role !== 'FACTURAS'

  useEffect(() => {
    if (!canPick) return
    api<Contact[]>('/contacts')
      .then((rows) => {
        const suppliers = rows.filter((row) => row.kind !== 'CLIENT')
        setContacts(suppliers)
        setContactId(suppliers[0]?.id || '')
      })
      .catch(() => setContacts([]))
  }, [canPick])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    if (canPick && contactId) form.set('contactId', contactId)
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
      <PageTitle title="Subir factura recibida" text="PDF o imagen, hasta 2 MB. El IVA y la retención los calcula el servidor." />
      <Card>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          {canPick && contacts.length > 0 ? (
            <Field label="Proveedor ya dado de alta">
              <select className={control} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
              </select>
            </Field>
          ) : null}
          {!canPick || contacts.length === 0 ? (
            <>
              <Field label="Proveedor" required><input className={control} name="supplierName" required minLength={2} maxLength={120} /></Field>
              <Field label="NIF" required hint="Por ejemplo B66521089 o 12345678Z."><input className={control} name="supplierNif" required minLength={3} maxLength={20} /></Field>
              <Field label="País"><CountrySelect name="country" /></Field>
              <Field label="NIF-IVA" hint="Por ejemplo FR40303265045. Al guardar se comprueba en VIES."><input className={control} name="vatNumber" maxLength={20} /></Field>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" name="isProfessional" value="true" /> Profesional, retención del 15 %
              </label>
            </>
          ) : null}
          <Field label="Número" required><input className={control} name="number" required maxLength={40} /></Field>
          <Field label="Fecha" required><input className={control} type="date" name="date" required min="1990-01-01" max="2100-12-31" defaultValue="2026-02-15" /></Field>
          <Field label="Concepto" required><input className={control} name="concept" required maxLength={240} /></Field>
          <Field label="Base" required><input className={control} name="base" type="number" min="0" max="9999999999.99" step="0.01" required /></Field>
          <Field label="IVA">
            <select className={control} name="vatRate" defaultValue="21">{[0, 4, 10, 21].map((rate) => <option key={rate}>{rate}</option>)}</select>
          </Field>
          <Field label="Operación">
            <select className={control} name="operation" defaultValue="NACIONAL">
              {Object.entries(operationLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="vatDeductible" value="true" defaultChecked /> IVA deducible
          </label>
          <Field label="Archivo"><input className={control} type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" /></Field>
          {error ? <div className="md:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
          <div><Button type="submit">Registrar factura</Button></div>
        </form>
      </Card>
    </div>
  )
}
