'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSession } from '@/lib/session'
import { roleLabel, statusLabel } from '@/lib/format'

const groups = [
  {
    label: 'Libro',
    links: [
      { href: '/panel', label: 'Panel', roles: ['ADMIN', 'GESTOR'] },
      { href: '/contactos', label: 'Contactos', roles: ['ADMIN', 'GESTOR'] },
      { href: '/facturas', label: 'Facturas emitidas', roles: ['ADMIN', 'GESTOR'] },
      { href: '/recibidas', label: 'Facturas recibidas', roles: ['ADMIN', 'GESTOR', 'FACTURAS'] },
      { href: '/gastos', label: 'Gastos', roles: ['ADMIN', 'GESTOR', 'FACTURAS'] },
    ],
  },
  {
    label: 'Dinero',
    links: [
      { href: '/bancos', label: 'Bancos', roles: ['ADMIN', 'GESTOR'] },
      { href: '/impuestos', label: 'Impuestos', roles: ['ADMIN', 'GESTOR'] },
    ],
  },
  {
    label: 'Casa',
    links: [
      { href: '/configuracion', label: 'Configuración', roles: ['ADMIN'] },
      { href: '/usuarios', label: 'Usuarios', roles: ['ADMIN'] },
      { href: '/actividad', label: 'Actividad', roles: ['ADMIN'] },
    ],
  },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center text-mist">Abriendo el libro…</div>
  }

  const visibleGroups = groups
    .map((group) => ({ ...group, links: group.links.filter((link) => link.roles.includes(user.role)) }))
    .filter((group) => group.links.length > 0)
  const here = visibleGroups
    .flatMap((group) => group.links)
    .find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))

  return (
    <div className="min-h-screen md:grid md:h-dvh md:grid-cols-[260px_1fr] md:overflow-hidden">
      <aside className="flex flex-col bg-pine text-[#f3f0e8] md:h-dvh md:overflow-y-auto">
        <div className="px-5 pb-4 pt-6">
          <p className="font-serif text-[1.7rem] leading-none">Norte Luz</p>
          <p className="mt-2 text-[0.68rem] uppercase tracking-[0.2em] text-gold">Servicios energéticos</p>
        </div>
        <nav className="flex gap-4 overflow-x-auto px-3 pb-4 md:block md:flex-1 md:space-y-5 md:overflow-visible md:px-3">
          {visibleGroups.map((group) => (
            <div key={group.label} className="flex shrink-0 gap-1 md:block">
              <p className="hidden px-3 pb-1 text-[0.65rem] uppercase tracking-[0.16em] text-gold/80 md:block">
                {group.label}
              </p>
              {group.links.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block whitespace-nowrap rounded-md px-3 py-2 text-sm md:border-l-2 ${
                      active
                        ? 'bg-white/10 text-white md:border-gold'
                        : 'text-[#d9d3c7] hover:bg-white/5 md:border-transparent'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 px-5 py-4 md:block">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-[#d9d3c7]">{roleLabel[user.role]}</p>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-col md:h-dvh">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line/80 bg-white/55 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-sm font-medium text-pine">{here?.label ?? 'Norte Luz'}</p>
            <p className="text-xs text-mist">Datos de demostración. Se reinician con el seed.</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right md:hidden">
              <p className="font-medium">{user.name}</p>
              <p className="text-mist">{roleLabel[user.role]}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Cierra la sesión"
              aria-describedby="logout-hint"
              className="group relative grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-pine transition hover:border-gold hover:bg-[#f8f1df]"
            >
              <LogoutMark />
              <span
                id="logout-hint"
                role="tooltip"
                className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-20 whitespace-nowrap rounded-md bg-pine px-2.5 py-1 text-xs text-[#f3f0e8] opacity-0 shadow-card transition group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                Cierra la sesión
              </span>
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto px-6 py-4 md:py-5">{children}</main>
      </div>
    </div>
  )
}

function LogoutMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M13.5 12H4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 8.5 3.5 12 7 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PageTitle({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-4xl text-pine">{title}</h1>
        {text ? <p className="mt-1 max-w-2xl text-sm text-mist">{text}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/80 bg-white p-5 shadow-card ${className}`}>{children}</section>
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-mist">
        {label}
        {required ? <span className="text-clay"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-mist">{hint}</span> : null}
    </label>
  )
}

export const control =
  'w-full rounded-lg border border-line bg-white px-3 py-2 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30'

export function Button({
  children,
  tone = 'pine',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'pine' | 'ghost' | 'clay' }) {
  const tones = {
    pine: 'bg-pine text-[#f3f0e8] hover:bg-[#2a3b33]',
    ghost: 'border border-line bg-white hover:bg-paper',
    clay: 'bg-clay text-white hover:bg-[#742f28]',
  }
  return (
    <button
      {...props}
      className={`rounded-md px-4 py-2 text-sm disabled:opacity-50 ${tones[tone]} ${props.className || ''}`}
    >
      {children}
    </button>
  )
}

export function Pill({ status }: { status: string }) {
  const { statusLabel } = requireTone(status)
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ${toneClass(status)}`}>{statusLabel}</span>
  )
}

function requireTone(status: string) {
  return { statusLabel: labels(status) }
}

function labels(status: string) {
  return statusLabel[status] || status
}

function toneClass(status: string) {
  if (status === 'PAGO_PARCIAL') return 'bg-[#f8f1df] text-[#7a5b1e]'
  if (status === 'COBRADA' || status === 'PAGADA') return 'bg-[#e5f2eb] text-moss'
  if (status === 'VENCIDA') return 'bg-[#f8e8e6] text-clay'
  if (status === 'BORRADOR') return 'bg-paper text-mist'
  return 'bg-[#f8f1df] text-[#7a5b1e]'
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-serif text-xl text-pine">{title}</p>
      <p className="mt-1 text-sm text-mist">{text}</p>
    </div>
  )
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-[#f8e8e6] px-3 py-2 text-sm text-clay">{children}</p>
}
