'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { euro, fecha, kindLabel, operationLabel } from '@/lib/format'
import { Card, PageTitle, Pill } from '@/components/shell'

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
  issued: { id: string; series: string | null; number: number | null; issueDate: string; status: string; total: number; operation: string }[]
  received: { id: string; number: string; date: string; status: string; total: number; operation: string }[]
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Detail>(`/contacts/${params.id}`).then(setData).catch((caught: Error) => setError(caught.message))
  }, [params.id])

  if (error) return <p className="text-clay">{error}</p>
  if (!data) return <p className="text-mist">Cargando contacto…</p>

  return (
    <div>
      <PageTitle title={data.name} text={`${kindLabel[data.kind]} · ${data.nif}${data.vatNumber ? ` · ${data.vatNumber}` : ''}`} />
      <Card className="mb-4 text-sm text-mist">
        <p>{data.address || 'Sin dirección'}</p>
        <p>{data.email || 'Sin correo'}</p>
        <p>{data.country}{data.isProfessional ? ' · profesional' : ''}</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-serif text-xl">Facturas emitidas</h2>
          {data.issued.length === 0 ? <p className="text-sm text-mist">No hay facturas emitidas a este contacto.</p> : data.issued.map((row) => (
            <Link key={row.id} href={`/facturas/${row.id}`} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0">
              <span>{fecha(row.issueDate)} · {operationLabel[row.operation]}</span>
              <span className="tabular">{euro.format(row.total)}</span>
            </Link>
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
