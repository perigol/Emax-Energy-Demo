'use client'

import { control } from '@/components/shell'

const COUNTRIES: [string, string][] = [
  ['ES', 'España'],
  ['DE', 'Alemania'],
  ['AT', 'Austria'],
  ['BE', 'Bélgica'],
  ['BG', 'Bulgaria'],
  ['CZ', 'Chequia'],
  ['CY', 'Chipre'],
  ['HR', 'Croacia'],
  ['DK', 'Dinamarca'],
  ['SK', 'Eslovaquia'],
  ['SI', 'Eslovenia'],
  ['EE', 'Estonia'],
  ['FI', 'Finlandia'],
  ['FR', 'Francia'],
  ['EL', 'Grecia'],
  ['HU', 'Hungría'],
  ['IE', 'Irlanda'],
  ['XI', 'Irlanda del Norte'],
  ['IT', 'Italia'],
  ['LV', 'Letonia'],
  ['LT', 'Lituania'],
  ['LU', 'Luxemburgo'],
  ['MT', 'Malta'],
  ['NL', 'Países Bajos'],
  ['PL', 'Polonia'],
  ['PT', 'Portugal'],
  ['RO', 'Rumanía'],
  ['SE', 'Suecia'],
]

export function CountrySelect({
  value,
  onChange,
  name,
}: {
  value?: string
  onChange?: (value: string) => void
  name?: string
}) {
  const current = value || 'ES'
  const known = COUNTRIES.some(([code]) => code === current)
  return (
    <select
      className={control}
      name={name}
      value={onChange ? current : undefined}
      defaultValue={onChange ? undefined : current}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
    >
      {!known ? <option value={current}>{current}</option> : null}
      {COUNTRIES.map(([code, label]) => (
        <option key={code} value={code}>
          {code} · {label}
        </option>
      ))}
    </select>
  )
}
