'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { euro, fecha, todayIso } from '@/lib/format'
import { Listing } from '@/components/listing'
import { reason, useToast } from '@/lib/toast'
import { Button, Card, Empty, ErrorNote, Field, PageTitle, control } from '@/components/shell'

interface Movement { id: string; date: string; concept: string; amount: number; reconciled: boolean }
interface Account { id: string; name: string; iban: string; bankName: string | null; balance: number; movements: Movement[] }
interface Payment { id: string; label: string; amount: number; direction: string; date: string }
interface Overview { accounts: Account[]; openPayments: Payment[] }
interface Lookup { bankName: string | null; valid: boolean }
interface ImportResult {
  imported: number
  skipped: number
  warnings: string[]
  accounts: { bankName: string | null; name: string }[]
}

function formatIban(iban: string) {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
}

export default function BanksPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [iban, setIban] = useState('')
  const [name, setName] = useState('')
  const [hint, setHint] = useState('')
  const nameTouched = useRef(false)
  const toast = useToast()

  function load() {
    api<Overview>('/banks').then(setData).catch((caught: Error) => setError(caught.message))
  }
  useEffect(load, [])

  useEffect(() => {
    const compact = iban.replace(/\s+/g, '')
    if (compact.length < 8) {
      setHint('')
      if (!nameTouched.current) setName('')
      return
    }
    const handle = setTimeout(() => {
      api<Lookup>(`/banks/lookup?iban=${encodeURIComponent(compact)}`)
        .then((result) => {
          if (result.bankName && !nameTouched.current) setName(result.bankName)
          if (result.bankName && result.valid) setHint(result.bankName)
          else if (result.bankName) setHint(`${result.bankName}. Revisa los dígitos de control.`)
          else if (compact.length >= 24) setHint('IBAN español de una entidad que no está en el registro.')
          else setHint('')
        })
        .catch(() => setHint(''))
    }, 250)
    return () => clearTimeout(handle)
  }, [iban])

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      await api('/banks/accounts', { method: 'POST', body: JSON.stringify({ name, iban }) })
      setName('')
      setIban('')
      setHint('')
      nameTouched.current = false
      toast('Cuenta añadida')
      load()
    } catch (caught) {
      const message = reason(caught, 'No se pudo crear la cuenta')
      setError(message)
      toast(message, 'bad')
    }
  }

  async function addMovement(accountId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api(`/banks/accounts/${accountId}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          date: form.get('date'),
          concept: form.get('concept'),
          amount: Number(form.get('amount')),
        }),
      })
      toast('Apunte registrado')
      event.currentTarget.reset()
      load()
    } catch (caught) {
      toast(reason(caught, 'No se pudo registrar el apunte'), 'bad')
    }
  }

  async function reconcile(movementId: string, paymentId: string) {
    setError('')
    try {
      await api(`/banks/movements/${movementId}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({ paymentId }),
      })
      toast('Movimiento conciliado')
      load()
    } catch (caught) {
      const message = reason(caught, 'No se pudo conciliar')
      setError(message)
      toast(message, 'bad')
    }
  }

  function describeImport(result: ImportResult) {
    const bank = result.accounts[0]?.bankName || result.accounts[0]?.name || 'la cuenta'
    const parts = [`${result.imported} apuntes nuevos en ${bank}`]
    if (result.skipped > 0) parts.push(`${result.skipped} ya estaban`)
    if (result.warnings.length > 0) parts.push(...result.warnings)
    setNotice(`${parts.join('. ')}.`)
  }

  async function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    const form = new FormData(event.currentTarget)
    try {
      const result = await api<ImportResult>('/banks/norma43', { method: 'POST', body: form })
      event.currentTarget.reset()
      describeImport(result)
      toast(`${result.imported} apuntes nuevos`)
      load()
    } catch (caught) {
      const message = reason(caught, 'No se pudo leer el extracto')
      setError(message)
      toast(message, 'bad')
    }
  }

  async function importCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    const form = new FormData(event.currentTarget)
    const accountId = String(form.get('accountId') || '')
    form.delete('accountId')
    try {
      const result = await api<ImportResult>(`/banks/accounts/${accountId}/csv`, { method: 'POST', body: form })
      event.currentTarget.reset()
      describeImport(result)
      toast(`${result.imported} apuntes nuevos`)
      load()
    } catch (caught) {
      const message = reason(caught, 'No se pudo leer el CSV')
      setError(message)
      toast(message, 'bad')
    }
  }

  async function importSample() {
    setError('')
    setNotice('')
    try {
      const result = await api<ImportResult>('/banks/norma43/ejemplo', { method: 'POST' })
      describeImport(result)
      toast(`${result.imported} apuntes nuevos`)
      load()
    } catch (caught) {
      const message = reason(caught, 'No se pudo cargar el extracto de ejemplo')
      setError(message)
      toast(message, 'bad')
    }
  }

  return (
    <div>
      <PageTitle
        title="Bancos"
        text="El IBAN español identifica el banco. Un extracto Norma 43, el cuaderno que descarga la entidad, carga los apuntes: el cargo entra en negativo y el abono en positivo."
      />
      {error ? <div className="mb-4"><ErrorNote>{error}</ErrorNote></div> : null}
      {notice ? <p className="mb-4 rounded-md bg-[#e5f2eb] px-3 py-2 text-sm text-moss">{notice}</p> : null}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-serif text-xl text-pine">Nueva cuenta</h2>
          <form onSubmit={(event) => void addAccount(event)} className="grid gap-3">
            <Field label="IBAN" required hint="Por ejemplo ES79 2100 0813 6101 2345 6789.">
              <input className={control} name="iban" value={iban} maxLength={34} onChange={(event) => setIban(event.target.value)} required />
            </Field>
            {hint ? <p className="text-sm text-mist">{hint}</p> : null}
            <Field label="Nombre de la cuenta" required>
              <input
                className={control}
                name="name"
                value={name}
                onChange={(event) => {
                  nameTouched.current = true
                  setName(event.target.value)
                }}
                required
                minLength={2}
                maxLength={120}
              />
            </Field>
            <Button type="submit">Añadir cuenta</Button>
          </form>
        </Card>
        <Card>
          <h2 className="mb-3 font-serif text-xl text-pine">Extracto</h2>
          <form onSubmit={(event) => void importFile(event)} className="grid gap-3">
            <Field label="Extracto Norma 43">
              <input className={control} type="file" name="file" accept=".n43,.c43,.txt,text/plain" required />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Importar fichero</Button>
              <Button type="button" tone="ghost" onClick={() => void importSample()}>Cargar extracto de ejemplo</Button>
            </div>
            <p className="text-sm text-mist">El de ejemplo entra en la cuenta de CaixaBank y se puede conciliar con cobros y pagos que aún no tienen apunte.</p>
          </form>
          <form onSubmit={(event) => void importCsv(event)} className="mt-4 grid gap-3 border-t border-line/70 pt-4">
            <Field label="CSV" hint="Columnas fecha, concepto e importe. Un importe negativo es un cargo. Ejemplo: 19/10/2026;Cobro;1.250,50">
              <select className={control} name="accountId" required defaultValue="">
                <option value="" disabled>Elige la cuenta</option>
                {data?.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </Field>
            <input className={control} type="file" name="file" accept=".csv,text/csv" required />
            <Button type="submit">Importar CSV</Button>
          </form>
        </Card>
      </div>
      {data && data.accounts.length === 0 ? (
        <Empty title="Sin cuentas" text="Añade un IBAN o importa un extracto Norma 43." />
      ) : null}
      <div className="space-y-4">
        {data?.accounts.map((account) => (
          <Card key={account.id} className="overflow-hidden p-0">
            <div className="flex items-end justify-between gap-4 bg-pine px-5 py-4 text-[#f3f0e8]">
              <div>
                <h2 className="font-serif text-2xl">{account.name}</h2>
                <p className="text-sm text-[#d9d3c7]">{formatIban(account.iban)}</p>
                {account.bankName && account.bankName !== account.name ? (
                  <p className="text-sm text-gold">{account.bankName}</p>
                ) : null}
              </div>
              <p className="tabular font-serif text-2xl">{euro.format(account.balance)}</p>
            </div>
            {account.movements.length === 0 ? (
              <p className="px-5 py-3 text-sm text-mist">Esta cuenta todavía no tiene apuntes.</p>
            ) : (
              <Listing
                framed={false}
                rows={account.movements}
                rowKey={(movement) => movement.id}
                placeholder="Buscar por concepto o fecha"
                haystack={(movement) => [movement.concept, fecha(movement.date), movement.reconciled ? 'Conciliado' : 'Sin conciliar', euro.format(movement.amount)].join(' ')}
                columns={[
                  { key: 'date', label: 'Fecha', value: (movement) => movement.date, first: 'desc', cell: (movement) => fecha(movement.date) },
                  { key: 'concept', label: 'Concepto', value: (movement) => movement.concept, cell: (movement) => movement.concept },
                  { key: 'state', label: 'Estado', value: (movement) => (movement.reconciled ? 'Conciliado' : 'Sin conciliar'), cell: (movement) => (movement.reconciled ? 'Conciliado' : 'Sin conciliar') },
                  {
                    key: 'amount',
                    label: 'Importe',
                    align: 'right',
                    value: (movement) => movement.amount,
                    first: 'desc',
                    cell: (movement) => <span className={movement.amount < 0 ? 'text-clay' : 'text-moss'}>{euro.format(movement.amount)}</span>,
                  },
                  {
                    key: 'reconcile',
                    label: '',
                    sortable: false,
                    cell: (movement) => !data || movement.reconciled || data.openPayments.length === 0 ? null : (
                      <select
                        className="rounded-md border border-line px-2 py-1"
                        defaultValue=""
                        onChange={(event) => {
                          if (event.target.value) void reconcile(movement.id, event.target.value)
                        }}
                      >
                        <option value="">Conciliar con…</option>
                        {data.openPayments.map((payment) => (
                          <option key={payment.id} value={payment.id}>
                            {payment.label} · {euro.format(payment.amount)}
                          </option>
                        ))}
                      </select>
                    ),
                  },
                ]}
              />
            )}
            <form onSubmit={(event) => void addMovement(account.id, event)} className="grid gap-2 border-t border-line px-5 py-4 md:grid-cols-[140px_1fr_140px_auto]">
              <input className={control} type="date" name="date" required min="1990-01-01" max="2100-12-31" defaultValue={todayIso()} />
              <input className={control} name="concept" placeholder="Concepto" required maxLength={240} />
              <input className={control} name="amount" type="number" min="-9999999999.99" max="9999999999.99" step="0.01" placeholder="Importe" required />
              <Button type="submit" tone="ghost">Apuntar</Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  )
}
