import cron from 'node-cron'
import { runStatusTransitions } from './transitions'

declare global {
  var __cronStarted: boolean | undefined
}

export function startSchedulers() {
  if (globalThis.__cronStarted) return
  globalThis.__cronStarted = true

  cron.schedule('* * * * *', async () => {
    try {
      const r = await runStatusTransitions()
      if (r.toActive || r.toResult || r.toArchived) {
        console.log(`[cron:status-transitions] active=${r.toActive} result=${r.toResult} archived=${r.toArchived}`)
      }
    } catch (e) {
      console.error('[cron:status-transitions] failed', e)
    }
  })

  console.log('[cron] scheduler started')
}
