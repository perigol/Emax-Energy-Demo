'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSession } from '@/lib/session'

export default function HomePage() {
  const { user, ready } = useSession()
  const router = useRouter()
  useEffect(() => {
    if (!ready) return
    if (!user) router.replace('/login')
    else router.replace(user.role === 'FACTURAS' ? '/recibidas' : '/panel')
  }, [ready, user, router])
  return <div className="grid min-h-screen place-items-center text-mist">Abriendo el libro…</div>
}
