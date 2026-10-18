'use client'

import { useState } from 'react'
import { Card, control } from '@/components/shell'

export type SortValue = string | number

export interface Column<T> {
  key: string
  label: string
  align?: 'right'
  sortable?: boolean
  first?: 'asc' | 'desc'
  value?: (row: T) => SortValue
  cell: (row: T) => React.ReactNode
}

function fold(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function matches(haystack: string, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  const text = fold(haystack)
  return needle.split(/\s+/).every((token) => text.includes(token))
}

function compare(a: SortValue, b: SortValue) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' })
}

export function Listing<T>({
  rows,
  columns,
  haystack,
  rowKey,
  placeholder,
  framed = true,
}: {
  rows: T[]
  columns: Column<T>[]
  haystack: (row: T) => string
  rowKey: (row: T) => string
  placeholder: string
  framed?: boolean
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const found = rows.filter((row) => matches(haystack(row), query))
  const column = columns.find((item) => item.key === sort?.key && item.sortable !== false && item.value)
  const visible = column
    ? [...found].sort((a, b) => {
        const result = compare(column.value!(a), column.value!(b))
        return sort?.dir === 'asc' ? result : -result
      })
    : found

  function toggle(item: Column<T>) {
    if (item.sortable === false || !item.value) return
    setPage(1)
    setSort((current) => {
      if (current?.key !== item.key) return { key: item.key, dir: item.first ?? 'asc' }
      return { key: item.key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
    })
  }

  const pages = Math.max(1, Math.ceil(visible.length / pageSize))
  const current = Math.min(page, pages)
  const start = (current - 1) * pageSize
  const slice = visible.slice(start, start + pageSize)

  const searching = query.trim().length > 0
  const count =
    visible.length === 1 ? '1 coincidencia' : `${visible.length} coincidencias`

  const body = (
    <div>
      <div className={framed ? 'border-b border-line px-5 py-3' : 'border-b border-line px-5 py-3'}>
        <label className="block">
          <span className="sr-only">Buscar</span>
          <input
            className={control}
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </label>
        {searching ? <p className="mt-2 text-xs text-mist">{visible.length === 0 ? 'Ninguna coincidencia' : count}</p> : null}
      </div>
      {visible.length === 0 && searching ? (
        <p className="px-5 py-8 text-center text-sm text-mist">Ninguna fila coincide con la búsqueda.</p>
      ) : null}
      {visible.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="book spread">
            <thead className="border-b border-line text-mist">
              <tr>
                {columns.map((item) => {
                  const active = sort?.key === item.key
                  const sortable = item.sortable !== false && Boolean(item.value)
                  return (
                    <th
                      key={item.key}
                      className="px-3 py-3 text-center font-medium"
                      aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : sortable ? 'none' : undefined}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggle(item)}
                          className={`inline-flex items-center justify-center gap-1.5 ${active ? 'text-pine' : ''}`}
                        >
                          {item.label}
                          <SortMark active={active} dir={sort?.dir} />
                        </button>
                      ) : (
                        item.label
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={rowKey(row)} className="border-b border-line last:border-0">
                  {columns.map((item) => (
                    <td key={item.key} className={`px-3 py-3.5 text-center ${item.align === 'right' ? 'tabular' : ''}`}>
                      {item.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {visible.length > pageSize ? (
        <nav className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm" aria-label="Páginas">
          <p className="text-mist">
            {start + 1}–{start + slice.length} de {visible.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-line bg-white px-3 py-1 disabled:opacity-40"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Anterior
            </button>
            <span className="tabular text-mist">{current} / {pages}</span>
            <button
              type="button"
              className="rounded-md border border-line bg-white px-3 py-1 disabled:opacity-40"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Siguiente
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  )

  if (!framed) return body
  return <Card className="overflow-hidden p-0">{body}</Card>
}

function SortMark({ active, dir }: { active: boolean; dir?: 'asc' | 'desc' }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={active ? 'text-pine' : 'text-mist/50'}>
      <path d="M2.5 4.5 6 1.5 9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity={!active || dir === 'asc' ? 1 : 0.3} />
      <path d="M2.5 7.5 6 10.5 9.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity={!active || dir === 'desc' ? 1 : 0.3} />
    </svg>
  )
}
