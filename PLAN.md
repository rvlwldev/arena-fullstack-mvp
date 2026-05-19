# RED BLUE ARENA — 개발 계획

> REQUIRED.md 기반 MVP 설계 합의안. 이 문서는 구현의 출발점이며, 결정의 근거를 함께 남긴다.
>
> **버전**: v1 (초기 합의, 2026-05-18) → **v2 (빨파레나 디자인 도입, 2026-05-19)** ← 이 문서 하단 §V2 참조

---

## 1. 제약과 전제

- **타겟 규모**: 동시 접속 50명 이하 (MVP 검증용)
- **인프라**: Railway Free Plan — 1 vCPU / 0.5 GB RAM / 0.5 GB Storage
- **배포 토폴로지**: 단일 Web Service + Postgres 플러그인 (총 2개 서비스)

자원이 매우 제한적이므로 모든 설계 결정은 메모리·스토리지 절약을 우선한다.

---

## 2. 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | **Next.js 15 (App Router)** | UI/API/SSE를 단일 컨테이너에서 처리 → Free Plan 자원 절약 |
| 언어 | TypeScript | 도메인 모델 안전성 |
| DB | **PostgreSQL** (Railway 플러그인) | 표준·운영 편의, Free 범위 내 충분 |
| ORM | **Drizzle** | 가벼움, SQL 친화, 타입 강력 |
| 인증 | 자체 이메일/패스워드 + JWT | 외부 OAuth 의존 제거 |
| 실시간 | **SSE** (Server-Sent Events) | WebSocket보다 가볍고 Route Handler에 자연스럽게 매핑 |
| UI | **Tailwind CSS + shadcn/ui** | 빠른 프로토타입 + 일관된 디자인 |
| 스케줄러 | **node-cron** (앱 내 구동) | 추가 서비스 없이 cron 처리 |
| 패스워드 해시 | argon2 (또는 bcrypt) | 단방향 안전 저장 |
| 관측 | Railway 기본 로그만 | MVP는 관측 최소화 |
| 테스트 | 없음 (MVP) | 추후 이슈 발생 시 도입 |

---

## 3. 도메인 모델

### 3.1 엔티티

```
User
  id              uuid pk
  email           text unique
  password_hash   text
  nickname        text unique
  role            enum('USER','ADMIN')
  created_at      timestamptz
  banned_at       timestamptz?      -- 영구 비활성화(법적/스팸). 일반 밴은 Sanction 사용

Issue
  id              uuid pk
  title           text
  side_a_label    text              -- 예: "남자가 더 살기 좋다"
  side_a_summary  text
  side_b_label    text
  side_b_summary  text
  opens_at        timestamptz       -- 노출/입장 시작
  closes_at       timestamptz       -- 채팅·의견·투표 마감 = 점수 계산 시점
  result_at       timestamptz       -- 결과 노출 종료 → ARCHIVED 전이
  status          enum('DRAFT','ACTIVE','RESULT','ARCHIVED','CLEANED')
  created_at      timestamptz

Comment  (= 사용자 의견, 이슈당 1인 1개)
  id              uuid pk
  issue_id        uuid fk
  user_id         uuid fk
  side            enum('A','B')
  body            text
  created_at      timestamptz
  updated_at      timestamptz
  deleted_at      timestamptz?
  UNIQUE(issue_id, user_id)

Vote
  id              uuid pk
  comment_id      uuid fk
  user_id         uuid fk
  value           smallint          -- +1 | -1
  created_at      timestamptz
  updated_at      timestamptz
  UNIQUE(comment_id, user_id)

Chat
  id              bigserial pk
  issue_id        uuid fk
  user_id         uuid fk
  body            text
  created_at      timestamptz
  deleted_at      timestamptz?

IssueResult
  id              uuid pk
  issue_id        uuid fk unique
  winner_side     enum('A','B','TIE')
  side_a_top3     jsonb             -- [{comment_id, score, likes, dislikes}, ...]
  side_b_top3     jsonb
  computed_at     timestamptz

Sanction       (= 기간 밴)
  id              uuid pk
  user_id         uuid fk
  type            enum('BAN')       -- 추후 확장 여지
  starts_at       timestamptz
  expires_at      timestamptz       -- 필수
  memo            text?             -- 선택
  by_admin_id     uuid fk
  lifted_at       timestamptz?      -- 조기 해제
  created_at      timestamptz
  INDEX(user_id, expires_at DESC)

RefreshToken
  id              uuid pk
  user_id         uuid fk
  token_hash      text              -- 원본은 클라이언트만, 서버는 해시 보관
  expires_at      timestamptz
  revoked_at      timestamptz?
  user_agent      text?
  created_at      timestamptz
  INDEX(user_id), INDEX(token_hash)
```

### 3.2 Issue 상태 전이

| status | 조건 | 가능한 액션 |
|--------|------|-----------|
| `DRAFT` | `now < opens_at` | 관리자만 조회 |
| `ACTIVE` | `opens_at ≤ now < closes_at` | 채팅, 의견 등록/수정/삭제, 투표 |
| `RESULT` | `closes_at ≤ now < result_at` | 결과 조회만, 채팅·투표 잠금 |
| `ARCHIVED` | `now ≥ result_at` | 목록 비노출 (직접 URL 차단) |
| `CLEANED` | `ARCHIVED` 진입 후 7일 경과 | Chat·Comment·Vote 삭제 완료. 메타만 남음 |

- cron이 1분 주기로 status 전이
- 사용자 요청 시점에도 시간 비교로 즉시 보정 (cron 지연 방지)
- `RESULT` 진입 시 점수 계산 잡 트리거

### 3.3 핵심 정책

| 정책 | 규칙 |
|------|------|
| 1인 1의견 | `UNIQUE(issue_id, user_id)` 제약 |
| 의견 5분 수정·삭제 | `created_at + 5min ≥ now` AND `Issue.status = ACTIVE` |
| 투표 자유 변경 | UPSERT로 `+1↔-1` 토글, row 삭제로 취소 |
| 1의견당 1표 | `UNIQUE(comment_id, user_id)` |
| 자기 의견 투표 | **금지** (서버 검증) |
| 밴 | 기간 필수, 메모 선택, 사용자가 만료 시각·사유 조회 가능 |
| 관리자 시드 | `ADMIN_EMAIL`·`ADMIN_INITIAL_PASSWORD` env + 시드 스크립트, idempotent |
| 채팅·의견 정리 | `result_at + 7일` 일괄 삭제 (유저·이슈·IssueResult는 영구) |

### 3.4 점수 계산

- 시점: `closes_at` 도달 시 1회 (node-cron이 트리거)
- 계산식: `score = SUM(Vote.value)` per Comment
- 각 진영(A/B) `score DESC, created_at ASC` 정렬 후 TOP3 추출
- 두 진영 TOP3 점수 총합 비교로 `winner_side` 결정 (동률은 `TIE`)
- 결과는 `IssueResult`에 jsonb로 스냅샷 저장 → 정리 잡 이후에도 결과 보존

---

## 4. 인증/세션

- **액세스 토큰**: JWT, 만료 15분, HttpOnly Cookie(`access_token`)
- **리프레시 토큰**: JWT, 만료 14일, HttpOnly Cookie(`refresh_token`)
  - 서버는 `token_hash`만 DB에 보관, 검증 시 비교
  - 로그아웃·밴·비밀번호 변경 시 row revoke로 즉시 무효화
- **자동 갱신**: Next.js middleware가 만료된 액세스 토큰 감지 → refresh 시도 → 실패 시 401
- **밴 검사**: 모든 보호 API에서 활성 Sanction 조회 (지표상 50명 규모면 비용 무시 가능)

---

## 5. API 설계

### 5.1 공개

```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/issues?status=ACTIVE|RESULT
GET    /api/issues/[id]
GET    /api/issues/[id]/comments?side=A|B&sort=score|recent
GET    /api/issues/[id]/chats?cursor=...     (커서 기반 페이징)
```

### 5.2 사용자 (로그인 필요)

```
POST   /api/issues/[id]/comments   { side, body }     -- 1인 1회
PATCH  /api/comments/[id]          { body }           -- 5분 + ACTIVE
DELETE /api/comments/[id]                              -- 5분 + ACTIVE
PUT    /api/comments/[id]/vote     { value: 1 | -1 } -- UPSERT
DELETE /api/comments/[id]/vote                         -- 취소
POST   /api/issues/[id]/chats      { body }
GET    /api/me/ban-status                              -- 만료/사유 노출
```

### 5.3 SSE

```
GET    /api/events/issue/[id]      -- text/event-stream
  events:
    chat     { id, userId, nickname, body, createdAt }
    comment  { type: 'created'|'updated'|'deleted', comment: {...} }
    vote     { commentId, score, likes, dislikes }
    status   { status, computedAt? }
```

- 이슈별 **단일 채널**: 한 사용자는 한 이슈에 대해 1개 EventSource만 유지
- mutation Route Handler가 DB commit 후 `broadcast(issueId, event, data)` 호출
- 클라이언트는 자동 재연결로 일시적 장애 흡수

### 5.4 관리자 (`/api/admin/*` 미들웨어로 role 검사)

```
POST   /api/admin/issues
PATCH  /api/admin/issues/[id]
DELETE /api/admin/issues/[id]
GET    /api/admin/issues/[id]/logs              -- 채팅 + 의견 로그
POST   /api/admin/users/[id]/ban  { expires_at, memo? }
DELETE /api/admin/users/[id]/ban                -- 조기 해제
GET    /api/admin/users?q=
```

---

## 6. SSE 브로드캐스터 (인메모리)

```ts
// app/_lib/sse-hub.ts
type Writer = WritableStreamDefaultWriter<Uint8Array>
const channels = new Map<string, Set<Writer>>()

export function subscribe(issueId: string, writer: Writer, signal: AbortSignal) {
  const set = channels.get(issueId) ?? new Set()
  set.add(writer); channels.set(issueId, set)
  signal.addEventListener('abort', () => {
    set.delete(writer)
    if (set.size === 0) channels.delete(issueId)
  })
}

export function broadcast(issueId: string, event: string, data: unknown) {
  const set = channels.get(issueId); if (!set) return
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const bytes = new TextEncoder().encode(payload)
  for (const w of set) w.write(bytes).catch(() => set.delete(w))
}
```

- 단일 인스턴스 가정 → Redis/LISTEN 불필요
- 재배포 시 클라이언트 자동 재연결로 복구 (서버는 단순)

---

## 7. 스케줄러 (node-cron, 앱 내 구동)

| 잡 | 주기 | 동작 |
|----|------|------|
| `status-transition` | 매 1분 | `opens_at/closes_at/result_at` 기준 status 일괄 갱신 |
| `compute-result` | `status-transition` 이후 트리거 | `RESULT` 진입한 이슈에 대해 점수 계산 → `IssueResult` 저장 |
| `cleanup-archived` | 매 1시간 | `status=ARCHIVED` AND `result_at + 7일 ≤ now` 인 이슈의 Chat·Comment·Vote 삭제 → `status=CLEANED` |

- 모두 동일 프로세스에서 실행. 단일 인스턴스이므로 중복 실행 우려 없음
- 각 잡은 시작 시 advisory lock(Postgres) 없이도 idempotent하게 설계 (조건 기반 UPDATE)

---

## 8. 디렉터리 구조 (제안)

```
red-blue-fullstack/
├── app/
│   ├── (public)/                  # 비로그인도 접근
│   │   ├── page.tsx               # 이슈 목록
│   │   └── issues/[id]/page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (admin)/
│   │   └── admin/...
│   ├── api/
│   │   ├── auth/...
│   │   ├── issues/...
│   │   ├── comments/...
│   │   ├── events/issue/[id]/route.ts   # SSE
│   │   └── admin/...
│   ├── _lib/
│   │   ├── db.ts                  # Drizzle 인스턴스
│   │   ├── auth.ts                # JWT, 쿠키, 미들웨어 도우미
│   │   ├── sse-hub.ts
│   │   └── cron.ts                # node-cron 부트스트랩 (서버 시작 시 1회)
│   └── _components/               # shadcn/ui 컴포넌트
├── drizzle/
│   ├── schema.ts
│   └── migrations/
├── scripts/
│   └── seed-admin.ts
├── middleware.ts                  # /api/admin/* 가드 + 토큰 자동 refresh
├── drizzle.config.ts
├── package.json
└── PLAN.md
```

---

## 9. 환경변수

```
DATABASE_URL=postgres://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
ACCESS_TOKEN_TTL=900             # 15min
REFRESH_TOKEN_TTL=1209600        # 14days
ADMIN_EMAIL=admin@example.com
ADMIN_INITIAL_PASSWORD=...       # seed 후 변경 권장
NODE_ENV=production
```

---

## 10. 배포 (Railway)

1. **Postgres 플러그인** 추가 → `DATABASE_URL` 자동 주입
2. **Web Service** 1개 (Next.js)
   - Build: `pnpm install && pnpm drizzle-kit migrate && pnpm build`
   - Start: `pnpm start` (Next.js production)
   - 시작 시 `app/_lib/cron.ts`가 자동으로 node-cron 등록
3. 최초 1회: Railway shell에서 `pnpm tsx scripts/seed-admin.ts`

> **참고**: Free Plan은 trial 종료 후 Hobby($5/mo)로 전환됨. 운영 비용 확인 필요.

---

## 11. 구현 순서 제안

1. 프로젝트 부트스트랩: Next.js 15 + TS + Tailwind + shadcn/ui
2. Drizzle 스키마 + 초기 마이그레이션
3. Auth: 회원가입/로그인/JWT/refresh/me + middleware
4. 관리자 시드 스크립트
5. Issue CRUD (관리자) + 상태 전이 cron
6. 사용자 도메인: Comment(5분 정책) + Vote(토글)
7. Chat + SSE 브로드캐스트
8. 점수 계산 잡 + IssueResult 노출
9. 정리 잡 (`result_at + 7일`)
10. 관리자 페이지: 이슈 관리, 로그 조회, 밴
11. UI 마감 (이슈 목록/상세/투표 UI)
12. 배포 + 시드 + Smoke 테스트

---

## 12. 명시적으로 하지 않는 것 (Out of Scope)

- 소셜 로그인, 이메일 인증
- 다중 인스턴스 / 수평 확장
- Redis, 메시지 큐
- 모바일 앱 (웹 반응형으로 대응)
- 실시간 알림(푸시), 이메일 알림
- 자동 모더레이션 (욕설 필터 등) — 관리자 수동 제재만
- 자동화 테스트 — MVP 검증 후 결정
- i18n / 다국어

---

# §V2 — 빨파레나 디자인 도입 (2026-05-19)

> `bbalparena-mvp` 디자인을 기반으로 한 2차 합의안. v1에서 굳힌 백엔드 핵심 정책은 유지하되, **반응 모델 / 답글 구조 / 진영 명명 / 시각 디자인**을 전면 교체한다.

## V2.1 변경 요약

| 영역 | v1 | v2 |
|------|----|----|
| 브랜드 | RED BLUE ARENA | **빨파레나** (빨/파/레나 색분리 로고) |
| 테마 | Tailwind v3 라이트 | **Tailwind v4 다크** (네온 글로우 + scanlines) |
| 폰트 | 시스템 | **Noto Sans KR** |
| 진영 enum | `A` / `B` | **`left` / `right`** (DB 마이그레이션) |
| 사용자 역할 | 비로그인=관람, 로그인=참전 | **left / right / spectator(눈팅충)** 3-way |
| 반응 | `votes (+1/-1)` 단일 | **`reactions (empathy, dopamine)` 2종 + 답글로 자동 계산되는 rebuttal** |
| 점수 공식 | `SUM(value)` | **`empathy + uniqueDirectReplyAuthors + dopamine × 5`** |
| 답글 | 없음 | **트리 구조 replies (무한 깊이)** |
| 채팅 (RESULT 상태) | 잠금 | **허용** (의견·반응만 잠금) |

## V2.2 도메인 모델 변경

### A. side enum 마이그레이션
- `pgEnum('side', ['A','B'])` → `pgEnum('side', ['left','right'])`
- 절차: 새 enum 추가 → 기존 데이터 `A→left, B→right` 변환 → 컬럼 타입 교체 → 옛 enum drop
- `winnerSide`도 `('A','B','TIE')` → `('left','right','TIE')`

### B. `votes` 폐기, `reactions` 신설
```sql
DROP TABLE votes;

CREATE TYPE reaction_kind AS ENUM ('empathy', 'dopamine');

CREATE TABLE reactions (
  id uuid PK,
  user_id uuid FK,
  -- 의견 또는 답글 둘 중 하나만 not null
  comment_id uuid FK NULL,
  reply_id uuid FK NULL,
  kind reaction_kind NOT NULL,
  created_at timestamptz,
  CHECK ((comment_id IS NOT NULL) <> (reply_id IS NOT NULL)),
  UNIQUE(user_id, comment_id, kind) WHERE comment_id IS NOT NULL,
  UNIQUE(user_id, reply_id, kind)   WHERE reply_id IS NOT NULL
);
```
- 의견·답글 모두에 reactions 가능 (디자인 코드 그대로)
- (user, target, kind) 유니크 — 다시 누르면 row 삭제(취소)

### C. `replies` 테이블 신설 (트리 구조)
```sql
CREATE TABLE replies (
  id uuid PK,
  comment_id uuid FK NOT NULL,           -- 루트 의견 (rootId)
  parent_reply_id uuid FK NULL,          -- null이면 의견에 직접 단 답글
  user_id uuid FK NOT NULL,
  side side NOT NULL,
  body text NOT NULL,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  INDEX(comment_id, created_at),
  INDEX(parent_reply_id)
);
```
- 무한 깊이 (부모 참조만 있고 깊이 제한 없음)
- `rebuttal` 카운트 = **comment에 직접 단 답글의 unique user_id 수** (UI/점수 둘 다 동일 정의)

### D. 점수 공식
```
score(comment) = empathy_count + unique_direct_repliers + dopamine_count × 5
```
- `unique_direct_repliers`: `SELECT COUNT(DISTINCT user_id) FROM replies WHERE comment_id = ? AND parent_reply_id IS NULL AND deleted_at IS NULL`
- TOP3 정렬: score DESC, created_at ASC
- 진영 승자: 진영별 TOP3 score 합 비교

### E. 역할 권한 매트릭스
| 액션 | left/right | spectator |
|------|-----------|-----------|
| 채팅 | ✅ | ❌ |
| 의견 등록 (1인1회) | ✅ | ❌ |
| 의견 수정/삭제 (5분 내) | ✅ (본인) | — |
| 답글 등록 | ✅ | ❌ |
| empathy(공감) | ✅ | ✅ |
| dopamine(도파민) | ✅ | ❌ |
| 본인 의견·답글에 본인 반응 | ❌ | ❌ |

### F. 진영 선택(role) 저장 위치
- **localStorage 1차** (디자인 그대로): `{ [issueId]: 'left'|'right'|'spectator' }`
- 다만 mutation API는 서버에서도 검증 필요 → 한 번 의견을 등록하면 `comments.side`가 곧 user의 진영. 그 이후 변경 불가.
- spectator는 의견이 없으므로 client-side만 의미. 서버는 "의견 없음 + 인증된 사용자"면 어떤 진영의 액션도 허용 가능하나, **답글·의견·dopamine 요청 시 반드시 `side` 필드를 body에 동봉**해 검증.

### G. RESULT 상태 정책 완화
- v1: `RESULT`면 채팅·의견·투표 모두 잠금
- v2: **채팅은 허용**, 의견·반응·답글만 잠금
- 사용자 체류 시간을 늘리는 디자인 의도 반영

## V2.3 API 변경

### 신규/변경
```
POST   /api/issues/[id]/comments    { side, body }                       (left/right만)
POST   /api/comments/[id]/replies   { side, body, parentReplyId? }       (left/right만)
PATCH  /api/replies/[id]            { body }                             (5분 + ACTIVE)
DELETE /api/replies/[id]

POST   /api/comments/[id]/reactions { kind: 'empathy'|'dopamine' }       (토글)
DELETE /api/comments/[id]/reactions?kind=empathy|dopamine                (명시 취소)
POST   /api/replies/[id]/reactions  { kind: 'empathy'|'dopamine' }       (토글)
DELETE /api/replies/[id]/reactions?kind=...

# 제거
DELETE 기존 /api/comments/[id]/vote
```

### 응답 페이로드 변경
- comment 조회 시 `{ empathy, dopamine, rebuttal, score, replies: ReplyNode[] }` 형태로 nested 반환 (또는 별도 엔드포인트)
- SSE 이벤트 종류 확장:
  - `reaction` { targetType, targetId, empathy, dopamine, score }
  - `reply`    { type: created|updated|deleted, reply }
  - `comment`  (기존, 다만 score 공식 변경)

## V2.4 화면 구성

### 라우트
| 경로 | 내용 |
|------|------|
| `/` | 이슈 카드 리스트 (다크 톤). 카테고리 탭 (정치만 active, 나머지는 "준비중" 비활성) |
| `/issues/[id]` | SideGate (진영 미선택 시) → ArenaBattleClient (CommentBattle + Top3 + Scoreboard) |
| `/login`, `/signup` | 다크 톤 폼 |
| `/admin/*` | 기존 풀 CRUD + 밴, 다크 톤 리스킨 |

### 핵심 컴포넌트 (bbalparena-mvp에서 이식)
- `MobileShell` — 다크 그리드/스캔라인/로고 헤더
- `TeamPill` — 좌/우 진영 색 칩
- `ArenaScoreboardStrip` — LIVE + 타이머 + 진영 게이지
- `ArenaCompactTop3Scoreboard` — 압축 TOP3
- `Top3FighterCard` — 풀 TOP3 카드 (금/은/동 랭크 스타일)
- `SideGate` — 진영 선택 게이트
- `CommentBattle` — 댓글 난장판 + 답글 트리 + 반응 버튼
- `Logo` — 빨/파/레나 색분리

### 디자인 토큰 (globals.css)
```css
:root {
  --arena-bg: #07070c;
  --arena-panel: #0f1018;
  --arena-red: #ff2b4a;        /* 우측 진영 */
  --arena-blue: #2f7bff;       /* 좌측 진영 */
  --arena-text: #f4f4f8;
  --arena-muted: #9aa3b2;
}
```
+ `@keyframes` (arena-pulse, hype-shake, live-blink, broadcast-onair-dot, scanlines)

### Tailwind v4 마이그레이션
- `tailwind.config.ts` 폐기 → `app/globals.css`에 `@import "tailwindcss"` + `@theme inline { ... }`
- `postcss.config.mjs`: `tailwindcss` → `@tailwindcss/postcss`
- `@tailwind base/components/utilities` 디렉티브 제거

## V2.5 구현 순서 (제안)

1. **백엔드 마이그레이션 #1**: side enum A/B → left/right (데이터 변환 포함)
2. **백엔드 스키마 #2**: replies 테이블 신설
3. **백엔드 스키마 #3**: votes 삭제, reactions 신설
4. **점수 잡 재작성**: 새 공식 + replies unique-author 카운트
5. **API 재작성**:
   - reactions (POST/DELETE) for comment/reply
   - replies CRUD
   - RESULT 시 채팅 허용으로 정책 완화
   - 진영 일치 검증 (mutation 시 user's comment.side 기준)
6. **단위 테스트 갱신**: 새 점수 공식, reaction 토글, reply unique 카운트
7. **Tailwind v4 마이그레이션** (config → CSS, postcss plugin 변경)
8. **디자인 토큰 + globals.css** 이식
9. **공통 컴포넌트 이식** (MobileShell, TeamPill, ScoreboardStrip, Top3 카드, SideGate, CommentBattle, Logo)
10. **라우트 페이지 재작성** (홈, 이슈 상세, 로그인/가입)
11. **어드민 다크 톤 리스킨** (기능 유지)
12. **E2E 검증** + Railway 재배포

## V2.6 명시적으로 미적용 (Out of Scope of V2)

- 단일 메인 아레나 컨셉 (다수 이슈 목록 유지)
- 비로그인 닉네임만으로 참전 (가입 강제 유지)
- 카테고리 정치 외 활성화 (UI만 placeholder)
- 어드민 LIVE 토글 (status는 자동 cron 전이 그대로)
- 결과 발표 전용 페이지 (RESULT 상태에 배너만 추가)

