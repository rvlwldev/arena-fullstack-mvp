import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

const { computeMissingResults } = await import('../app/_lib/jobs/compute-results')
const r = await computeMissingResults()
console.log(JSON.stringify(r))
process.exit(0)
