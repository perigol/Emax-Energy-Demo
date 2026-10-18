'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { euro, fecha } from '@/lib/format'
import { reason, useToast } from '@/lib/toast'
import { Button, Card, ErrorNote, PageTitle } from '@/components/shell'

export default function TaxIndexPage() {
  const [year, setYear] = useState(2026)
  return (
    <div>
      <PageTitle
        title="Impuestos"
        text="Cálculo de demostración del régimen general. Un trimestre se liquida al cerrar, y un ejercicio completo cuando ya pasó el 31 de diciembre."
        action={
          <select className="rounded-md border border-line bg-white px-3 py-2" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2025, 2026, 2027].map((item) => <option key={item}>{item}</option>)}
          </select>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <ModelLink href={`/impuestos/303?year=${year}&quarter=1`} title="Modelo 303" text="IVA repercutido menos IVA soportado deducible." />
        <ModelLink href={`/impuestos/111?year=${year}&quarter=1`} title="Modelo 111" text="Retenciones a profesionales y perceptores." />
        <ModelLink href={`/impuestos/349?year=${year}&quarter=1`} title="Modelo 349" text="Operaciones con empresas de la Unión Europea." />
      </div>
      <YearBoard year={year} />
    </div>
  )
}

function ModelLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href}>
      <Card className="h-full transition hover:-translate-y-0.5">
        <p className="text-xs uppercase tracking-[0.14em] text-gold">Declaración</p>
        <h2 className="mt-2 font-serif text-2xl text-pine">{title}</h2>
        <p className="mt-2 text-sm text-mist">{text}</p>
      </Card>
    </Link>
  )
}

interface QuarterRow {
  quarter: number
  closesOn: string
  resultado: number
  canSettle: boolean
  settledOn: string | null
}

interface ExerciseRow {
  closesOn: string
  resultado: number
  canSettle: boolean
  settledOn: string | null
}

function YearBoard({ year }: { year: number }) {
  const [rows, setRows] = useState<QuarterRow[]>([])
  const [exercise, setExercise] = useState<ExerciseRow | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | 'year' | null>(null)
  const toast = useToast()

  function load() {
    api<{ quarters: QuarterRow[]; exercise: ExerciseRow }>(`/tax/settlements?year=${year}`)
      .then((data) => {
        setRows(data.quarters)
        setExercise(data.exercise)
      })
      .catch((caught: Error) => setError(caught.message))
  }

  useEffect(load, [year])

  async function download(quarter: number) {
    await savePdf(`/tax/settlements/${year}/${quarter}/pdf`, `liquidacion-${quarter}T-${year}.pdf`)
  }

  async function openQuarter(quarter: number) {
    try {
      await download(quarter)
    } catch (caught) {
      const message = reason(caught, 'No se pudo abrir el PDF')
      setError(message)
      toast(message, 'bad')
    }
  }

  async function settle(quarter: number) {
    setBusy(quarter)
    setError('')
    try {
      await api('/tax/settlements', { method: 'POST', body: JSON.stringify({ year, quarter }) })
      await download(quarter)
      toast(`${quarter}T ${year} liquidado`)
      load()
    } catch (caught) {
      const message = reason(caught, 'No se pudo liquidar el trimestre')
      setError(message)
      toast(message, 'bad')
      load()
    } finally {
      setBusy(null)
    }
  }

  async function downloadYear() {
    await savePdf(`/tax/settlements/year/${year}/pdf`, `liquidacion-ejercicio-${year}.pdf`)
  }

  async function openYear() {
    try {
      await downloadYear()
    } catch (caught) {
      const message = reason(caught, 'No se pudo abrir el PDF')
      setError(message)
      toast(message, 'bad')
    }
  }

  async function settleYear() {
    setBusy('year')
    setError('')
    try {
      await api('/tax/settlements/year', { method: 'POST', body: JSON.stringify({ year }) })
      await downloadYear()
      toast(`Ejercicio ${year} liquidado`)
      load()
    } catch (caught) {
      const message = reason(caught, 'No se pudo liquidar el ejercicio')
      setError(message)
      toast(message, 'bad')
      load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="font-serif text-xl">Los cuatro trimestres de {year}</h2>
      {error ? <div className="mt-3"><ErrorNote>{error}</ErrorNote></div> : null}
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {rows.map((row) => (
          <div key={row.quarter} className="rounded-lg border border-line p-3">
            <p className="text-sm text-mist">{row.quarter}T · modelo 303</p>
            <p className="tabular font-serif text-2xl text-pine">{euro.format(row.resultado)}</p>
            {row.settledOn ? (
              <div className="mt-3">
                <p className="text-xs text-mist">Liquidado el {fecha(row.settledOn)}</p>
                <Button type="button" tone="ghost" className="mt-2 w-full" onClick={() => void openQuarter(row.quarter)}>
                  Descargar
                </Button>
              </div>
            ) : row.canSettle ? (
              <Button type="button" className="mt-3 w-full" disabled={busy === row.quarter} onClick={() => void settle(row.quarter)}>
                {busy === row.quarter ? 'Liquidando…' : 'Liquidar'}
              </Button>
            ) : (
              <p className="mt-3 text-xs text-mist">Cierra el {fecha(row.closesOn)}.</p>
            )}
          </div>
        ))}
      </div>
      {exercise ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="text-sm text-mist">Ejercicio {year} · modelo 303</p>
            <p className="tabular font-serif text-2xl text-pine">{euro.format(exercise.resultado)}</p>
          </div>
          {exercise.settledOn ? (
            <div className="text-right">
              <p className="text-xs text-mist">Liquidado el {fecha(exercise.settledOn)}</p>
              <Button type="button" tone="ghost" className="mt-2" onClick={() => void openYear()}>
                Descargar ejercicio
              </Button>
            </div>
          ) : exercise.canSettle ? (
            <Button type="button" disabled={busy === 'year'} onClick={() => void settleYear()}>
              {busy === 'year' ? 'Liquidando…' : 'Liquidar ejercicio'}
            </Button>
          ) : (
            <p className="text-sm text-mist">El ejercicio cierra el {fecha(exercise.closesOn)}.</p>
          )}
        </div>
      ) : null}
    </Card>
  )
}

async function savePdf(path: string, filename: string) {
  const blob = await api<Blob>(path)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
