'use client'

import { FormEvent, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { euro, fecha, statusLabel, todayIso } from '@/lib/format'
import { ExpenseRowActions, PayExpenseModal, type ExpenseListRow, openExpenseFile } from '@/components/expense-list-tools'
import { Listing } from '@/components/listing'
import { reason, useToast } from '@/lib/toast'
import { useSession } from '@/lib/session'
import { Button, Card, Empty, ErrorNote, Field, PageTitle, Pill, control } from '@/components/shell'

type Expense = ExpenseListRow & {
  supplierName: string
  category: string
  date: string
  total: number
  status: string
  vatDeductible: boolean
}

export default function ExpensesPage() {
  const { user } = useSession()
  const [rows, setRows] = useState<Expense[]>([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [pay, setPay] = useState<Expense | null>(null)
  const canDelete = user?.role !== 'FACTURAS'
  const [supplierName, setSupplierName] = useState('')
  const [concept, setConcept] = useState('')
  const [date, setDate] = useState(todayIso)
  const [base, setBase] = useState('')
  const [vatRate, setVatRate] = useState('10')
  const [reading, setReading] = useState(false)
  const toast = useToast()

  function load() {
    api<Expense[]>('/expenses').then(setRows).catch((caught: Error) => setError(caught.message))
  }
  useEffect(load, [])

  async function readFile(file: File | undefined) {
    if (!file) return
    setReading(true)
    const body = new FormData()
    body.set('file', file)
    try {
      const scanned = await api<{ concept: string | null; date: string | null; base: number | null; vatRate: number | null; supplierName: string | null; note: string }>('/received-invoices/scan', { method: 'POST', body })
      if (scanned.concept) setConcept(scanned.concept)
      if (scanned.date) setDate(scanned.date)
      if (scanned.base != null) setBase(String(scanned.base))
      if (scanned.vatRate != null) setVatRate(String(scanned.vatRate))
      if (scanned.supplierName) setSupplierName(scanned.supplierName)
      if (scanned.supplierName && scanned.concept && scanned.date && scanned.base != null) {
        const save = new FormData()
        save.set('file', file)
        save.set('supplierName', scanned.supplierName)
        save.set('category', 'Varios')
        save.set('concept', scanned.concept)
        save.set('date', scanned.date)
        save.set('base', String(scanned.base))
        save.set('vatRate', String(scanned.vatRate ?? 21))
        save.set('operation', 'NACIONAL')
        try {
          await api('/expenses', { method: 'POST', body: save })
          toast('Gasto registrado. Revísalo en el listado.')
          setOpen(false)
          load()
          return
        } catch (caught) {
          toast(reason(caught, 'No se pudo registrar el gasto'), 'bad')
          return
        }
      }
      toast(scanned.note, scanned.concept && scanned.base != null ? 'ok' : 'bad')
    } catch (caught) {
      toast(reason(caught, 'No se pudo leer el archivo'), 'bad')
    } finally {
      setReading(false)
    }
  }

  function mergeRow(updated: ExpenseListRow) {
    setRows((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)))
  }

  async function removeRow(row: Expense) {
    const ok = window.confirm(`¿Eliminar el gasto «${row.concept}» de ${row.supplierName}?`)
    if (!ok) return
    try {
      await api(`/expenses/${row.id}`, { method: 'DELETE' })
      setRows((current) => current.filter((item) => item.id !== row.id))
      toast('Gasto eliminado')
    } catch (caught) {
      toast(reason(caught, 'No se pudo eliminar'), 'bad')
    }
  }

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
            <Field label="Proveedor" required><input className={control} name="supplierName" required minLength={2} maxLength={120} value={supplierName} onChange={(event) => setSupplierName(event.target.value)} /></Field>
            <Field label="Categoría" required><input className={control} name="category" required maxLength={80} defaultValue="Restauración" /></Field>
            <Field label="Concepto" required><input className={control} name="concept" required maxLength={240} value={concept} onChange={(event) => setConcept(event.target.value)} /></Field>
            <Field label="Fecha" required><input className={control} type="date" name="date" required min="1990-01-01" max="2100-12-31" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
            <Field label="Base imponible" required hint="Importe antes de IVA.">
              <input className={control} name="base" type="number" min="0" max="9999999999.99" step="0.01" required value={base} onChange={(event) => setBase(event.target.value)} />
            </Field>
            <Field label="IVA">
              <select className={control} name="vatRate" value={vatRate} onChange={(event) => setVatRate(event.target.value)}>{[0, 4, 10, 21].map((rate) => <option key={rate}>{rate}</option>)}</select>
            </Field>
            <input type="hidden" name="operation" value="NACIONAL" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="vatDeductible" value="true" /> IVA deducible
            </label>
            <Field label="Archivo" hint={reading ? 'Leyendo el archivo…' : 'PDF, JPG o PNG. Los datos leídos se pueden corregir.'}>
              <input className={control} type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => void readFile(event.target.files?.[0])} />
            </Field>
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
            {
              key: 'actions',
              label: 'Acciones',
              sortable: false,
              cell: (row) => (
                <ExpenseRowActions
                  expense={row}
                  canDelete={canDelete}
                  onPay={() => setPay(row)}
                  onFile={() => void openExpenseFile(row.id).catch((caught) => toast(reason(caught, 'No se pudo abrir el adjunto'), 'bad'))}
                  onDelete={() => void removeRow(row)}
                />
              ),
            },
          ]}
        />
      )}
      {pay ? <PayExpenseModal expense={pay} onClose={() => setPay(null)} onSuccess={mergeRow} /> : null}
    </div>
  )
}
