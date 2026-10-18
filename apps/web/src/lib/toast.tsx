'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { ApiError } from '@/lib/api'

type Tone = 'ok' | 'bad'

interface Note {
  id: number
  text: string
  tone: Tone
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function reason(caught: unknown, fallback: string) {
  const message = caught instanceof ApiError ? caught.message : fallback
  if (message === 'File too large') return 'El archivo supera el tamaño permitido'
  return message
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([])

  const push = useCallback((text: string, tone: Tone = 'ok') => {
    const id = Date.now() + Math.random()
    setNotes((current) => [...current, { id, text, tone }])
    window.setTimeout(() => {
      setNotes((current) => current.filter((note) => note.id !== id))
    }, 4500)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2">
        {notes.map((note) => (
          <p
            key={note.id}
            role="status"
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm shadow-card ${
              note.tone === 'bad' ? 'bg-clay text-white' : 'bg-pine text-[#f3f0e8]'
            }`}
          >
            {note.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
