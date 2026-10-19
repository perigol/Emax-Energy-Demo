'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { euro, fecha, statusLabel } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { useSession } from '@/lib/session'
import { Listing } from '@/components/listing'
import {
  EditReceivedModal,
  PayReceivedModal,
  ReceivedRowActions,
  type ReceivedListRow,
  openReceivedFile,
} from '@/components/received-list-tools'
import { Button, Empty, PageTitle, Pill } from '@/components/shell'

export default function ReceivedListPage() {
  const { user } = useSession()
  const [rows, setRows] = useState<ReceivedListRow[]>([])
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<ReceivedListRow | null>(null)
  const [pay, setPay] = useState<ReceivedListRow | null>(null)
  const toast = useToast()
  const canDelete = user?.role !== 'FACTURAS'

  useEffect(() => {
    api<ReceivedListRow[]>('/received-invoices').then(setRows).catch((caught: Error) => setError(caught.message))
  }, [])

  function mergeRow(updated: ReceivedListRow) {
    setRows((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)))
  }

  async function fileRow(row: ReceivedListRow) {
    try {
      await openReceivedFile(row.id)
    } catch (caught) {
      toast(reason(caught, 'No se pudo abrir el adjunto'), 'bad')
    }
  }

  async function removeRow(row: ReceivedListRow) {
    const ok = window.confirm(`¿Eliminar la factura ${row.number} de ${row.supplier.name}?`)
    if (!ok) return
    try {
      await api(`/received-invoices/${row.id}`, { method: 'DELETE' })
      setRows((current) => current.filter((item) => item.id !== row.id))
      toast('Factura eliminada')
    } catch (caught) {
      toast(reason(caught, 'No se pudo eliminar'), 'bad')
    }
  }

  return (
    <div>
      <PageTitle
        title="Facturas recibidas"
        text="Lo que pagas a proveedores. Si el proveedor es profesional, la retención entra en el 111."
        action={<Link href="/recibidas/nueva"><Button>Subir factura</Button></Link>}
      />
      {error ? <p className="text-clay">{error}</p> : null}
      {rows.length === 0 ? <Empty title="No hay facturas recibidas" text="Sube la factura del proveedor para que entre en el trimestre." /> : (
        <Listing
          rows={rows}
          rowKey={(row) => row.id}
          placeholder="Buscar por número, proveedor o estado"
          haystack={(row) => [row.number, row.supplier.name, row.concept, fecha(row.date), statusLabel[shown(row)], euro.format(row.total)].join(' ')}
          columns={[
            {
              key: 'number',
              label: 'Número',
              value: (row) => row.number,
              cell: (row) => row.number,
            },
            { key: 'supplier', label: 'Proveedor', value: (row) => row.supplier.name, cell: (row) => row.supplier.name },
            { key: 'date', label: 'Fecha', value: (row) => row.date, first: 'desc', cell: (row) => fecha(row.date) },
            { key: 'status', label: 'Estado', value: (row) => statusLabel[shown(row)] || shown(row), cell: (row) => <Pill status={shown(row)} /> },
            { key: 'total', label: 'Total', align: 'right', value: (row) => row.total, first: 'desc', cell: (row) => euro.format(row.total) },
            {
              key: 'actions',
              label: 'Acciones',
              sortable: false,
              cell: (row) => (
                <ReceivedRowActions
                  invoice={row}
                  canDelete={canDelete}
                  onEdit={() => setEdit(row)}
                  onPay={() => setPay(row)}
                  onFile={() => void fileRow(row)}
                  onDelete={() => void removeRow(row)}
                />
              ),
            },
          ]}
        />
      )}
      {edit ? (
        <EditReceivedModal invoice={edit} onClose={() => setEdit(null)} onSuccess={mergeRow} />
      ) : null}
      {pay ? (
        <PayReceivedModal invoice={pay} onClose={() => setPay(null)} onSuccess={mergeRow} />
      ) : null}
    </div>
  )
}

function shown(row: ReceivedListRow) {
  return row.paidAmount > 0 && row.paidAmount < row.total ? 'PAGO_PARCIAL' : row.status
}
