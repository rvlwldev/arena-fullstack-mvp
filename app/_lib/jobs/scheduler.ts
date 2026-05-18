import cron from 'node-cron'
import { runStatusTransitions } from './transitions'
import { computeMissingResults } from './compute-results'
import { runCleanup } from './cleanup'

declare global {
  var __cronStarted: boolean | undefined
}

export function startSchedulers() {
  if (globalThis.__cronStarted) return
  globalThis.__cronStarted = true

  cron.schedule('* * * * *', async () => {
    try {
      const t = await runStatusTransitions()
      if (t.toActive || t.toResult || t.toArchived) {
        console.log(
          `[cron:status] active=${t.toActive} result=${t.toResult} archived=${t.toArchived}`,
        )
      }
      if (t.toResult > 0) {
        const r = await computeMissingResults()
        if (r.computed > 0) console.log(`[cron:compute-results] computed=${r.computed}`)
      }
    } catch (e) {
      console.error('[cron:status] failed', e)
    }
  })

  cron.schedule('0 * * * *', async () => {
    try {
      const r = await runCleanup()
      if (r.cleaned > 0) console.log(`[cron:cleanup] cleaned=${r.cleaned}`)
    } catch (e) {
      console.error('[cron:cleanup] failed', e)
    }
  })

  console.log('[cron] scheduler started')
}
