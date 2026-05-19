'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Pill } from '@/app/_components/ui'
import { TeamPill } from '@/app/_components/TeamPill'
import { BanActionModal, type BanTarget } from '@/app/_components/BanActionModal'
import { remainingHumanKR } from '@/app/_lib/format'

type Tab = 'chats' | 'comments'

interface BanRef {
  expiresAt: string
  memo: string | null
}

interface ChatLog {
  id: number
  userId: string
  nickname: string
  email: string
  body: string
  createdAt: string
  deletedAt: string | null
  ban: BanRef | null
}

interface CommentLog {
  id: string
  userId: string
  nickname: string
  email: string
  side: 'left' | 'right'
  body: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  ban: BanRef | null
}

interface ReplyLog {
  id: string
  commentId: string
  parentReplyId: string | null
  userId: string
  nickname: string
  email: string
  side: 'left' | 'right'
  body: string
  createdAt: string
  deletedAt: string | null
  ban: BanRef | null
}

export function IssueLogsClient({ issueId }: { issueId: string }) {
  const [tab, setTab] = useState<Tab>('chats')
  const [chats, setChats] = useState<ChatLog[] | null>(null)
  const [comments, setComments] = useState<CommentLog[] | null>(null)
  const [replies, setReplies] = useState<ReplyLog[] | null>(null)
  const [target, setTarget] = useState<BanTarget | null>(null)

  const load = useCallback(async () => {
    if (tab === 'chats') {
      const r = await fetch(`/api/admin/issues/${issueId}/logs?type=chats`)
      if (r.ok) setChats((await r.json()).chats)
    } else {
      const r = await fetch(`/api/admin/issues/${issueId}/logs?type=comments`)
      if (r.ok) {
        const d = await r.json()
        setComments(d.comments)
        setReplies(d.replies)
      }
    }
  }, [issueId, tab])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="mt-5 space-y-3">
      <div className="flex gap-1 border-b border-white/10 pb-1">
        <TabButton active={tab === 'chats'} onClick={() => setTab('chats')}>
          채팅
        </TabButton>
        <TabButton active={tab === 'comments'} onClick={() => setTab('comments')}>
          의견·답글
        </TabButton>
      </div>

      {tab === 'chats' && (chats ? <ChatsList chats={chats} onBan={setTarget} /> : <p className="p-3 text-sm font-bold text-white/45">로딩 중...</p>)}

      {tab === 'comments' &&
        (comments ? (
          <CommentsList comments={comments} replies={replies ?? []} onBan={setTarget} />
        ) : (
          <p className="p-3 text-sm font-bold text-white/45">로딩 중...</p>
        ))}

      {target && (
        <BanActionModal
          target={target}
          onClose={() => setTarget(null)}
          onApplied={() => {
            alert(`${target.nickname} 밴 적용 완료`)
            load()
          }}
        />
      )}
    </div>
  )
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-md px-3 py-1.5 text-xs font-black transition ${
        active ? 'bg-white/12 text-white ring-1 ring-white/20' : 'text-white/55 hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}

function BanLabel({ ban }: { ban: BanRef | null }) {
  if (!ban) return null
  return (
    <span
      title={ban.memo ? `사유: ${ban.memo}` : '이용 정지 중'}
      className="ml-1 rounded border border-[var(--arena-red)]/40 bg-[var(--arena-red)]/15 px-1.5 py-px text-[9px] font-black text-[var(--arena-red)]"
    >
      🚫 {remainingHumanKR(ban.expiresAt)}
    </span>
  )
}

function ChatsList({ chats, onBan }: { chats: ChatLog[]; onBan: (t: BanTarget) => void }) {
  if (chats.length === 0) {
    return (
      <Card>
        <p className="text-sm font-bold text-white/45">채팅 없음</p>
      </Card>
    )
  }
  // 오래된 순으로 보이도록 reverse
  const ordered = chats.slice().reverse()
  return (
    <Card className="max-h-[60vh] overflow-y-auto">
      <ul className="space-y-1.5">
        {ordered.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-3 rounded border border-white/[0.06] bg-black/30 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs font-black text-white/90">{c.nickname}</span>
                <BanLabel ban={c.ban} />
                {c.deletedAt && <Pill tone="neutral">삭제됨</Pill>}
                <span className="font-mono text-[9px] text-white/35">
                  {new Date(c.createdAt).toLocaleString('ko-KR')}
                </span>
              </div>
              <p className={`mt-0.5 text-sm font-bold ${c.deletedAt ? 'text-white/35 line-through' : 'text-white/80'}`}>
                {c.body}
              </p>
            </div>
            <Button size="sm" variant="danger" onClick={() => onBan({ userId: c.userId, nickname: c.nickname })}>
              밴
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function CommentsList({
  comments,
  replies,
  onBan,
}: {
  comments: CommentLog[]
  replies: ReplyLog[]
  onBan: (t: BanTarget) => void
}) {
  const repliesByComment = new Map<string, ReplyLog[]>()
  for (const r of replies) {
    const list = repliesByComment.get(r.commentId) ?? []
    list.push(r)
    repliesByComment.set(r.commentId, list)
  }
  return (
    <Card className="max-h-[70vh] overflow-y-auto">
      {comments.length === 0 ? (
        <p className="text-sm font-bold text-white/45">의견 없음</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded border border-white/10 bg-black/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <TeamPill team={c.side} label={c.side === 'left' ? '좌' : '우'} />
                    <span className="text-xs font-black text-white/90">{c.nickname}</span>
                    <BanLabel ban={c.ban} />
                    {c.deletedAt && <Pill tone="neutral">삭제됨</Pill>}
                    <span className="font-mono text-[9px] text-white/35">
                      {new Date(c.createdAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <p className={`mt-1 text-sm font-bold ${c.deletedAt ? 'text-white/35 line-through' : 'text-white/85'}`}>
                    {c.body}
                  </p>
                </div>
                <Button size="sm" variant="danger" onClick={() => onBan({ userId: c.userId, nickname: c.nickname })}>
                  밴
                </Button>
              </div>
              {(repliesByComment.get(c.id) ?? []).length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-white/10 pt-2">
                  {(repliesByComment.get(c.id) ?? []).map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-2 rounded border border-white/[0.06] bg-black/20 px-2 py-1.5"
                      style={{ marginLeft: r.parentReplyId ? 16 : 0 }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] font-black text-white/80">↳ {r.nickname}</span>
                          <BanLabel ban={r.ban} />
                          {r.deletedAt && <Pill tone="neutral">삭제됨</Pill>}
                          <span className="font-mono text-[9px] text-white/35">
                            {new Date(r.createdAt).toLocaleString('ko-KR')}
                          </span>
                        </div>
                        <p className={`text-[12px] font-bold ${r.deletedAt ? 'text-white/30 line-through' : 'text-white/75'}`}>
                          {r.body}
                        </p>
                      </div>
                      <Button size="sm" variant="danger" onClick={() => onBan({ userId: r.userId, nickname: r.nickname })}>
                        밴
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
