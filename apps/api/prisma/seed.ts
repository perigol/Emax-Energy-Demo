import { existsSync } from 'fs'
import { join } from 'path'
import { runSeed } from '../src/seed/run'

const envPath = join(__dirname, '..', '.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

runSeed({
  force: process.argv.includes('--force') || process.env.SEED_FORCE === 'true',
})
  .then((result) => {
    console.log(result.seeded ? 'Seed aplicado' : 'Seed omitido: ya hay usuarios. Usa --force para rehacerlo.')
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
