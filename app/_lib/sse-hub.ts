type Channel = Set<SseClient>

export interface SseClient {
  send(event: string, data: unknown): void
  close(): void
}

declare global {
  var __sseChannels: Map<string, Channel> | undefined
}

const channels: Map<string, Channel> = globalThis.__sseChannels ?? new Map()
globalThis.__sseChannels = channels

export function subscribe(issueId: string, client: SseClient, signal: AbortSignal) {
  const set = channels.get(issueId) ?? new Set()
  set.add(client)
  channels.set(issueId, set)
  signal.addEventListener('abort', () => {
    set.delete(client)
    if (set.size === 0) channels.delete(issueId)
  })
}

export function broadcast(issueId: string, event: string, data: unknown) {
  const set = channels.get(issueId)
  if (!set || set.size === 0) return
  for (const c of set) {
    try {
      c.send(event, data)
    } catch {
      set.delete(c)
    }
  }
}

export function subscriberCount(issueId: string): number {
  return channels.get(issueId)?.size ?? 0
}
