'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { kindLabel } from '@/lib/format'
import { Listing } from '@/components/listing'
import { CountrySelect } from '@/lib/countries'
import { reason, useToast } from '@/lib/toast'
import {
  ContactRowActions,
  EditContactModal,
  type ContactListRow,
} from '@/components/contact-list-tools'
import { Button, Card, Empty, ErrorNote, Field, PageTitle, control } from '@/components/shell'

const empty = {
  name: '',
  nif: '',
  kind: 'CLIENT',
  country: 'ES',
  vatNumber: '',
  email: '',
  address: '',
  isProfessional: false,
}

export default function ContactsPage() {
  const [rows, setRows] = useState<ContactListRow[]>([])
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<ContactListRow | null>(null)
  const toast = useToast()

  function load() {
    api<ContactListRow[]>('/contacts').then(setRows).catch((caught: Error) => setError(caught.message))
  }
  useEffect(load, [])

  function mergeRow(updated: ContactListRow) {
    setRows((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)))
  }

  async function removeRow(row: ContactListRow) {
    const ok = window.confirm(`¿Eliminar a ${row.name}? Solo se puede si no tiene facturas.`)
    if (!ok) return
    try {
      await api(`/contacts/${row.id}`, { method: 'DELETE' })
      setRows((current) => current.filter((item) => item.id !== row.id))
      toast('Contacto eliminado')
    } catch (caught) {
      toast(reason(caught, 'No se pudo eliminar'), 'bad')
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const saved = await api<{ vies: { status: 'valid' | 'unavailable' } | null }>('/contacts', { method: 'POST', body: JSON.stringify({ ...form, vatNumber: form.vatNumber || undefined, email: form.email || undefined, address: form.address || undefined, defaultIrpfRate: form.isProfessional ? 15 : undefined }) })
      setForm(empty)
      setOpen(false)
      toast(saved.vies?.status === 'valid'
        ? 'Contacto guardado. VIES confirma el NIF-IVA.'
        : saved.vies?.status === 'unavailable'
          ? 'Contacto guardado. VIES no ha respondido y el NIF-IVA queda sin comprobar.'
          : 'Contacto guardado')
      load()
    } catch (caught) {
      const message = reason(caught, 'No se pudo guardar')
      setError(message)
      toast(message, 'bad')
    }
  }

  return (
    <div>
      <PageTitle
        title="Contactos"
        text="Quien te paga y a quien le pagas. El NIF-IVA hace falta para el modelo 349."
        action={<Button onClick={() => setOpen((value) => !value)}>{open ? 'Cerrar' : 'Nuevo contacto'}</Button>}
      />
      {open ? (
        <Card className="mb-4">
          <h2 className="mb-4 font-serif text-xl text-pine">Nuevo contacto</h2>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre" required><input className={control} required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="NIF" required hint="Por ejemplo B66521089 o 12345678Z.">
              <input className={control} required minLength={3} maxLength={20} value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} />
            </Field>
            <Field label="Relación" required>
              <select className={control} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="CLIENT">Cliente</option>
                <option value="SUPPLIER">Proveedor</option>
                <option value="BOTH">Las dos cosas</option>
              </select>
            </Field>
            <Field label="País"><CountrySelect value={form.country} onChange={(country) => setForm({ ...form, country })} /></Field>
            <Field label="NIF-IVA" hint="Por ejemplo FR40303265045. Al guardar se comprueba en VIES."><input className={control} maxLength={20} value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} /></Field>
            <Field label="Correo"><input className={control} type="email" maxLength={160} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Dirección"><input className={control} maxLength={200} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <label className="flex items-end gap-2 text-sm">
              <input type="checkbox" checked={form.isProfessional} onChange={(e) => setForm({ ...form, isProfessional: e.target.checked })} />
              Profesional, retención 15 %
            </label>
            {error ? <div className="md:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
            <div><Button type="submit">Guardar contacto</Button></div>
          </form>
        </Card>
      ) : null}
      {rows.length === 0 ? <Empty title="Todavía no hay contactos" text="Crea el primero para poder emitir o registrar una factura." /> : (
        <Listing
          rows={rows}
          rowKey={(row) => row.id}
          placeholder="Buscar por nombre, NIF o país"
          haystack={(row) => [row.name, row.nif, row.vatNumber, kindLabel[row.kind], row.isProfessional ? 'profesional' : '', row.country].join(' ')}
          columns={[
            { key: 'name', label: 'Nombre', value: (row) => row.name, cell: (row) => <Link className="font-medium text-pine underline-offset-2 hover:underline" href={`/contactos/${row.id}`}>{row.name}</Link> },
            { key: 'nif', label: 'NIF', value: (row) => row.nif, cell: (row) => row.nif },
            { key: 'kind', label: 'Relación', value: (row) => `${kindLabel[row.kind]}${row.isProfessional ? ' profesional' : ''}`, cell: (row) => <>{kindLabel[row.kind]}{row.isProfessional ? ' · profesional' : ''}</> },
            { key: 'country', label: 'País', value: (row) => row.country, cell: (row) => row.country },
            {
              key: 'actions',
              label: 'Acciones',
              sortable: false,
              cell: (row) => (
                <ContactRowActions
                  contact={row}
                  onEdit={() => setEdit(row)}
                  onDelete={() => void removeRow(row)}
                />
              ),
            },
          ]}
        />
      )}
      {edit ? (
        <EditContactModal contact={edit} onClose={() => setEdit(null)} onSuccess={mergeRow} />
      ) : null}
    </div>
  )
}
