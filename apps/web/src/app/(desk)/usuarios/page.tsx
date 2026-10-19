'use client'

import { FormEvent, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { roleLabel } from '@/lib/format'
import { Listing } from '@/components/listing'
import { reason, useToast } from '@/lib/toast'
import { useSession } from '@/lib/session'
import {
  EditUserModal,
  UserRowActions,
  type UserListRow,
} from '@/components/user-list-tools'
import { Button, Card, ErrorNote, Field, PageTitle, control } from '@/components/shell'

export default function UsersPage() {
  const { user: session } = useSession()
  const [rows, setRows] = useState<UserListRow[]>([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<UserListRow | null>(null)
  const toast = useToast()
  const selfId = session?.sub || session?.id

  function load() {
    api<UserListRow[]>('/users').then(setRows).catch((caught: Error) => setError(caught.message))
  }
  useEffect(load, [])

  function mergeRow(updated: UserListRow) {
    setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)))
  }

  async function removeRow(row: UserListRow) {
    const ok = window.confirm(`¿Eliminar la cuenta de ${row.name}?`)
    if (!ok) return
    try {
      await api(`/users/${row.id}`, { method: 'DELETE' })
      setRows((current) => current.filter((item) => item.id !== row.id))
      toast('Usuario eliminado')
    } catch (caught) {
      toast(reason(caught, 'No se pudo eliminar'), 'bad')
    }
  }

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
      setOpen(false)
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
      <PageTitle
        title="Usuarios"
        text="El administrador crea las cuentas. El rol Facturas solo puede subir recibidas y gastos."
        action={<Button onClick={() => setOpen((value) => !value)}>{open ? 'Cerrar' : 'Nuevo usuario'}</Button>}
      />
      {open ? (
        <Card className="mb-4">
          <h2 className="mb-4 font-serif text-xl text-pine">Nuevo usuario</h2>
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
            <Field label="Contraseña" required hint="Mínimo 8 caracteres, con mayúscula, minúscula, un número y un símbolo.">
              <input className={control} name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
            </Field>
            {error ? <div className="md:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
            <div><Button type="submit">Crear usuario</Button></div>
          </form>
        </Card>
      ) : null}
      <Listing
        rows={rows}
        rowKey={(row) => row.id}
        placeholder="Buscar por nombre, correo o rol"
        haystack={(row) => [row.name, row.email, roleLabel[row.role]].join(' ')}
        columns={[
          { key: 'name', label: 'Nombre', value: (row) => row.name, cell: (row) => row.name },
          { key: 'email', label: 'Correo', value: (row) => row.email, cell: (row) => row.email },
          { key: 'role', label: 'Rol', value: (row) => roleLabel[row.role] || row.role, cell: (row) => roleLabel[row.role] },
          {
            key: 'actions',
            label: 'Acciones',
            sortable: false,
            cell: (row) => {
              const isSelf = Boolean(selfId && row.id === selfId)
              return (
                <UserRowActions
                  user={row}
                  onEdit={() => setEdit(row)}
                  onDelete={() => void removeRow(row)}
                  deleteDisabled={isSelf}
                  deleteLabel={isSelf ? 'No puedes eliminar tu propia cuenta' : undefined}
                />
              )
            },
          },
        ]}
      />
      {edit ? (
        <EditUserModal user={edit} onClose={() => setEdit(null)} onSuccess={mergeRow} />
      ) : null}
    </div>
  )
}
