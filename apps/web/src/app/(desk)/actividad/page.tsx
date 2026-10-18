'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Listing } from '@/components/listing'
import { Empty, PageTitle } from '@/components/shell'

interface Entry {
  id: string
  at: string
  userName: string
  userEmail: string
  summary: string
}

const when = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
})

export default function ActivityPage() {
  const [rows, setRows] = useState<Entry[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<Entry[]>('/audit')
      .then(setRows)
      .catch((caught: Error) => setError(caught.message))
  }, [])

  return (
    <div>
      <PageTitle
        title="Actividad"
        text="Quién entró y quién cambió el libro. La contraseña no se guarda."
      />
      {error ? <p className="mb-4 text-clay">{error}</p> : null}
      {rows.length === 0 && !error ? (
        <Empty title="Todavía no hay movimientos" text="Cuando alguien entre o cambie el libro, quedará escrito aquí." />
      ) : null}
      {rows.length > 0 ? (
        <Listing
          rows={rows}
          rowKey={(row) => row.id}
          placeholder="Buscar por persona o por lo que hizo"
          haystack={(row) => [when.format(new Date(row.at)), row.userName, row.userEmail, row.summary].join(' ')}
          columns={[
            { key: 'at', label: 'Cuándo', value: (row) => row.at, first: 'desc', cell: (row) => <span className="whitespace-nowrap">{when.format(new Date(row.at))}</span> },
            {
              key: 'who',
              label: 'Quién',
              value: (row) => row.userName,
              cell: (row) => <>{row.userName}{row.userEmail ? <span className="block text-mist">{row.userEmail}</span> : null}</>,
            },
            { key: 'what', label: 'Qué hizo', value: (row) => row.summary, cell: (row) => row.summary },
          ]}
        />
      ) : null}
    </div>
  )
}
