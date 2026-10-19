'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { euro, fecha, issuedDisplayStatus, statusLabel } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { Listing } from '@/components/listing'
import {
  CollectInvoiceModal,
  InvoiceRowActions,
  type IssuedListInvoice,
  openIssuedPdf,
} from '@/components/issued-invoice-list-tools'
import { Button, Empty, PageTitle, Pill } from '@/components/shell'

export default function IssuedListPage() {
  const [rows, setRows] = useState<IssuedListInvoice[]>([])
  const [error, setError] = useState('')
  const [collect, setCollect] = useState<IssuedListInvoice | null>(null)
  const toast = useToast()

  useEffect(() => {
    api<IssuedListInvoice[]>('/issued-invoices').then(setRows).catch((caught: Error) => setError(caught.message))
  }, [])

  function mergeRow(updated: IssuedListInvoice) {
    setRows((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)))
  }

  async function pdfRow(row: IssuedListInvoice) {
    try {
      await openIssuedPdf(row.id)
    } catch (caught) {
      toast(reason(caught, 'No se pudo abrir el PDF'), 'bad')
    }
  }

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
          haystack={(row) => {
            const shown = issuedDisplayStatus(row)
            return [row.code, row.contact.name, fecha(row.issueDate), statusLabel[shown], euro.format(row.total)].join(' ')
          }}
          columns={[
            {
              key: 'code',
              label: 'Número',
              value: (row) => row.code,
              cell: (row) => (
                <Link className="whitespace-nowrap font-medium" href={`/facturas/${row.id}`}>
                  {row.code}
                  {row.rectifiesId ? <span className="ml-1.5 text-xs font-normal text-mist">Rect.</span> : null}
                </Link>
              ),
            },
            { key: 'client', label: 'Cliente', value: (row) => row.contact.name, cell: (row) => row.contact.name },
            { key: 'date', label: 'Fecha', value: (row) => row.issueDate, first: 'desc', cell: (row) => fecha(row.issueDate) },
            {
              key: 'status',
              label: 'Estado',
              value: (row) => statusLabel[issuedDisplayStatus(row)] || issuedDisplayStatus(row),
              cell: (row) => <Pill status={issuedDisplayStatus(row)} />,
            },
            { key: 'total', label: 'Total', align: 'right', value: (row) => row.total, first: 'desc', cell: (row) => euro.format(row.total) },
            {
              key: 'actions',
              label: 'Acciones',
              sortable: false,
              cell: (row) => (
                <InvoiceRowActions
                  invoice={row}
                  onCollect={() => setCollect(row)}
                  onPdf={() => void pdfRow(row)}
                />
              ),
            },
          ]}
        />
      )}
      {collect ? (
        <CollectInvoiceModal
          invoice={collect}
          onClose={() => setCollect(null)}
          onSuccess={mergeRow}
        />
      ) : null}
    </div>
  )
}
