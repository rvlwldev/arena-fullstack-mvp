'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Pill, Textarea, Input } from '@/app/_components/ui'

type Side = 'A' | 'B'
type IssueStatus = 'DRAFT' | 'ACTIVE' | 'RESULT' | 'ARCHIVED' | 'CLEANED'

interface IssueProp {
  id: string
  title: string
  sideALabel: string
  sideASummary: string
  sideBLabel: string
  sideBSummary: string
  opensAt: string | Date
  closesAt: string | Date
  resultAt: string | Date
  status: IssueStatus
  derivedStatus: IssueStatus
}

interface CommentRow {
  id: string
  userId: string
  nickname: string
  side: Side
  body: string
  createdAt: string
  updatedAt: string
  likes: number
  dislikes: number
  score: number
}

interface ChatRow {
  id: number
  userId: string
  nickname: string
  body: string
  createdAt: string
}

interface ResultPayload {
  winnerSide: 'A' | 'B' | 'TIE'
  sideATop3: Array<{ commentId: string; score: number; likes: number; dislikes: number }>
  sideBTop3: Array<{ commentId: string; score: number; likes: number; dislikes: number }>
}

interface Props {
  issue: IssueProp
  me: { id: string; nickname: string; role: 'USER' | 'ADMIN' } | null
}

export function IssueDetailClient({ issue, me }: Props) {
  const isActive = issue.derivedStatus === 'ACTIVE'
  const [comments, setComments] = useState<CommentRow[]>([])
  const [chats, setChats] = useState<ChatRow[]>([])
  const [result, setResult] = useState<ResultPayload | null>(null)
  const [chatBody, setChatBody] = useState('')
  const chatScroll = useRef<HTMLDivElement>(null)

  const refreshComments = useCallback(async () => {
    const res = await fetch(`/api/issues/${issue.id}/comments?sort=score`)
    if (res.ok) setComments((await res.json()).comments)
  }, [issue.id])

  const refreshChats = useCallback(async () => {
    const res = await fetch(`/api/issues/${issue.id}/chats?limit=50`)
    if (res.ok) setChats((await res.json()).chats)
  }, [issue.id])

  const refreshResult = useCallback(async () => {
    const res = await fetch(`/api/issues/${issue.id}/result`)
    if (res.ok) setResult((await res.json()).result)
    else setResult(null)
  }, [issue.id])

  useEffect(() => {
    refreshComments()
    refreshChats()
    if (issue.derivedStatus === 'RESULT') refreshResult()
  }, [refreshComments, refreshChats, refreshResult, issue.derivedStatus])

  // SSE
  useEffect(() => {
    const es = new EventSource(`/api/events/issue/${issue.id}`)
    es.addEventListener('chat', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setChats((prev) => [...prev, data])
    })
    es.addEventListener('comment', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      if (data.type === 'created') {
        setComments((prev) =>
          prev.find((c) => c.id === data.comment.id)
            ? prev
            : [...prev, { ...data.comment, updatedAt: data.comment.createdAt }],
        )
      } else if (data.type === 'updated') {
        setComments((prev) => prev.map((c) => (c.id === data.comment.id ? { ...c, ...data.comment } : c)))
      } else if (data.type === 'deleted') {
        setComments((prev) => prev.filter((c) => c.id !== data.commentId))
      }
    })
    es.addEventListener('vote', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setComments((prev) =>
        prev.map((c) =>
          c.id === data.commentId
            ? { ...c, likes: data.likes, dislikes: data.dislikes, score: data.score }
            : c,
        ),
      )
    })
    return () => es.close()
  }, [issue.id])

  // chat scroll
  useEffect(() => {
    chatScroll.current?.scrollTo({ top: chatScroll.current.scrollHeight })
  }, [chats.length])

  const sideA = useMemo(() => comments.filter((c) => c.side === 'A').sort((x, y) => y.score - x.score), [comments])
  const sideB = useMemo(() => comments.filter((c) => c.side === 'B').sort((x, y) => y.score - x.score), [comments])

  const myComment = me ? comments.find((c) => c.userId === me.id) : null

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatBody.trim()) return
    const body = chatBody.trim()
    setChatBody('')
    const res = await fetch(`/api/issues/${issue.id}/chats`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '채팅 전송 실패')
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{issue.title}</h1>
          <Pill tone="neutral">{issue.derivedStatus}</Pill>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card>
            <Pill tone="A">{issue.sideALabel}</Pill>
            <p className="mt-2 text-sm text-neutral-700">{issue.sideASummary}</p>
          </Card>
          <Card>
            <Pill tone="B">{issue.sideBLabel}</Pill>
            <p className="mt-2 text-sm text-neutral-700">{issue.sideBSummary}</p>
          </Card>
        </div>
      </header>

      {result && (
        <Card className="border-amber-300 bg-amber-50">
          <h2 className="text-lg font-semibold">결과</h2>
          <p className="mt-1">
            승자:{' '}
            <Pill tone={result.winnerSide === 'A' ? 'A' : result.winnerSide === 'B' ? 'B' : 'neutral'}>
              {result.winnerSide === 'TIE' ? '무승부' : result.winnerSide}
            </Pill>
          </p>
          <p className="mt-2 text-sm text-neutral-700">
            A TOP3 합계: {result.sideATop3.reduce((s, c) => s + c.score, 0)} / B TOP3 합계:{' '}
            {result.sideBTop3.reduce((s, c) => s + c.score, 0)}
          </p>
        </Card>
      )}

      {me && isActive && !myComment && (
        <CommentForm issueId={issue.id} onCreated={refreshComments} />
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <CommentList
          side="A"
          comments={sideA}
          me={me}
          isActive={isActive}
          onChanged={refreshComments}
        />
        <CommentList
          side="B"
          comments={sideB}
          me={me}
          isActive={isActive}
          onChanged={refreshComments}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">실시간 채팅</h2>
        <Card>
          <div
            ref={chatScroll}
            className="h-80 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-3"
          >
            {chats.length === 0 ? (
              <p className="text-sm text-neutral-500">아직 메시지가 없습니다.</p>
            ) : (
              chats.map((c) => (
                <p key={c.id} className="mb-1 text-sm">
                  <span className="font-semibold text-neutral-700">{c.nickname}</span>:{' '}
                  <span className="text-neutral-800">{c.body}</span>
                </p>
              ))
            )}
          </div>
          {me && isActive ? (
            <form onSubmit={sendChat} className="mt-3 flex gap-2">
              <Input
                placeholder="메시지를 입력하세요"
                value={chatBody}
                onChange={(e) => setChatBody(e.target.value)}
                maxLength={500}
              />
              <Button type="submit">전송</Button>
            </form>
          ) : !me ? (
            <p className="mt-3 text-sm text-neutral-500">로그인하면 채팅에 참여할 수 있습니다.</p>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">진행 중인 이슈가 아닙니다.</p>
          )}
        </Card>
      </section>
    </div>
  )
}

function CommentForm({ issueId, onCreated }: { issueId: string; onCreated: () => void }) {
  const [side, setSide] = useState<Side>('A')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setLoading(true)
    const res = await fetch(`/api/issues/${issueId}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ side, body: body.trim() }),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '의견 등록 실패')
      return
    }
    setBody('')
    onCreated()
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">의견 등록 (1인 1회, 5분 내 수정 가능)</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={side === 'A' ? 'danger' : 'secondary'}
            onClick={() => setSide('A')}
          >
            A 진영
          </Button>
          <Button
            type="button"
            size="sm"
            variant={side === 'B' ? 'primary' : 'secondary'}
            onClick={() => setSide('B')}
            className={side === 'B' ? 'bg-blue-600 hover:bg-blue-700' : undefined}
          >
            B 진영
          </Button>
        </div>
        <Textarea
          rows={4}
          placeholder="당신의 의견을 적어주세요"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
        />
        <Button type="submit" disabled={loading}>
          {loading ? '등록 중...' : '등록'}
        </Button>
      </form>
    </Card>
  )
}

function CommentList({
  side,
  comments,
  me,
  isActive,
  onChanged,
}: {
  side: Side
  comments: CommentRow[]
  me: Props['me']
  isActive: boolean
  onChanged: () => void
}) {
  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">
        <Pill tone={side}>{side} 진영</Pill>
        <span className="ml-2 text-sm font-normal text-neutral-500">{comments.length}개</span>
      </h2>
      <div className="space-y-2">
        {comments.length === 0 ? (
          <Card>
            <p className="text-sm text-neutral-500">아직 의견이 없습니다.</p>
          </Card>
        ) : (
          comments.map((c) => (
            <CommentCard key={c.id} c={c} me={me} isActive={isActive} onChanged={onChanged} />
          ))
        )}
      </div>
    </div>
  )
}

function CommentCard({
  c,
  me,
  isActive,
  onChanged,
}: {
  c: CommentRow
  me: Props['me']
  isActive: boolean
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(c.body)

  const vote = async (value: 1 | -1) => {
    if (!me) return alert('로그인이 필요합니다.')
    const res = await fetch(`/api/comments/${c.id}/vote`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '투표 실패')
    }
  }

  const cancelVote = async () => {
    const res = await fetch(`/api/comments/${c.id}/vote`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '취소 실패')
    }
  }

  const update = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch(`/api/comments/${c.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '수정 실패')
      return
    }
    setEditing(false)
    onChanged()
  }

  const remove = async () => {
    if (!confirm('삭제하시겠어요?')) return
    const res = await fetch(`/api/comments/${c.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '삭제 실패')
      return
    }
    onChanged()
  }

  const mine = me?.id === c.userId
  const within5min = Date.now() - new Date(c.createdAt).getTime() < 5 * 60 * 1000

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs text-neutral-500">{c.nickname}</p>
          {editing ? (
            <form onSubmit={update} className="mt-2 space-y-2">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
              <div className="flex gap-2">
                <Button size="sm" type="submit">
                  저장
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                  취소
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-neutral-900">{c.score}</p>
          <p className="text-xs text-neutral-500">+{c.likes} / -{c.dislikes}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {isActive && !mine && (
            <>
              <Button size="sm" variant="secondary" onClick={() => vote(1)}>
                👍
              </Button>
              <Button size="sm" variant="secondary" onClick={() => vote(-1)}>
                👎
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelVote}>
                취소
              </Button>
            </>
          )}
        </div>
        {mine && isActive && within5min && !editing && (
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              수정
            </Button>
            <Button size="sm" variant="danger" onClick={remove}>
              삭제
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
