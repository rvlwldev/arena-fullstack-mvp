export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSchedulers } = await import('./app/_lib/jobs/scheduler')
    startSchedulers()
  }
}
