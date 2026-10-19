'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { api, apiHost } from '@/lib/api'
import { euro, fechaHora, trimestre, trimestreRango } from '@/lib/format'
import { Button, Card } from '@/components/shell'

interface Summary {
  year: number
  ingresos: number
  gastos: number
  balance: number
  pendienteCobro: number
  pendientePago: number
  months: { month: number; ingresos: number; gastos: number }[]
  quarters: { quarter: number; devengado: number; deducible: number; resultado: number }[]
  total: { devengado: number; deducible: number; resultado: number; retencion: number }
}

export default function PanelPage() {
  const pathname = usePathname()
  const [year, setYear] = useState(2026)
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    return api<Summary>(`/tax/summary?year=${year}`)
      .then((summary) => {
        setData(summary)
        setUpdatedAt(new Date())
      })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setLoading(false))
  }, [year])

  useEffect(() => {
    if (pathname !== '/panel') return
    load()
  }, [pathname, load])

  useEffect(() => {
    if (pathname !== '/panel') return
    function refresh() {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [pathname, load])

  return (
    <div className="flex flex-col gap-2 md:h-full md:min-h-0 md:overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl leading-none text-pine">Panel del ejercicio</h1>
          <p className="mt-1 truncate text-xs text-mist">
            El IVA usa la fecha de la factura.
            {updatedAt ? <> · Actualizado {fechaHora(updatedAt)}</> : null}
            {' '}· {apiHost()}
          </p>
        </div>
        <Button type="button" tone="ghost" disabled={loading} onClick={() => void load()}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </div>
      {error ? <p className="shrink-0 text-clay">{error}</p> : null}
      {data ? (
        <div className={`flex min-h-0 flex-1 flex-col gap-2 ${loading ? 'pointer-events-none opacity-60' : ''}`}>
          <section className="shrink-0 overflow-hidden rounded-2xl bg-pine text-[#f3f0e8] shadow-card">
            <div className="grid gap-3 px-4 py-3 md:grid-cols-[1.3fr_0.7fr] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-gold">IVA del ejercicio</p>
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
                <p className="tabular mt-1 font-serif text-3xl leading-none">{euro.format(data.total.resultado)}</p>
                <p className="mt-1 text-xs text-[#d9d3c7]">Resultado del IVA del ejercicio</p>
              </div>
              <dl className="grid content-center gap-1 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[#d9d3c7]">IVA de ventas</dt>
                  <dd className="tabular">{euro.format(data.total.devengado)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[#d9d3c7]">IVA de compras</dt>
                  <dd className="tabular">{euro.format(data.total.deducible)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[#d9d3c7]">Retención a profesionales</dt>
                  <dd className="tabular">{euro.format(data.total.retencion)}</dd>
                </div>
              </dl>
            </div>
          </section>
          <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-5">
            <Metric label="Ingresos" value={data.ingresos} hint="Emitidas del año" />
            <Metric label="Gastos" value={data.gastos} hint="Recibidas y gastos" />
            <Metric label="Balance" value={data.balance} hint="Ingresos − gastos" />
            <Metric label="Pendiente de cobro" value={data.pendienteCobro} href="/facturas" link="Ver emitidas" />
            <Metric label="Pendiente de pago" value={data.pendientePago} href="/recibidas" link="Ver recibidas" />
          </div>
          {data.months ? <Evolution months={data.months} /> : null}
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
            {data.quarters.map((quarter) => (
              <Link key={quarter.quarter} href={`/impuestos/303?year=${year}&quarter=${quarter.quarter}`} className="min-h-0">
                <Card className="flex h-full flex-col justify-center !p-3 transition hover:-translate-y-0.5">
                  <p className="text-xs uppercase tracking-[0.14em] text-gold">{trimestre(quarter.quarter, year)} · IVA</p>
                  <p className="mt-0.5 text-xs text-mist">{trimestreRango(quarter.quarter as 1 | 2 | 3 | 4, year)}</p>
                  <p className="tabular mt-1 font-serif text-2xl leading-none text-pine">{euro.format(quarter.resultado)}</p>
                  <ShareBar devengado={quarter.devengado} deducible={quarter.deducible} />
                  <p className="mt-1 text-xs text-mist">
                    {euro.format(quarter.devengado)} − {euro.format(quarter.deducible)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : loading ? (
        <p className="text-sm text-mist">Calculando el ejercicio…</p>
      ) : null}
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
  href,
  link,
}: {
  label: string
  value: number
  hint?: string
  href?: string
  link?: string
}) {
  return (
    <Card className="!p-3">
      <p className="text-[0.65rem] uppercase tracking-[0.14em] text-mist">{label}</p>
      <p className="tabular mt-1 font-serif text-2xl leading-none text-pine">{euro.format(value)}</p>
      {href && link ? (
        <Link href={href} className="mt-1 inline-block text-xs text-moss">{link}</Link>
      ) : (
        <p className="mt-1 text-xs text-mist">{hint}</p>
      )}
    </Card>
  )
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function Evolution({ months }: { months: { month: number; ingresos: number; gastos: number }[] }) {
  const peak = Math.max(...months.flatMap((item) => [item.ingresos, item.gastos]), 0)
  return (
    <Card className="shrink-0 !p-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-[0.65rem] uppercase tracking-[0.14em] text-mist">Evolución del año</p>
        <p className="flex gap-3 text-[0.65rem] text-mist">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-pine" /> Ventas</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-gold" /> Compras</span>
        </p>
      </div>
      <div className="grid grid-cols-12 gap-1">
        {months.map((item) => (
          <div key={item.month} className="flex flex-col items-center">
            <div className="flex h-10 w-full items-end justify-center gap-0.5">
              <div className="w-1/2 rounded-sm bg-pine" style={{ height: barHeight(item.ingresos, peak) }} />
              <div className="w-1/2 rounded-sm bg-gold" style={{ height: barHeight(item.gastos, peak) }} />
            </div>
            <p className="mt-1 text-[0.6rem] text-mist">{MONTHS[item.month - 1]}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function barHeight(value: number, peak: number) {
  if (peak <= 0 || value <= 0) return '0%'
  return `${Math.max(8, (value / peak) * 100)}%`
}

function ShareBar({ devengado, deducible }: { devengado: number; deducible: number }) {
  const whole = Math.max(devengado, 0) + Math.max(deducible, 0)
  const charged = whole > 0 ? (Math.max(devengado, 0) / whole) * 100 : 0
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
      <div className="h-full rounded-full bg-pine" style={{ width: `${charged}%` }} />
    </div>
  )
}
