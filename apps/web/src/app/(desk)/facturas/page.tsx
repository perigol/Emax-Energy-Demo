'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { euro, fecha, statusLabel } from '@/lib/format'
import { Listing } from '@/components/listing'
import { Button, Empty, PageTitle, Pill } from '@/components/shell'

interface Invoice {
  id: string
  code: string
  issueDate: string
  displayStatus: string
  total: number
  contact: { name: string }
}

export default function IssuedListPage() {
  const [rows, setRows] = useState<Invoice[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    api<Invoice[]>('/issued-invoices').then(setRows).catch((caught: Error) => setError(caught.message))
  }, [])

  return (
    <div>
      <PageTitle
        title="Facturas emitidas"
        text="Un borrador no entra en el trimestre. Al emitir se asigna el número de serie."
        action={<Link href="/facturas/nueva"><Button>Nueva factura</Button></Link>}
      />
      {error ? <p className="text-clay">{error}</p> : null}
      {rows.length === 0 ? <Empty title="No hay facturas emitidas" text="Crea la primera desde un contacto y un servicio." /> : (
        <Listing
          rows={rows}
          rowKey={(row) => row.id}
          placeholder="Buscar por número, cliente o estado"
          haystack={(row) => [row.code, row.contact.name, fecha(row.issueDate), statusLabel[row.displayStatus], euro.format(row.total)].join(' ')}
          columns={[
            { key: 'code', label: 'Número', value: (row) => row.code, cell: (row) => <Link className="whitespace-nowrap font-medium" href={`/facturas/${row.id}`}>{row.code}</Link> },
            { key: 'client', label: 'Cliente', value: (row) => row.contact.name, cell: (row) => row.contact.name },
            { key: 'date', label: 'Fecha', value: (row) => row.issueDate, first: 'desc', cell: (row) => fecha(row.issueDate) },
            { key: 'status', label: 'Estado', value: (row) => statusLabel[row.displayStatus] || row.displayStatus, cell: (row) => <Pill status={row.displayStatus} /> },
            { key: 'total', label: 'Total', align: 'right', value: (row) => row.total, first: 'desc', cell: (row) => euro.format(row.total) },
          ]}
        />
      )}
    </div>
  )
}
