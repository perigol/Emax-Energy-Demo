'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { euro, trimestre } from '@/lib/format'
import { Card } from '@/components/shell'

interface Summary {
  year: number
  pendienteCobro: number
  pendientePago: number
  quarters: { quarter: number; devengado: number; deducible: number; resultado: number }[]
  total: { devengado: number; deducible: number; resultado: number; retencion: number }
}

export default function PanelPage() {
  const [year, setYear] = useState(2026)
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Summary>(`/tax/summary?year=${year}`)
      .then(setData)
      .catch((caught: Error) => setError(caught.message))
  }, [year])

  return (
    <div className="flex flex-col gap-3 md:h-full md:min-h-0">
      <div className="shrink-0">
        <h1 className="font-serif text-3xl text-pine">Panel del ejercicio</h1>
        <p className="mt-1 text-sm text-mist">El 303 de cada trimestre sale de las facturas emitidas, las recibidas y los gastos.</p>
      </div>
      {error ? <p className="text-clay">{error}</p> : null}
      {data ? (
        <>
          <section className="shrink-0 overflow-hidden rounded-2xl bg-pine text-[#f3f0e8] shadow-card">
            <div className="grid gap-4 p-5 md:grid-cols-[1.3fr_0.7fr] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-gold">Modelo 303</p>
                  <select
                    className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-sm text-[#f3f0e8]"
                    value={year}
                    onChange={(event) => setYear(Number(event.target.value))}
                  >
                    {[2025, 2026, 2027].map((item) => (
                      <option key={item} className="text-ink">{item}</option>
                    ))}
                  </select>
                </div>
                <p className="tabular mt-2 font-serif text-4xl leading-none md:text-5xl">{euro.format(data.total.resultado)}</p>
                <p className="mt-2 text-sm text-[#d9d3c7]">Resultado del ejercicio</p>
              </div>
              <dl className="grid content-center gap-2 text-sm">
                <div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-1.5">
                  <dt className="text-[#d9d3c7]">Devengado</dt>
                  <dd className="tabular">{euro.format(data.total.devengado)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-1.5">
                  <dt className="text-[#d9d3c7]">Deducible</dt>
                  <dd className="tabular">{euro.format(data.total.deducible)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[#d9d3c7]">Retención 111</dt>
                  <dd className="tabular">{euro.format(data.total.retencion)}</dd>
                </div>
              </dl>
            </div>
          </section>
          <div className="grid shrink-0 gap-3 md:grid-cols-2">
            <Card className="!p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-mist">Pendiente de cobro</p>
              <p className="tabular mt-1 font-serif text-3xl text-pine">{euro.format(data.pendienteCobro)}</p>
              <Link href="/facturas" className="mt-2 inline-block text-sm text-moss">
                Ver emitidas
              </Link>
            </Card>
            <Card className="!p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-mist">Pendiente de pago</p>
              <p className="tabular mt-1 font-serif text-3xl text-pine">{euro.format(data.pendientePago)}</p>
              <Link href="/recibidas" className="mt-2 inline-block text-sm text-moss">
                Ver recibidas
              </Link>
            </Card>
          </div>
          <div className="grid gap-3 md:flex-1 md:grid-cols-4">
            {data.quarters.map((quarter) => (
              <Link key={quarter.quarter} href={`/impuestos/303?year=${year}&quarter=${quarter.quarter}`} className="min-h-min">
                <Card className="h-full !p-4 transition hover:-translate-y-0.5">
                  <p className="text-xs uppercase tracking-[0.14em] text-gold">{trimestre(quarter.quarter, year)}</p>
                  <p className="tabular mt-2 font-serif text-2xl text-pine">{euro.format(quarter.resultado)}</p>
                  <ShareBar devengado={quarter.devengado} deducible={quarter.deducible} />
                  <p className="mt-2 text-xs text-mist">
                    {euro.format(quarter.devengado)} − {euro.format(quarter.deducible)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function ShareBar({ devengado, deducible }: { devengado: number; deducible: number }) {
  const whole = Math.max(devengado, 0) + Math.max(deducible, 0)
  const charged = whole > 0 ? (Math.max(devengado, 0) / whole) * 100 : 0
  return (
    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper">
      <div className="h-full rounded-full bg-pine" style={{ width: `${charged}%` }} />
    </div>
  )
}
