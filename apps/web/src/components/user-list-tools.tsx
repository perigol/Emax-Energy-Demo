'use client'

import { FormEvent, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { reason, useToast } from '@/lib/toast'
import { EditDeleteRowActions } from '@/components/list-row-actions'
import { Button, Card, ErrorNote, Field, control } from '@/components/shell'

export interface UserListRow {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'GESTOR' | 'FACTURAS'
}

export function UserRowActions({
  user,
  onEdit,
  onDelete,
  deleteDisabled,
  deleteLabel,
}: {
  user: UserListRow
  onEdit: () => void
  onDelete: () => void
  deleteDisabled?: boolean
  deleteLabel?: string
}) {
  return (
    <EditDeleteRowActions
      name={user.name}
      onEdit={onEdit}
      onDelete={onDelete}
      deleteDisabled={deleteDisabled}
      deleteLabel={deleteLabel}
    />
  )
}

export function EditUserModal({
  user,
  onClose,
  onSuccess,
}: {
  user: UserListRow
  onClose: () => void
  onSuccess: (updated: UserListRow) => void
}) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setName(user.name)
    setEmail(user.email)
    setRole(user.role)
    setPassword('')
    setError('')
  }, [user])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await api<UserListRow>(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          email,
          role,
          ...(password.trim() ? { password } : {}),
        }),
      })
      toast('Usuario actualizado')
      onSuccess(updated)
      onClose()
    } catch (caught) {
      const message = reason(caught, 'No se pudo guardar')
      setError(message)
      toast(message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
        <Card>
          <h2 className="font-serif text-xl text-pine">Editar usuario</h2>
          <p className="mt-1 text-sm text-mist">{user.email}</p>
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <Field label="Nombre" required><input className={control} required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Correo" required><input className={control} type="email" required maxLength={160} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Rol" required>
              <select className={control} value={role} onChange={(e) => setRole(e.target.value as UserListRow['role'])}>
                <option value="ADMIN">Administrador</option>
                <option value="GESTOR">Gestor</option>
                <option value="FACTURAS">Carga de facturas</option>
              </select>
            </Field>
            <Field label="Nueva contraseña" hint="Déjala en blanco si no quieres cambiarla.">
              <input className={control} type="password" minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
              <Button type="button" tone="ghost" onClick={onClose}>Cancelar</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
