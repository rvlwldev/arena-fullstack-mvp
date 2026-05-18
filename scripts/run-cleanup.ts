import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

const { runCleanup } = await import('../app/_lib/jobs/cleanup')
const r = await runCleanup()
console.log(JSON.stringify(r))
process.exit(0)
