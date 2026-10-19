'use client'

export function RowIconButton({
  label,
  disabled,
  onClick,
  tone = 'default',
  children,
}: {
  label: string
  disabled?: boolean
  onClick?: () => void
  tone?: 'default' | 'danger'
  children: React.ReactNode
}) {
  const tones = {
    default: 'text-mist hover:border-gold hover:text-pine',
    danger: 'text-mist hover:border-clay hover:text-clay',
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-white transition disabled:pointer-events-none disabled:opacity-35 ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

export function EditDeleteRowActions({
  name,
  onEdit,
  onDelete,
  deleteDisabled,
  deleteLabel,
}: {
  name: string
  onEdit: () => void
  onDelete: () => void
  deleteDisabled?: boolean
  deleteLabel?: string
}) {
  const removeHint = deleteLabel || (deleteDisabled ? 'No se puede eliminar' : `Eliminar ${name}`)
  return (
    <div className="flex items-center justify-center gap-1">
      <RowIconButton label={`Editar ${name}`} onClick={onEdit}>
        <EditIcon />
      </RowIconButton>
      <RowIconButton label={removeHint} tone="danger" disabled={deleteDisabled} onClick={onDelete}>
        <TrashIcon />
      </RowIconButton>
    </div>
  )
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l10.5-10.5a1.8 1.8 0 0 0 0-2.5l-1.5-1.5a1.8 1.8 0 0 0-2.5 0L4 16v4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5 17.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 7l.8 12.2A1.5 1.5 0 0 0 9.3 20.5h5.4a1.5 1.5 0 0 0 1.5-1.3L17 7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 10.5v6M14 10.5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
