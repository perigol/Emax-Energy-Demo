'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { reason, useToast } from '@/lib/toast'
import { euro } from '@/lib/format'
import { Listing } from '@/components/listing'
import { Card, ErrorNote, PageTitle } from '@/components/shell'

const titles: Record<string, string> = {
  '303': 'Modelo 303',
  '111': 'Modelo 111',
  '349': 'Modelo 349',
}

export default function TaxModelRoute() {
  return (
    <Suspense fallback={<p className="text-mist">Cargando el modelo…</p>}>
      <TaxModelPage />
    </Suspense>
  )
}

function TaxModelPage() {
  const params = useParams<{ modelo: string }>()
  const search = useSearchParams()
  const modelo = params.modelo
  const [year, setYear] = useState(Number(search.get('year') || 2026))
  const [quarter, setQuarter] = useState(Number(search.get('quarter') || 1))
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const toast = useToast()

  useEffect(() => {
    setError('')
    api<Record<string, unknown>>(`/tax/${modelo}?year=${year}&quarter=${quarter}`)
      .then(setData)
      .catch((caught: unknown) => {
        const message = reason(caught, 'No se pudo calcular')
        setData(null)
        setError(message)
        toast(message, 'bad')
      })
  }, [modelo, year, quarter, toast])

  return (
    <div>
      <PageTitle
        title={titles[modelo] || 'Modelo'}
        text={`${quarter}T ${year}. Las cifras salen de los documentos de ese trimestre.`}
        action={
          <div className="flex gap-2">
            <select className="rounded-md border border-line bg-white px-3 py-2" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2025, 2026, 2027].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="rounded-md border border-line bg-white px-3 py-2" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
              {[1, 2, 3, 4].map((item) => <option key={item} value={item}>{item}T</option>)}
            </select>
          </div>
        }
      />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {data && modelo === '303' ? <Modelo303 data={data} /> : null}
      {data && modelo === '111' ? <Modelo111 data={data} /> : null}
      {data && modelo === '349' ? <Modelo349 data={data} /> : null}
    </div>
  )
}

function Modelo303({ data }: { data: Record<string, unknown> }) {
  const rows = (data.porTipo as { rate: number; base: number; cuota: number }[]) || []
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Metric label="IVA devengado" value={Number(data.devengado)} />
      <Metric label="IVA deducible" value={Number(data.deducible)} />
      <Metric label="Resultado" value={Number(data.resultado)} emphasis />
      <Card className="md:col-span-3">
        <h2 className="font-serif text-xl">Repercutido por tipo</h2>
        <table className="book mt-3">
          <tbody>
            {rows.map((row) => (
              <tr key={row.rate} className="border-b border-line">
                <td className="py-2">{row.rate} %</td>
                <td className="tabular py-2 text-right">{euro.format(row.base)}</td>
                <td className="tabular py-2 text-right">{euro.format(row.cuota)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-sm text-mist">
          Entregas intracomunitarias {euro.format(Number(data.entregasIntracomunitarias))} · Adquisiciones {euro.format(Number(data.adquisicionesIntracomunitarias))}
        </p>
      </Card>
    </div>
  )
}

function Modelo111({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Metric label="Perceptores" value={Number(data.perceptores)} money={false} />
      <Metric label="Base" value={Number(data.base)} />
      <Metric label="Retención" value={Number(data.retencion)} emphasis />
    </div>
  )
}

function Modelo349({ data }: { data: Record<string, unknown> }) {
  const lines = (data.lines as { vatId: string; name: string; clave: string; base: number }[]) || []
  if (lines.length === 0) {
    return <Card><p className="text-sm text-mist">No hay operaciones intracomunitarias en este trimestre.</p></Card>
  }
  return (
        <Listing
          rows={lines}
          rowKey={(line) => `${line.vatId}${line.clave}`}
          placeholder="Buscar por NIF-IVA, nombre o clave"
          haystack={(line) => [line.vatId, line.name, line.clave, euro.format(line.base)].join(' ')}
          columns={[
            { key: 'vat', label: 'NIF-IVA', value: (line) => line.vatId, cell: (line) => line.vatId },
            { key: 'name', label: 'Nombre', value: (line) => line.name, cell: (line) => line.name },
            { key: 'clave', label: 'Clave', value: (line) => line.clave, cell: (line) => line.clave },
            { key: 'base', label: 'Base', align: 'right', value: (line) => line.base, first: 'desc', cell: (line) => euro.format(line.base) },
          ]}
        />
  )
}

function Metric({ label, value, emphasis = false, money = true }: { label: string; value: number; emphasis?: boolean; money?: boolean }) {
  return (
    <Card>
      <p className="text-sm text-mist">{label}</p>
      <p className={`tabular mt-2 font-serif text-3xl ${emphasis ? 'text-pine' : ''}`}>
        {money ? euro.format(value) : value}
      </p>
    </Card>
  )
}
