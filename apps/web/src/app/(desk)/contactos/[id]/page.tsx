'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { euro, fecha, issuedDisplayStatus, kindLabel, operationLabel } from '@/lib/format'
import { BackButton, Card, PageTitle, Pill, RowViewLink } from '@/components/shell'

interface Detail {
  id: string
  name: string
  nif: string
  country: string
  vatNumber: string | null
  kind: string
  email: string | null
  address: string | null
  isProfessional: boolean
  issued: {
    id: string
    code: string
    issueDate: string
    displayStatus: string
    status: string
    rectifiesId: string | null
    hasRectificativa?: boolean
    total: number
    operation: string
  }[]
  received: { id: string; number: string; date: string; status: string; total: number; operation: string }[]
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Detail>(`/contacts/${params.id}`).then(setData).catch((caught: Error) => setError(caught.message))
  }, [params.id])

  if (error) {
    return (
      <div>
        <BackButton fallback="/contactos" />
        <p className="text-clay">{error}</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div>
        <BackButton fallback="/contactos" />
        <p className="text-mist">Cargando contacto…</p>
      </div>
    )
  }

  return (
    <div>
      <PageTitle
        backFallback="/contactos"
        title={data.name}
        text={`${kindLabel[data.kind]} · ${data.nif}${data.vatNumber ? ` · ${data.vatNumber}` : ''}`}
      />
      <Card className="mb-4 text-sm text-mist">
        <p>{data.address || 'Sin dirección'}</p>
        <p>{data.email || 'Sin correo'}</p>
        <p>{data.country}{data.isProfessional ? ' · profesional' : ''}</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-serif text-xl">Facturas emitidas</h2>
          {data.issued.length === 0 ? <p className="text-sm text-mist">No hay facturas emitidas a este contacto.</p> : data.issued.map((row) => (
            <div key={row.id} className="flex items-center gap-2 border-b border-line py-2 text-sm last:border-0">
              <Link href={`/facturas/${row.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="font-medium text-pine">{row.code}</span>
                  <span className="text-mist"> · {fecha(row.issueDate)} · {operationLabel[row.operation]}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Pill status={issuedDisplayStatus(row)} />
                  <span className="tabular">{euro.format(row.total)}</span>
                </span>
              </Link>
              <RowViewLink href={`/facturas/${row.id}`} label={`Ver factura ${row.code}`} />
            </div>
          ))}
        </Card>
        <Card>
          <h2 className="mb-3 font-serif text-xl">Facturas recibidas</h2>
          {data.received.length === 0 ? <p className="text-sm text-mist">No hay facturas de este proveedor.</p> : data.received.map((row) => (
            <div key={row.id} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0">
              <span>{row.number} · {fecha(row.date)}</span>
              <span className="flex items-center gap-2"><Pill status={row.status} /><span className="tabular">{euro.format(row.total)}</span></span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
