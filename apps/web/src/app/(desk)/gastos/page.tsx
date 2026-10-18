'use client'

import { FormEvent, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { euro, fecha, statusLabel } from '@/lib/format'
import { Listing } from '@/components/listing'
import { reason, useToast } from '@/lib/toast'
import { Button, Card, Empty, ErrorNote, Field, PageTitle, Pill, control } from '@/components/shell'

interface Expense {
  id: string
  supplierName: string
  category: string
  date: string
  concept: string
  total: number
  status: string
  vatDeductible: boolean
  hasFile: boolean
}

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const toast = useToast()

  function load() {
    api<Expense[]>('/expenses').then(setRows).catch((caught: Error) => setError(caught.message))
  }
  useEffect(load, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      await api('/expenses', { method: 'POST', body: new FormData(event.currentTarget) })
      setOpen(false)
      toast('Gasto guardado')
      load()
    } catch (caught) {
      const message = reason(caught, 'No se pudo guardar el gasto')
      setError(message)
      toast(message, 'bad')
    }
  }

  return (
    <div>
      <PageTitle
        title="Gastos"
        text="Un gasto no deducible, como una comida, se guarda pero no entra en el 303."
        action={<Button onClick={() => setOpen((value) => !value)}>{open ? 'Cerrar' : 'Nuevo gasto'}</Button>}
      />
      {open ? (
        <Card className="mb-4">
          <h2 className="mb-4 font-serif text-xl text-pine">Nuevo gasto</h2>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
            <Field label="Proveedor" required><input className={control} name="supplierName" required minLength={2} maxLength={120} /></Field>
            <Field label="Categoría" required><input className={control} name="category" required maxLength={80} defaultValue="Restauración" /></Field>
            <Field label="Concepto" required><input className={control} name="concept" required maxLength={240} /></Field>
            <Field label="Fecha" required><input className={control} type="date" name="date" required min="1990-01-01" max="2100-12-31" defaultValue="2026-03-18" /></Field>
            <Field label="Base" required><input className={control} name="base" type="number" min="0" max="9999999999.99" step="0.01" required /></Field>
            <Field label="IVA">
              <select className={control} name="vatRate" defaultValue="10">{[0, 4, 10, 21].map((rate) => <option key={rate}>{rate}</option>)}</select>
            </Field>
            <input type="hidden" name="operation" value="NACIONAL" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="vatDeductible" value="true" /> IVA deducible
            </label>
            <Field label="Archivo"><input className={control} type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" /></Field>
            {error ? <div className="md:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
            <div><Button type="submit">Guardar gasto</Button></div>
          </form>
        </Card>
      ) : null}
      {rows.length === 0 ? <Empty title="No hay gastos" text="Registra un ticket para dejar constancia, aunque el IVA no sea deducible." /> : (
        <Listing
          rows={rows}
          rowKey={(row) => row.id}
          placeholder="Buscar por concepto, categoría o proveedor"
          haystack={(row) => [row.concept, row.supplierName, row.category, fecha(row.date), statusLabel[row.status], row.vatDeductible ? '' : 'no deducible', euro.format(row.total)].join(' ')}
          columns={[
            { key: 'date', label: 'Fecha', value: (row) => row.date, first: 'desc', cell: (row) => fecha(row.date) },
            {
              key: 'concept',
              label: 'Concepto',
              value: (row) => row.concept,
              cell: (row) => <>{row.concept}<span className="block text-mist">{row.supplierName}{row.vatDeductible ? '' : ' · IVA no deducible'}</span></>,
            },
            { key: 'category', label: 'Categoría', value: (row) => row.category, cell: (row) => row.category },
            { key: 'status', label: 'Estado', value: (row) => statusLabel[row.status] || row.status, cell: (row) => <Pill status={row.status} /> },
            { key: 'total', label: 'Total', align: 'right', value: (row) => row.total, first: 'desc', cell: (row) => euro.format(row.total) },
          ]}
        />
      )}
    </div>
  )
}
