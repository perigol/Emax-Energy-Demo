'use client'

import { FormEvent, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { reason, useToast } from '@/lib/toast'
import { CountrySelect } from '@/lib/countries'
import { EditDeleteRowActions } from '@/components/list-row-actions'
import { Button, Card, ErrorNote, Field, control } from '@/components/shell'

export interface ContactListRow {
  id: string
  name: string
  nif: string
  country: string
  vatNumber: string | null
  kind: string
  email: string | null
  address: string | null
  isProfessional: boolean
  defaultIrpfRate: number | null
}

export function ContactRowActions({
  contact,
  onEdit,
  onDelete,
}: {
  contact: ContactListRow
  onEdit: () => void
  onDelete: () => void
}) {
  return <EditDeleteRowActions name={contact.name} onEdit={onEdit} onDelete={onDelete} />
}

export function EditContactModal({
  contact,
  onClose,
  onSuccess,
}: {
  contact: ContactListRow
  onClose: () => void
  onSuccess: (updated: ContactListRow) => void
}) {
  const [form, setForm] = useState({
    name: contact.name,
    nif: contact.nif,
    kind: contact.kind,
    country: contact.country,
    vatNumber: contact.vatNumber || '',
    email: contact.email || '',
    address: contact.address || '',
    isProfessional: contact.isProfessional,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setForm({
      name: contact.name,
      nif: contact.nif,
      kind: contact.kind,
      country: contact.country,
      vatNumber: contact.vatNumber || '',
      email: contact.email || '',
      address: contact.address || '',
      isProfessional: contact.isProfessional,
    })
    setError('')
  }, [contact])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = await api<ContactListRow & { vies?: { status: string } | null }>(`/contacts/${contact.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          vatNumber: form.vatNumber || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          defaultIrpfRate: form.isProfessional ? contact.defaultIrpfRate ?? 15 : undefined,
        }),
      })
      toast(saved.vies?.status === 'valid'
        ? 'Contacto actualizado. VIES confirma el NIF-IVA.'
        : saved.vies?.status === 'unavailable'
          ? 'Contacto actualizado. VIES no ha respondido.'
          : 'Contacto actualizado')
      onSuccess(saved)
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
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <Card>
          <h2 className="font-serif text-xl text-pine">Editar contacto</h2>
          <p className="mt-1 text-sm text-mist">{contact.name}</p>
          <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Nombre" required><input className={control} required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="NIF" required><input className={control} required minLength={3} maxLength={20} value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></Field>
            <Field label="Relación" required>
              <select className={control} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="CLIENT">Cliente</option>
                <option value="SUPPLIER">Proveedor</option>
                <option value="BOTH">Las dos cosas</option>
              </select>
            </Field>
            <Field label="País"><CountrySelect value={form.country} onChange={(country) => setForm({ ...form, country })} /></Field>
            <Field label="NIF-IVA"><input className={control} maxLength={20} value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} /></Field>
            <Field label="Correo"><input className={control} type="email" maxLength={160} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <div className="md:col-span-2">
              <Field label="Dirección"><input className={control} maxLength={200} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            </div>
            <label className="flex items-end gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={form.isProfessional} onChange={(e) => setForm({ ...form, isProfessional: e.target.checked })} />
              Profesional, retención 15 %
            </label>
            {error ? <div className="md:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
              <Button type="button" tone="ghost" onClick={onClose}>Cancelar</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
