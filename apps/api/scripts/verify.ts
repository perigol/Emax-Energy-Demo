import { existsSync } from 'fs'
import { join } from 'path'
import { runSeed } from '../src/seed/run'

const envPath = join(__dirname, '..', '.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

const base = process.env.API_URL || 'http://localhost:3002'

async function login(email: string) {
  const response = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' }),
  })
  if (!response.ok) throw new Error(`Login ${email} respondió ${response.status}`)
  const data = (await response.json()) as { accessToken: string }
  return data.accessToken
}

async function get(path: string, token: string) {
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json().catch(() => ({}))
  return { status: response.status, body }
}

async function main() {
  const admin = await login('admin@norteluz.es')
  const before = await get('/tax/303?year=2026&quarter=1', admin)
  const modelo = before.body as { devengado: number; deducible: number; resultado: number }
  if (before.status !== 200 || modelo.devengado !== 252 || modelo.deducible !== 126 || modelo.resultado !== 126) {
    throw new Error(`El T1 no cuadra: ${JSON.stringify(before.body)}`)
  }

  const contacts = await get('/contacts', admin)
  const taller = (contacts.body as { id: string; name: string }[]).find((item) => item.name.startsWith('Taller'))
  if (!taller) throw new Error('No está el cliente de demo')

  const created = await fetch(`${base}/issued-invoices`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contactId: taller.id,
      issueDate: '2026-02-21',
      operation: 'NACIONAL',
      issue: true,
      lines: [{ concept: 'Prueba de cierre', quantity: 1, unitPrice: 100, vatRate: 21 }],
    }),
  })
  if (!created.ok) throw new Error(`No se pudo emitir la prueba: ${created.status}`)

  const after = await get('/tax/303?year=2026&quarter=1', admin)
  const moved = after.body as { devengado: number }
  if (moved.devengado !== 273) {
    throw new Error(`Al sumar 21 de IVA el devengado quedó en ${moved.devengado}`)
  }

  const facturas = await login('facturas@norteluz.es')
  const denied = await get('/tax/303?year=2026&quarter=1', facturas)
  if (denied.status !== 403) throw new Error(`El rol Facturas recibió ${denied.status} en impuestos`)

  await runSeed({ force: true })
  const restored = await get('/tax/303?year=2026&quarter=1', admin)
  const back = restored.body as { devengado: number }
  if (back.devengado !== 252) throw new Error('El reseed no restauró el T1')

  console.log('Verificación correcta: T1 126, alta de prueba 273, rol Facturas 403, seed restaurado.')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
