'use client'

import { FormEvent, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { roleLabel } from '@/lib/format'
import { Listing } from '@/components/listing'
import { reason, useToast } from '@/lib/toast'
import { Button, Card, ErrorNote, Field, PageTitle, control } from '@/components/shell'

interface User { id: string; name: string; email: string; role: 'ADMIN' | 'GESTOR' | 'FACTURAS' }

export default function UsersPage() {
  const [rows, setRows] = useState<User[]>([])
  const [error, setError] = useState('')
  const toast = useToast()

  function load() {
    api<User[]>('/users').then(setRows).catch((caught: Error) => setError(caught.message))
  }
  useEffect(load, [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          role: form.get('role'),
          password: form.get('password'),
        }),
      })
      event.currentTarget.reset()
      toast('Usuario creado')
      load()
    } catch (caught) {
      const message = reason(caught, 'No se pudo crear')
      setError(message)
      toast(message, 'bad')
    }
  }

  return (
    <div>
      <PageTitle title="Usuarios" text="El administrador crea las cuentas. El rol Facturas solo puede subir recibidas y gastos." />
      <div className="mb-4">
        <Listing
          rows={rows}
          rowKey={(row) => row.id}
          placeholder="Buscar por nombre, correo o rol"
          haystack={(row) => [row.name, row.email, roleLabel[row.role]].join(' ')}
          columns={[
            { key: 'name', label: 'Nombre', value: (row) => row.name, cell: (row) => row.name },
            { key: 'email', label: 'Correo', value: (row) => row.email, cell: (row) => row.email },
            { key: 'role', label: 'Rol', value: (row) => roleLabel[row.role] || row.role, cell: (row) => roleLabel[row.role] },
          ]}
        />
      </div>
      <Card>
        <h2 className="mb-3 font-serif text-xl">Nueva cuenta</h2>
        <form onSubmit={create} className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre" required><input className={control} name="name" required minLength={2} maxLength={120} /></Field>
          <Field label="Correo" required><input className={control} type="email" name="email" required maxLength={160} /></Field>
          <Field label="Rol" required>
            <select className={control} name="role" defaultValue="GESTOR">
              <option value="ADMIN">Administrador</option>
              <option value="GESTOR">Gestor</option>
              <option value="FACTURAS">Carga de facturas</option>
            </select>
          </Field>
          <div>
            <Field label="Contraseña" required hint="Mínimo 8 caracteres, con mayúscula, minúscula, un número y un símbolo.">
              <input className={control} name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
            </Field>
          </div>
          {error ? <div className="md:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
          <div><Button type="submit">Crear usuario</Button></div>
        </form>
      </Card>
    </div>
  )
}
