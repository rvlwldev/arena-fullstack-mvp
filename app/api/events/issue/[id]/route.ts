import { eq } from 'drizzle-orm'
import { db, schema } from '@/app/_lib/db'
import { subscribe, type SseClient } from '@/app/_lib/sse-hub'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, id)).limit(1)
  if (!issue) return new Response('not found', { status: 404 })

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      const client: SseClient = {
        send,
        close() {
          try {
            controller.close()
          } catch {}
        },
      }

      subscribe(id, client, req.signal)
      send('hello', { issueId: id })

      // Railway/proxy idle timeout(보통 60~120s)보다 짧게, 너무 잦지 않게
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`))
        } catch {
          clearInterval(heartbeat)
        }
      }, 45_000)

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
