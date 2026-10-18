'use client'

import { FormEvent, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { reason, useToast } from '@/lib/toast'
import { Button, Card, ErrorNote, Field, PageTitle, control } from '@/components/shell'

interface Settings {
  legalName: string
  nif: string
  fiscalAddress: string
  invoiceSeries: string
  roiRegistered: boolean
  vatRegime: string
  nextNumber: number
  hasLogo: boolean
}

interface Service { id: string; name: string; unitPrice: number; vatRate: number }

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [error, setError] = useState('')
  const toast = useToast()
  const [logo, setLogo] = useState('')

  function load() {
    api<Settings>('/settings').then(async (data) => {
      setSettings(data)
      if (data.hasLogo) {
        const blob = await api<Blob>('/settings/logo')
        setLogo(URL.createObjectURL(blob))
      }
    })
    api<Service[]>('/services').then(setServices)
  }
  useEffect(load, [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settings) return
    setError('')
    try {
      await api('/settings', { method: 'PATCH', body: JSON.stringify(settings) })
      toast('Datos fiscales guardados')
      load()
    } catch (caught) {
      const message = reason(caught, 'No se pudo guardar')
      setError(message)
      toast(message, 'bad')
    }
  }

  async function uploadLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api('/settings/logo', { method: 'POST', body: form })
      toast('Logo guardado')
      load()
    } catch (caught) {
      toast(reason(caught, 'No se pudo subir el logo'), 'bad')
    }
  }

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api('/services', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          unitPrice: Number(form.get('unitPrice')),
          vatRate: Number(form.get('vatRate')),
        }),
      })
      event.currentTarget.reset()
      toast('Servicio añadido')
      load()
    } catch (caught) {
      toast(reason(caught, 'No se pudo añadir el servicio'), 'bad')
    }
  }

  if (!settings) return <p className="text-mist">Cargando configuración…</p>

  return (
    <div className="space-y-4">
      <PageTitle title="Configuración" text={`Régimen ${settings.vatRegime}. El próximo número de factura es ${settings.nextNumber}.`} />
      <Card>
        <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
          <Field label="Razón social" required><input className={control} required minLength={2} maxLength={160} value={settings.legalName} onChange={(e) => setSettings({ ...settings, legalName: e.target.value })} /></Field>
          <Field label="NIF" required hint="Por ejemplo B66521089."><input className={control} required minLength={3} maxLength={20} value={settings.nif} onChange={(e) => setSettings({ ...settings, nif: e.target.value })} /></Field>
          <Field label="Domicilio fiscal" required><input className={control} required minLength={4} maxLength={200} value={settings.fiscalAddress} onChange={(e) => setSettings({ ...settings, fiscalAddress: e.target.value })} /></Field>
          <Field label="Serie" required hint="Por ejemplo NL."><input className={control} required maxLength={8} value={settings.invoiceSeries} onChange={(e) => setSettings({ ...settings, invoiceSeries: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.roiRegistered} onChange={(e) => setSettings({ ...settings, roiRegistered: e.target.checked })} />
            Inscrita en el ROI, para el 349
          </label>
          {error ? <div className="md:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
          <div><Button type="submit">Guardar datos fiscales</Button></div>
        </form>
      </Card>
      <Card>
        <h2 className="font-serif text-xl">Logo</h2>
        {logo ? <img src={logo} alt="Logo de la empresa" className="mt-3 h-16 object-contain" /> : <p className="mt-2 text-sm text-mist">Todavía no hay logo.</p>}
        <p className="mt-1 text-sm text-mist">PNG o JPG, hasta 1 MB. Sale en el PDF de la factura y en el de la liquidación.</p>
        <form onSubmit={uploadLogo} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="file" name="file" accept="image/png,image/jpeg" required />
          <Button type="submit" tone="ghost">Subir logo</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-serif text-xl">Servicios</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {services.map((service) => (
            <li key={service.id} className="flex justify-between py-2">
              <span>{service.name}</span>
              <span className="tabular">{service.unitPrice.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} · {service.vatRate} %</span>
            </li>
          ))}
        </ul>
        <form onSubmit={addService} className="mt-4 grid gap-2 md:grid-cols-[1fr_120px_100px_auto]">
          <input className={control} name="name" placeholder="Nombre" required minLength={2} maxLength={120} />
          <input className={control} name="unitPrice" type="number" min="0" max="9999999999.99" step="0.01" placeholder="Precio" required />
          <select className={control} name="vatRate" defaultValue="21">{[0, 4, 10, 21].map((rate) => <option key={rate}>{rate}</option>)}</select>
          <Button type="submit" tone="ghost">Añadir</Button>
        </form>
      </Card>
    </div>
  )
}
