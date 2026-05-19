'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Logo } from '@/app/_components/Logo'
import { Button, Card, Pill, StatNumber, StatusBadge, Textarea, Input } from '@/app/_components/ui'
import { RoleBadge, TeamPill } from '@/app/_components/TeamPill'
import { elapsedSecondsSince, formatCountKR, formatHHMMSS, remainingHumanKR } from '@/app/_lib/format'
import { rebuttalLabel } from '@/app/_lib/domain/score'

type Side = 'left' | 'right'
type ArenaRole = Side | 'spectator'
type IssueStatus = 'DRAFT' | 'ACTIVE' | 'RESULT' | 'ARCHIVED' | 'CLEANED'

interface IssueProp {
  id: string
  title: string
  sideALabel: string
  sideASummary: string
  sideBLabel: string
  sideBSummary: string
  opensAt: string
  closesAt: string
  resultAt: string
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
  empathy: number
  dopamine: number
  rebuttal: number
  score: number
  myEmpathy?: boolean
  myDopamine?: boolean
  replies?: ReplyNode[]
  expanded?: boolean
}

interface ReplyNode {
  id: string
  commentId: string
  parentReplyId: string | null
  userId: string
  nickname: string
  side: Side
  body: string
  createdAt: string
  empathy: number
  dopamine: number
  children?: ReplyNode[]
}

interface ChatRow {
  id: number
  userId: string
  nickname: string
  body: string
  createdAt: string
  ban?: { expiresAt: string; memo: string | null } | null
}

interface ResultPayload {
  winnerSide: 'left' | 'right' | 'TIE'
  sideATop3: Array<{ commentId: string; score: number; empathy: number; dopamine: number; rebuttal: number }>
  sideBTop3: Array<{ commentId: string; score: number; empathy: number; dopamine: number; rebuttal: number }>
}

interface Props {
  issue: IssueProp
  me:
    | {
        id: string
        nickname: string
        role: 'USER' | 'ADMIN'
        ban: { expiresAt: string; memo: string | null } | null
      }
    | null
}

const ROLE_STORAGE_KEY = 'bbalparena-side'

function readStoredRole(issueId: string): ArenaRole | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ROLE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, string>
    const v = parsed[issueId]
    if (v === 'left' || v === 'right' || v === 'spectator') return v
    return null
  } catch {
    return null
  }
}

function writeStoredRole(issueId: string, role: ArenaRole) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(ROLE_STORAGE_KEY)
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, ArenaRole>
    parsed[issueId] = role
    window.localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(parsed))
  } catch {}
}

function buildReplyTree(flat: ReplyNode[]): ReplyNode[] {
  const byId = new Map<string, ReplyNode>()
  for (const r of flat) byId.set(r.id, { ...r, children: [] })
  const roots: ReplyNode[] = []
  for (const node of byId.values()) {
    if (node.parentReplyId && byId.has(node.parentReplyId)) {
      byId.get(node.parentReplyId)!.children!.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function countAllReplies(nodes: ReplyNode[] | undefined): number {
  if (!nodes) return 0
  return nodes.reduce((n, c) => n + 1 + countAllReplies(c.children), 0)
}

function uniqueDirectAuthors(nodes: ReplyNode[] | undefined): number {
  if (!nodes) return 0
  const set = new Set<string>()
  for (const n of nodes) set.add(n.userId)
  return set.size
}

export function ArenaBattleClient({ issue, me }: Props) {
  const isActive = issue.derivedStatus === 'ACTIVE'
  const isResult = issue.derivedStatus === 'RESULT'

  const [role, setRole] = useState<ArenaRole | null>(null)
  const [elapsed, setElapsed] = useState(() => elapsedSecondsSince(issue.opensAt))
  const [comments, setComments] = useState<CommentRow[]>([])
  const [chats, setChats] = useState<ChatRow[]>([])
  const [result, setResult] = useState<ResultPayload | null>(null)
  const chatScroll = useRef<HTMLDivElement>(null)
  const [chatBody, setChatBody] = useState('')

  // 진영 로드
  useEffect(() => {
    setRole(readStoredRole(issue.id))
  }, [issue.id])

  // 타이머
  useEffect(() => {
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  // 초기 데이터
  const refreshComments = useCallback(async () => {
    const r = await fetch(`/api/issues/${issue.id}/comments?sort=score`)
    if (!r.ok) return
    const { comments: list } = await r.json()
    setComments(list)
    // 답글도 펼친 의견들만 미리 로드 (toggle 시점에 fetch)
  }, [issue.id])

  const refreshResult = useCallback(async () => {
    const r = await fetch(`/api/issues/${issue.id}/result`)
    if (r.ok) setResult((await r.json()).result)
    else setResult(null)
  }, [issue.id])

  const refreshChats = useCallback(async () => {
    const r = await fetch(`/api/issues/${issue.id}/chats?limit=80`)
    if (r.ok) setChats((await r.json()).chats)
  }, [issue.id])

  useEffect(() => {
    refreshComments()
    refreshChats()
    if (isResult) refreshResult()
  }, [refreshComments, refreshChats, refreshResult, isResult])

  // SSE
  useEffect(() => {
    const es = new EventSource(`/api/events/issue/${issue.id}`)
    es.addEventListener('chat', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as ChatRow
      setChats((prev) => [...prev, d])
    })
    es.addEventListener('comment', (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      if (d.type === 'created') {
        setComments((prev) =>
          prev.find((c) => c.id === d.comment.id)
            ? prev
            : [...prev, { ...d.comment, updatedAt: d.comment.createdAt, replies: [] }],
        )
      } else if (d.type === 'updated') {
        setComments((prev) => prev.map((c) => (c.id === d.comment.id ? { ...c, ...d.comment } : c)))
      } else if (d.type === 'deleted') {
        setComments((prev) => prev.filter((c) => c.id !== d.commentId))
      }
    })
    es.addEventListener('reaction', (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      if (d.targetType === 'comment') {
        setComments((prev) =>
          prev.map((c) =>
            c.id === d.targetId
              ? { ...c, empathy: d.empathy, dopamine: d.dopamine, rebuttal: d.rebuttal, score: d.score }
              : c,
          ),
        )
      } else if (d.targetType === 'reply') {
        setComments((prev) =>
          prev.map((c) => {
            if (!c.replies) return c
            return { ...c, replies: applyReplyReaction(c.replies, d.targetId, d.empathy, d.dopamine) }
          }),
        )
      }
    })
    es.addEventListener('reply', (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      if (d.type === 'created') {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id !== d.reply.commentId) return c
            const replies = c.replies ?? []
            if (replies.find((r) => r.id === d.reply.id)) return c
            const next = [...replies, { ...d.reply, children: [] }]
            return { ...c, replies: rebuildTree(next), expanded: true }
          }),
        )
      } else if (d.type === 'deleted') {
        setComments((prev) =>
          prev.map((c) => {
            if (!c.replies) return c
            return { ...c, replies: removeReply(c.replies, d.replyId) }
          }),
        )
      } else if (d.type === 'updated') {
        setComments((prev) =>
          prev.map((c) => {
            if (!c.replies) return c
            return { ...c, replies: updateReply(c.replies, d.reply) }
          }),
        )
      }
    })
    return () => es.close()
  }, [issue.id])

  useEffect(() => {
    chatScroll.current?.scrollTo({ top: chatScroll.current.scrollHeight, behavior: 'smooth' })
  }, [chats.length])

  const pickRole = (r: ArenaRole) => {
    writeStoredRole(issue.id, r)
    setRole(r)
  }

  const myComment = me ? comments.find((c) => c.userId === me.id) : null

  // 채팅 전송
  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatBody.trim() || !me) return
    if (me.ban) return alert('이용 정지 중이라 채팅 송신 불가')
    if (role === 'spectator') return alert('눈팅충은 채팅 못 단다. 진영부터 골라라.')
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

  // 진영 미선택 + 로그인 상태 → 진영 게이트
  if (!role && me) {
    return (
      <div className="min-h-dvh bg-[var(--arena-bg)]">
        <div className="pointer-events-none fixed inset-0 scanlines opacity-[0.12]" />
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,43,74,0.14),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(47,123,255,0.10),transparent)]" />
        <header className="relative z-20 border-b border-white/10 bg-[#07070c]/92 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Logo />
            <Link href="/" className="text-xs font-black text-white/55 hover:text-white">
              ← 홈
            </Link>
          </div>
        </header>
        <SideGate issue={issue} onPick={pickRole} />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--arena-bg)] text-[var(--arena-text)]">
      <div className="pointer-events-none fixed inset-0 scanlines opacity-[0.12]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,43,74,0.14),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(47,123,255,0.10),transparent)]" />

      <header className="relative z-20 shrink-0 border-b border-white/10 bg-[#07070c]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Logo size="sm" />
          <p className="min-w-0 flex-1 truncate text-center text-[11px] font-black text-white/60 sm:text-xs">
            {issue.sideALabel} <span className="text-white/25">vs</span> {issue.sideBLabel}
          </p>
          <RoleBadge role={role} />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-4 sm:px-6">
        <section className="shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={issue.derivedStatus} />
            {isActive && (
              <span className="font-mono text-xs font-bold text-white/45">
                {formatHHMMSS(elapsed)} 경과
              </span>
            )}
            {isResult && <Pill tone="amber">⏱ 입력 종료 · 결과 노출중</Pill>}
          </div>
          <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
            {issue.title}
          </h1>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Card>
              <TeamPill team="left" label={issue.sideALabel} />
              <p className="mt-2 text-sm font-bold text-white/70">{issue.sideASummary}</p>
            </Card>
            <Card>
              <TeamPill team="right" label={issue.sideBLabel} />
              <p className="mt-2 text-sm font-bold text-white/70">{issue.sideBSummary}</p>
            </Card>
          </div>
        </section>

        {result && (
          <Card className="mt-4 border-amber-500/40 bg-amber-500/10">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-black text-amber-200">결과</h2>
              <span className="text-sm font-black text-amber-100">
                승자:{' '}
                {result.winnerSide === 'TIE' ? (
                  '무승부'
                ) : (
                  <span className={result.winnerSide === 'left' ? 'text-[var(--arena-blue)]' : 'text-[var(--arena-red)]'}>
                    {result.winnerSide === 'left' ? issue.sideALabel : issue.sideBLabel}
                  </span>
                )}
              </span>
              <span className="text-xs font-bold text-white/60">
                L합 {result.sideATop3.reduce((s, c) => s + c.score, 0)} · R합{' '}
                {result.sideBTop3.reduce((s, c) => s + c.score, 0)}
              </span>
            </div>
          </Card>
        )}

        {!me && (
          <Card className="mt-4">
            <p className="text-sm font-bold text-white/70">
              참전하려면{' '}
              <Link href="/login" className="text-white underline">
                로그인
              </Link>{' '}
              또는{' '}
              <Link href="/signup" className="text-white underline">
                가입
              </Link>
            </p>
          </Card>
        )}

        {me && !me.ban && isActive && !myComment && role !== 'spectator' && (
          <CommentForm
            issueId={issue.id}
            role={role}
            arena={issue}
            onCreated={refreshComments}
          />
        )}

        <section className="mt-5 grid gap-3 lg:grid-cols-2">
          <CommentColumn
            side="left"
            label={issue.sideALabel}
            comments={comments.filter((c) => c.side === 'left').sort((a, b) => b.score - a.score)}
            me={me}
            role={role}
            isActive={isActive}
            issueId={issue.id}
            onChanged={refreshComments}
          />
          <CommentColumn
            side="right"
            label={issue.sideBLabel}
            comments={comments.filter((c) => c.side === 'right').sort((a, b) => b.score - a.score)}
            me={me}
            role={role}
            isActive={isActive}
            issueId={issue.id}
            onChanged={refreshComments}
          />
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between gap-2 border-b border-red-500/30 pb-1.5">
            <h2 className="text-base font-black text-white">
              <span className="animate-live-blink text-red-400">●</span> 채팅
            </h2>
            <span className="text-[10px] font-bold text-white/45">{chats.length}개</span>
          </div>
          <Card className="mt-2 p-0 sm:p-0">
            <div
              ref={chatScroll}
              className="h-64 overflow-y-auto rounded-t-xl border-b border-white/10 bg-[#020204] p-3 sm:h-72"
            >
              {chats.length === 0 ? (
                <p className="text-sm font-bold text-white/35">아직 메시지가 없다. 분위기를 깨라.</p>
              ) : (
                chats.map((c) => (
                  <p key={c.id} className="mb-1 text-sm">
                    <span className="font-black text-white/90">{c.nickname}</span>
                    {c.ban && (
                      <span
                        title={c.ban.memo ? `사유: ${c.ban.memo}` : '이용 정지 중'}
                        className="ml-1 inline-flex items-center rounded border border-[var(--arena-red)]/40 bg-[var(--arena-red)]/15 px-1 py-px text-[9px] font-black text-[var(--arena-red)] align-middle"
                      >
                        🚫 {remainingHumanKR(c.ban.expiresAt)}
                      </span>
                    )}
                    <span className="text-white/30"> : </span>
                    <span className="font-bold text-white/80">{c.body}</span>
                  </p>
                ))
              )}
            </div>
            {me && !me.ban && (isActive || isResult) && role !== 'spectator' ? (
              <form onSubmit={sendChat} className="flex gap-2 p-3">
                <Input
                  placeholder={isResult ? '결과 발표 채팅 ㄱㄱ' : '한 줄 박아라'}
                  value={chatBody}
                  onChange={(e) => setChatBody(e.target.value)}
                  maxLength={500}
                />
                <Button type="submit" variant="gradient">
                  전송
                </Button>
              </form>
            ) : (
              <p className="p-3 text-xs font-bold text-white/45">
                {!me
                  ? '로그인하면 채팅 가능'
                  : me.ban
                  ? '🚫 이용 정지 중 — 보기만 가능'
                  : role === 'spectator'
                  ? '눈팅충은 채팅 불가'
                  : '채팅 불가'}
              </p>
            )}
          </Card>
        </section>
      </main>
    </div>
  )
}

function SideGate({ issue, onPick }: { issue: IssueProp; onPick: (r: ArenaRole) => void }) {
  const [picked, setPicked] = useState<ArenaRole | null>(null)
  const choose = (r: ArenaRole) => setPicked(r)
  const confirm = () => {
    if (!picked) return alert('진영 골라라')
    onPick(picked)
  }
  return (
    <div className="mx-auto flex max-w-4xl flex-col px-4 py-6 sm:px-6">
      <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
        전장 입장 전 · 진영 선택
      </p>
      <h1 className="mt-2 text-center text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
        {issue.title}
      </h1>
      <p className="mt-1 text-center text-xs font-bold text-white/55">
        골르면 바로 싸운다. 진영 안 박으면 눈팅충.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SidePickButton
          team="left"
          label={issue.sideALabel}
          summary={issue.sideASummary}
          active={picked === 'left'}
          onClick={() => choose('left')}
        />
        <SpectatorPickButton active={picked === 'spectator'} onClick={() => choose('spectator')} />
        <SidePickButton
          team="right"
          label={issue.sideBLabel}
          summary={issue.sideBSummary}
          active={picked === 'right'}
          onClick={() => choose('right')}
        />
      </div>

      <button
        type="button"
        onClick={confirm}
        className="mt-6 w-full rounded-lg border border-white/20 bg-gradient-to-r from-[var(--arena-red)] via-fuchsia-700/80 to-[var(--arena-blue)] py-3.5 text-sm font-black text-white shadow-[0_8px_32px_-8px_rgba(0,0,0,0.8)] active:scale-[0.99] sm:text-base"
      >
        전장 입장
      </button>
    </div>
  )
}

function SidePickButton({
  team,
  label,
  summary,
  active,
  onClick,
}: {
  team: Side
  label: string
  summary: string
  active: boolean
  onClick: () => void
}) {
  const color = team === 'left' ? 'arena-blue' : 'arena-red'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border-2 p-4 transition ${
        active
          ? `border-[var(--${color})] bg-[var(--${color})]/15 shadow-[0_0_40px_-12px_var(--${color})] ring-1 ring-[var(--${color})]/40`
          : 'border-white/12 bg-white/[0.03] hover:border-white/25'
      }`}
    >
      <p className={`text-[10px] font-black uppercase tracking-widest text-[var(--${color})]`}>
        {team === 'left' ? '좌측 진영' : '우측 진영'}
      </p>
      <p className="mt-2 text-lg font-black text-white sm:text-xl">{label}</p>
      <p className="mt-2 line-clamp-2 text-xs font-bold leading-snug text-white/55">{summary}</p>
      <span
        className={`mt-3 inline-flex w-full items-center justify-center rounded-md py-2 text-xs font-black ${
          active ? `bg-[var(--${color})] text-white` : 'bg-white/8 text-white/70'
        }`}
      >
        {active ? '내 진영' : '이쪽으로 참전'}
      </span>
    </button>
  )
}

function SpectatorPickButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col rounded-xl border-2 border-dashed p-4 text-center transition ${
        active
          ? 'border-white/40 bg-white/[0.07] shadow-[inset_0_0_28px_rgba(255,255,255,0.05)] ring-1 ring-white/20'
          : 'border-white/12 bg-black/35 hover:border-white/25'
      }`}
    >
      <p className="text-lg font-black text-white/90 sm:text-xl">눈팅충</p>
      <p className="mt-1.5 text-[11px] font-bold leading-snug text-white/45">
        양쪽 눈치 보면서 고고한 척
      </p>
      <p className="mt-2 text-[10px] font-bold leading-snug text-white/38">
        댓글 불가 · 반박 불가 · 도파민 불가 · 공감만 가능
      </p>
      <span
        className={`mt-3 inline-flex w-full items-center justify-center rounded-md border border-white/12 py-2 text-xs font-black ${
          active ? 'bg-white/12 text-white' : 'bg-transparent text-white/55'
        }`}
      >
        {active ? '눈팅 중' : '눈팅충 입장'}
      </span>
    </button>
  )
}

function CommentForm({
  issueId,
  role,
  arena,
  onCreated,
}: {
  issueId: string
  role: ArenaRole | null
  arena: IssueProp
  onCreated: () => void
}) {
  const initialSide: Side = role === 'left' || role === 'right' ? role : 'left'
  const [side, setSide] = useState<Side>(initialSide)
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
    <Card className="mt-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">의견 등록 (1인 1회 · 5분 내 수정)</p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={side === 'left' ? 'blue' : 'secondary'}
            onClick={() => setSide('left')}
          >
            {arena.sideALabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={side === 'right' ? 'red' : 'secondary'}
            onClick={() => setSide('right')}
          >
            {arena.sideBLabel}
          </Button>
        </div>
        <Textarea
          rows={3}
          placeholder="한 줄로 전장에 불을 지펴라"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
        />
        <div className="flex justify-end">
          <Button type="submit" variant="gradient" disabled={loading}>
            {loading ? '등록 중...' : '의견 등록'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function CommentColumn({
  side,
  label,
  comments,
  me,
  role,
  isActive,
  issueId,
  onChanged,
}: {
  side: Side
  label: string
  comments: CommentRow[]
  me: Props['me']
  role: ArenaRole | null
  isActive: boolean
  issueId: string
  onChanged: () => void
}) {
  const color = side === 'left' ? 'arena-blue' : 'arena-red'
  return (
    <div className={`rounded-xl border-2 border-[var(--${color})]/45 bg-[var(--${color})]/[0.06] p-2 sm:p-3`}>
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <p className={`text-[10px] font-black uppercase tracking-widest text-[var(--${color})]`}>{label}</p>
        <span className="text-[10px] font-bold text-white/45">{comments.length}개</span>
      </div>
      <div className="mt-2 space-y-2">
        {comments.length === 0 ? (
          <p className="px-2 py-3 text-xs font-bold text-white/40">아직 의견이 없다.</p>
        ) : (
          comments.map((c, i) => (
            <CommentCard
              key={c.id}
              rank={i + 1}
              c={c}
              me={me}
              role={role}
              isActive={isActive}
              issueId={issueId}
              onChanged={onChanged}
            />
          ))
        )}
      </div>
    </div>
  )
}

function CommentCard({
  rank,
  c,
  me,
  role,
  isActive,
  issueId,
  onChanged,
}: {
  rank: number
  c: CommentRow
  me: Props['me']
  role: ArenaRole | null
  isActive: boolean
  issueId: string
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(c.body)
  const [replies, setReplies] = useState<ReplyNode[]>([])
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [replyParent, setReplyParent] = useState<string | null>(null)

  const mine = me?.id === c.userId
  const within5min = Date.now() - new Date(c.createdAt).getTime() < 5 * 60 * 1000
  const isSpectator = role === 'spectator'

  const loadReplies = useCallback(async () => {
    const r = await fetch(`/api/comments/${c.id}/replies`)
    if (!r.ok) return
    const list = (await r.json()).replies as ReplyNode[]
    setReplies(buildReplyTree(list))
    setRepliesLoaded(true)
  }, [c.id])

  const toggleExpand = () => {
    if (!expanded && !repliesLoaded) loadReplies()
    setExpanded((v) => !v)
  }

  // SSE에서 reactions 갱신은 부모(comments state)에서 처리되지만
  // 답글 reactions는 여기서 별도로 받아야 함 → 컴포넌트 분리 단순화: refresh 호출

  const react = async (kind: 'empathy' | 'dopamine') => {
    if (!me) return alert('로그인 필요')
    if (me.ban) return alert('이용 정지 중이라 반응 불가')
    if (mine) return alert('본인 의견에는 반응 불가')
    if (kind === 'dopamine' && isSpectator) return alert('눈팅충은 도파민 불가')
    const res = await fetch(`/api/comments/${c.id}/reactions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, hintRole: role ?? undefined }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '실패')
    }
  }

  const submitReply = async () => {
    if (!me) return alert('로그인 필요')
    if (me.ban) return alert('이용 정지 중이라 답글 불가')
    if (isSpectator) return alert('눈팅충은 답글 불가')
    if (!replyDraft.trim()) return
    const res = await fetch(`/api/comments/${c.id}/replies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        body: replyDraft.trim(),
        parentReplyId: replyParent ?? undefined,
        hintRole: role ?? undefined,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '실패')
      return
    }
    setReplyDraft('')
    setReplyOpen(false)
    setReplyParent(null)
    setExpanded(true)
    await loadReplies()
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
    if (!confirm('삭제할까?')) return
    const res = await fetch(`/api/comments/${c.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '삭제 실패')
      return
    }
    onChanged()
  }

  const badge = rebuttalLabel(c.rebuttal)

  return (
    <article
      className={`rounded-md border bg-black/40 px-2 py-2 ring-1 ring-inset ring-white/5 ${
        rank === 1
          ? 'border-amber-500/40 shadow-[0_0_24px_-8px_rgba(251,191,36,0.35)]'
          : 'border-white/10'
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-px flex size-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-black ${
            rank === 1 ? 'bg-amber-300 text-black' : 'bg-white/10 text-white/70'
          }`}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-xs font-black text-white/90">{c.nickname}</span>
            {badge && (
              <span
                className={`rounded px-1.5 py-px text-[9px] font-black uppercase ring-1 ring-inset ${
                  badge.tier === 3
                    ? 'border-red-500/50 bg-red-950/80 text-red-200'
                    : badge.tier === 2
                    ? 'border-orange-500/45 bg-orange-950/60 text-orange-200'
                    : 'border-amber-500/35 bg-amber-950/50 text-amber-200/90'
                }`}
              >
                {badge.tier === 3 ? '🔥 ' : null}
                {badge.label}
              </span>
            )}
          </div>
          {editing ? (
            <form onSubmit={update} className="mt-1 space-y-2">
              <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="flex gap-1">
                <Button size="sm" variant="gradient" type="submit">
                  저장
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                  취소
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm font-bold leading-snug text-white/85">{c.body}</p>
          )}
          <p className="mt-1 text-[10px] font-bold tabular-nums text-white/45">
            공감 {c.empathy} · 반박 {c.rebuttal} · 도파민 {c.dopamine}
            <span className="ml-2 font-mono text-amber-400/90">점수 {c.score}</span>
          </p>
        </div>
      </div>

      {isActive && (
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => react('empathy')}
            className="whitespace-nowrap rounded bg-white/6 px-2 py-0.5 text-[10px] font-black text-white/70 ring-1 ring-inset ring-white/10 hover:bg-white/12"
          >
            공감 {c.empathy}
          </button>
          {!isSpectator && (
            <button
              type="button"
              onClick={() => react('dopamine')}
              className="whitespace-nowrap rounded bg-white/6 px-2 py-0.5 text-[10px] font-black text-white/70 ring-1 ring-inset ring-white/10 hover:bg-white/12"
            >
              도파민 {c.dopamine}
            </button>
          )}
          {!isSpectator && (
            <button
              type="button"
              onClick={() => {
                setReplyOpen((v) => !v)
                setReplyParent(null)
                setExpanded(true)
                if (!repliesLoaded) loadReplies()
              }}
              className="whitespace-nowrap rounded bg-white/6 px-2 py-0.5 text-[10px] font-black text-white/70 ring-1 ring-inset ring-white/10 hover:bg-white/12"
            >
              반박하기
            </button>
          )}
          {mine && within5min && !editing && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                수정
              </Button>
              <Button size="sm" variant="ghost" onClick={remove}>
                삭제
              </Button>
            </>
          )}
        </div>
      )}

      {c.rebuttal > 0 || replies.length > 0 ? (
        <button
          type="button"
          onClick={toggleExpand}
          className="mt-2 whitespace-nowrap text-[10px] font-black text-white/45 hover:text-white/70"
        >
          {expanded ? '답글 숨기기' : `답글 ${countAllReplies(replies) || c.rebuttal}개 보기`}
        </button>
      ) : null}

      {expanded && replies.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-2">
          {replies.map((node) => (
            <ReplyCard
              key={node.id}
              node={node}
              depth={0}
              issueId={issueId}
              me={me}
              role={role}
              isActive={isActive}
              onChangedReplies={loadReplies}
            />
          ))}
        </div>
      )}

      {replyOpen && (
        <div className="mt-2 rounded border border-amber-500/30 bg-black/50 p-2">
          <p className="text-[10px] font-bold text-amber-200/80">
            {replyParent ? '답글에 답글 달기' : '의견에 반박 달기'}
          </p>
          <Textarea
            rows={2}
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder="한 줄 박아라"
            maxLength={1000}
          />
          <div className="mt-1 flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => {
                setReplyOpen(false)
                setReplyDraft('')
                setReplyParent(null)
              }}
            >
              취소
            </Button>
            <Button size="sm" variant="gradient" type="button" onClick={submitReply}>
              전송
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}

function ReplyCard({
  node,
  depth,
  issueId,
  me,
  role,
  isActive,
  onChangedReplies,
}: {
  node: ReplyNode
  depth: number
  issueId: string
  me: Props['me']
  role: ArenaRole | null
  isActive: boolean
  onChangedReplies: () => void
}) {
  const [openReply, setOpenReply] = useState(false)
  const [draft, setDraft] = useState('')
  const mine = me?.id === node.userId
  const isSpectator = role === 'spectator'

  const react = async (kind: 'empathy' | 'dopamine') => {
    if (!me) return alert('로그인 필요')
    if (me.ban) return alert('이용 정지 중이라 반응 불가')
    if (mine) return alert('본인 답글에는 반응 불가')
    if (kind === 'dopamine' && isSpectator) return alert('눈팅충은 도파민 불가')
    const res = await fetch(`/api/replies/${node.id}/reactions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, hintRole: role ?? undefined }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '실패')
    }
  }

  const submitReply = async () => {
    if (!me || isSpectator) return
    if (me.ban) return alert('이용 정지 중이라 답글 불가')
    if (!draft.trim()) return
    const res = await fetch(`/api/comments/${node.commentId}/replies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        body: draft.trim(),
        parentReplyId: node.id,
        hintRole: role ?? undefined,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '실패')
      return
    }
    setDraft('')
    setOpenReply(false)
    onChangedReplies()
  }

  const chip =
    node.side === 'left'
      ? 'bg-[var(--arena-blue)]/20 text-[var(--arena-blue)] ring-[var(--arena-blue)]/35'
      : 'bg-[var(--arena-red)]/20 text-[var(--arena-red)] ring-[var(--arena-red)]/35'

  return (
    <div className="border-l border-white/10 pl-2" style={{ marginLeft: depth * 12 }}>
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-black text-white/85">{node.nickname}</span>
        <span className={`rounded px-1 py-px text-[9px] font-black ring-1 ring-inset ${chip}`}>
          {node.side === 'left' ? '좌' : '우'}
        </span>
      </div>
      <p className="text-[11px] font-bold leading-snug text-white/75">{node.body}</p>
      <p className="text-[9px] font-bold tabular-nums text-white/40">
        공감 {node.empathy} · 도파민 {node.dopamine}
      </p>
      {isActive && (
        <div className="mt-0.5 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => react('empathy')}
            className="whitespace-nowrap rounded bg-white/6 px-1.5 py-px text-[9px] font-black text-white/65 ring-1 ring-inset ring-white/10"
          >
            공감
          </button>
          {!isSpectator && (
            <>
              <button
                type="button"
                onClick={() => react('dopamine')}
                className="whitespace-nowrap rounded bg-white/6 px-1.5 py-px text-[9px] font-black text-white/65 ring-1 ring-inset ring-white/10"
              >
                도파민
              </button>
              <button
                type="button"
                onClick={() => setOpenReply((v) => !v)}
                className="whitespace-nowrap rounded bg-white/6 px-1.5 py-px text-[9px] font-black text-white/65 ring-1 ring-inset ring-white/10"
              >
                답글
              </button>
            </>
          )}
        </div>
      )}
      {openReply && (
        <div className="mt-1 rounded border border-amber-500/30 bg-black/50 p-2">
          <Textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="답글" />
          <div className="mt-1 flex justify-end gap-1">
            <Button size="sm" variant="ghost" type="button" onClick={() => setOpenReply(false)}>
              취소
            </Button>
            <Button size="sm" variant="gradient" type="button" onClick={submitReply}>
              전송
            </Button>
          </div>
        </div>
      )}
      {node.children && node.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <ReplyCard
              key={child.id}
              node={child}
              depth={depth + 1}
              issueId={issueId}
              me={me}
              role={role}
              isActive={isActive}
              onChangedReplies={onChangedReplies}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// SSE에서 받은 reaction 갱신을 답글 트리에 반영
function applyReplyReaction(nodes: ReplyNode[], targetId: string, empathy: number, dopamine: number): ReplyNode[] {
  return nodes.map((n) => {
    if (n.id === targetId) return { ...n, empathy, dopamine }
    if (n.children && n.children.length > 0)
      return { ...n, children: applyReplyReaction(n.children, targetId, empathy, dopamine) }
    return n
  })
}

function removeReply(nodes: ReplyNode[], targetId: string): ReplyNode[] {
  return nodes
    .filter((n) => n.id !== targetId)
    .map((n) => (n.children ? { ...n, children: removeReply(n.children, targetId) } : n))
}

function updateReply(nodes: ReplyNode[], updated: ReplyNode): ReplyNode[] {
  return nodes.map((n) => {
    if (n.id === updated.id) return { ...n, ...updated, children: n.children }
    if (n.children) return { ...n, children: updateReply(n.children, updated) }
    return n
  })
}

function rebuildTree(flat: ReplyNode[]): ReplyNode[] {
  // flat 리스트가 일부만 있을 수 있어서 단순 재배치
  return buildReplyTree(flat)
}
