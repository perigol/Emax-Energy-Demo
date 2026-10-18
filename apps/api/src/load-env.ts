import { existsSync } from 'fs'
import { join } from 'path'

const envPath = join(__dirname, '..', '.env')
if (existsSync(envPath)) {
  process.loadEnvFile(envPath)
}
