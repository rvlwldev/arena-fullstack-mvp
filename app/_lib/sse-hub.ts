type Channel = Set<WritableStreamDefaultWriter<Uint8Array>>

declare global {
  var __sseChannels: Map<string, Channel> | undefined
}

const channels: Map<string, Channel> = globalThis.__sseChannels ?? new Map()
globalThis.__sseChannels = channels

const encoder = new TextEncoder()

export function subscribe(
  issueId: string,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  signal: AbortSignal,
) {
  const set = channels.get(issueId) ?? new Set()
  set.add(writer)
  channels.set(issueId, set)

  const cleanup = () => {
    set.delete(writer)
    if (set.size === 0) channels.delete(issueId)
  }

  signal.addEventListener('abort', cleanup)
}

export async function broadcast(issueId: string, event: string, data: unknown) {
  const set = channels.get(issueId)
  if (!set || set.size === 0) return
  const payload = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  const dead: WritableStreamDefaultWriter<Uint8Array>[] = []
  await Promise.all(
    Array.from(set).map(async (w) => {
      try {
        await w.write(payload)
      } catch {
        dead.push(w)
      }
    }),
  )
  for (const w of dead) set.delete(w)
}

export function subscriberCount(issueId: string): number {
  return channels.get(issueId)?.size ?? 0
}
