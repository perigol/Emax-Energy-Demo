'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/session'
import { reason, useToast } from '@/lib/toast'
import { ErrorNote } from '@/components/shell'

const demos = [
  { role: 'Administrador', email: 'admin@norteluz.es' },
  { role: 'Gestor', email: 'gestor@norteluz.es' },
  { role: 'Carga de facturas', email: 'facturas@norteluz.es' },
]

export default function LoginPage() {
  const { login } = useSession()
  const router = useRouter()
  const [email, setEmail] = useState('admin@norteluz.es')
  const [password, setPassword] = useState('demo1234')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const toast = useToast()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const user = await login(email, password)
      router.push(user.role === 'FACTURAS' ? '/recibidas' : '/panel')
    } catch (caught) {
      const message = reason(caught, 'No se pudo entrar')
      setError(message)
      toast(message, 'bad')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-pine px-12 py-12 text-[#f3f0e8] lg:flex">
        <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-gold/10" />
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold">EnerFactura</p>
          <p className="mt-3 text-sm text-[#d9d3c7]">Muestra preparada para EMAX Energía</p>
          <div className="mt-8 h-px w-16 bg-gold" />
          <h1 className="mt-8 max-w-md font-serif text-5xl leading-tight">
            El trimestre, las facturas y los cobros en un mismo libro.
          </h1>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">303 · 111 · 349</p>
          <p className="mt-3 max-w-sm text-sm text-[#d9d3c7]">
            Muestra para una comercializadora de servicios energéticos. Los modelos salen de los documentos, no de cifras escritas a mano.
          </p>
        </div>
      </section>
      <section className="grid place-items-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-white/80 bg-white p-6 shadow-card sm:p-8">
          <div>
            <p className="font-serif text-3xl text-pine lg:hidden">EnerFactura</p>
            <p className="text-sm text-gold">Muestra preparada para EMAX Energía</p>
            <h2 className="mt-2 font-serif text-3xl text-pine">Entrar</h2>
            <p className="mt-1 text-sm text-mist">La contraseña de los tres accesos es demo1234.</p>
          </div>
          <div className="grid gap-2">
            {demos.map((demo) => (
              <button
                key={demo.email}
                type="button"
                onClick={() => setEmail(demo.email)}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm ${
                  email === demo.email ? 'border-gold bg-[#f8f1df]' : 'border-line bg-paper/60'
                }`}
              >
                <span className="font-medium">{demo.role}</span>
                <span className="mt-0.5 block text-mist">{demo.email}</span>
              </button>
            ))}
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-mist">Correo<span className="text-clay"> *</span></span>
            <input
              className="w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
            />
          </label>
          <div className="block text-sm">
            <label htmlFor="password" className="mb-1 block text-mist">Contraseña<span className="text-clay"> *</span></label>
            <div className="relative">
              <input
                id="password"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 pr-10 outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-mist hover:text-pine"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                <Eye open={showPassword} />
              </button>
            </div>
          </div>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <button
            disabled={pending}
            className="w-full rounded-lg bg-pine px-4 py-2.5 text-[#f3f0e8] disabled:opacity-50"
          >
            {pending ? 'Entrando…' : 'Entrar al libro'}
          </button>
        </form>
      </section>
    </div>
  )
}

function Eye({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      {open ? <path d="M5 19 19 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : null}
    </svg>
  )
}
