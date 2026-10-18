import type { Metadata } from 'next'
import { Fraunces, Manrope } from 'next/font/google'
import { SessionProvider } from '@/lib/session'
import { ToastProvider } from '@/lib/toast'
import './globals.css'

const serif = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' })
const sans = Manrope({ subsets: ['latin'], variable: '--font-manrope' })

export const metadata: Metadata = {
  title: 'Norte Luz · Contabilidad',
  description: 'Muestra de facturación y modelos 303, 111 y 349.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${serif.variable} ${sans.variable} font-sans text-ink antialiased`}>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
