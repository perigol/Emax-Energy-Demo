'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { euro, fecha, statusLabel } from '@/lib/format'
import { Listing } from '@/components/listing'
import { Button, Empty, PageTitle, Pill } from '@/components/shell'

interface Row {
  id: string
  number: string
  date: string
  concept: string
  total: number
  paidAmount: number
  status: string
  hasFile: boolean
  supplier: { name: string }
}

export default function ReceivedListPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    api<Row[]>('/received-invoices').then(setRows).catch((caught: Error) => setError(caught.message))
  }, [])

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
              cell: (row) => (
                <>
                  {row.number}
                  {row.hasFile ? <button className="ml-2 text-moss" onClick={() => openFile(row.id)}>archivo</button> : null}
                </>
              ),
            },
            { key: 'supplier', label: 'Proveedor', value: (row) => row.supplier.name, cell: (row) => row.supplier.name },
            { key: 'date', label: 'Fecha', value: (row) => row.date, first: 'desc', cell: (row) => fecha(row.date) },
            { key: 'status', label: 'Estado', value: (row) => statusLabel[shown(row)] || shown(row), cell: (row) => <Pill status={shown(row)} /> },
            { key: 'total', label: 'Total', align: 'right', value: (row) => row.total, first: 'desc', cell: (row) => euro.format(row.total) },
          ]}
        />
      )}
    </div>
  )
}

function shown(row: Row) {
  return row.paidAmount > 0 && row.paidAmount < row.total ? 'PAGO_PARCIAL' : row.status
}

async function openFile(id: string) {
  const blob = await api<Blob>(`/received-invoices/${id}/file`)
  window.open(URL.createObjectURL(blob), '_blank')
}
