'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { euro, fecha, statusLabel } from '@/lib/format'
import { Listing } from '@/components/listing'
import { Button, Empty, PageTitle, Pill, RowViewLink } from '@/components/shell'

interface Quote {
  id: string
  code: string
  date: string
  status: string
  total: number
  contact: { name: string }
}

export default function QuotesPage() {
  const [rows, setRows] = useState<Quote[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<Quote[]>('/quotes').then(setRows).catch((caught: Error) => setError(caught.message))
  }, [])

  return (
    <div>
      <PageTitle
        title="Presupuestos"
        text="Un presupuesto no entra en el IVA. Cuando el cliente lo acepta, se convierte en factura."
        action={<Link href="/presupuestos/nuevo"><Button>Nuevo presupuesto</Button></Link>}
      />
      {error ? <p className="text-clay">{error}</p> : null}
      {rows.length === 0 ? (
        <Empty title="No hay presupuestos" text="Crea uno con un cliente y unas líneas. Luego puedes convertirlo en factura." />
      ) : (
        <Listing
          rows={rows}
          rowKey={(row) => row.id}
          placeholder="Buscar por número, cliente o estado"
          haystack={(row) => [row.code, row.contact.name, fecha(row.date), statusLabel[row.status], euro.format(row.total)].join(' ')}
          columns={[
            { key: 'code', label: 'Número', value: (row) => row.code, cell: (row) => row.code },
            { key: 'contact', label: 'Cliente', value: (row) => row.contact.name, cell: (row) => row.contact.name },
            { key: 'date', label: 'Fecha', value: (row) => row.date, first: 'desc', cell: (row) => fecha(row.date) },
            { key: 'status', label: 'Estado', value: (row) => statusLabel[row.status] || row.status, cell: (row) => <Pill status={row.status} /> },
            { key: 'total', label: 'Total', align: 'right', value: (row) => row.total, first: 'desc', cell: (row) => euro.format(row.total) },
            {
              key: 'actions',
              label: 'Acciones',
              sortable: false,
              cell: (row) => <RowViewLink href={`/presupuestos/${row.id}`} label={`Ver presupuesto ${row.code}`} />,
            },
          ]}
        />
      )}
    </div>
  )
}
