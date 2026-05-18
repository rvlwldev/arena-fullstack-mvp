# RED BLUE ARENA

진영 대립 이슈에 대한 의견 공유 서비스. MVP 검증용.

## 빠른 시작

### 1) 사전 요구
- Node 22+ / pnpm
- Docker (로컬 Postgres)

### 2) 의존성 설치
```bash
pnpm install
```

### 3) Postgres 컨테이너 기동
```bash
docker run -d --name red-blue-arena-dev-postgres \
  -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=admin \
  -e POSTGRES_DB=red_blue_arena_dev \
  -p 5432:5432 -v red-blue-arena-pg-data:/var/lib/postgresql/data \
  postgres:16-alpine
```

또한 테스트 DB 생성:
```bash
docker exec red-blue-arena-dev-postgres psql -U admin -d postgres -c "CREATE DATABASE red_blue_arena_test;"
```

### 4) 환경변수
`.env.example`을 `.env.local`로 복사하고 필요한 값 채워넣기.

### 5) 마이그레이션 + 관리자 시드
```bash
pnpm db:migrate
DATABASE_URL=postgres://admin:admin@localhost:5432/red_blue_arena_test pnpm db:migrate  # 테스트 DB
pnpm seed:admin
```

### 6) 개발 서버
```bash
pnpm dev
# http://localhost:3000
```

### 7) 테스트
```bash
pnpm test
```

## 스크립트
| 명령 | 설명 |
|------|------|
| `pnpm dev` | Next.js dev 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm test` | Vitest 단위/통합 |
| `pnpm typecheck` | tsc --noEmit |
| `pnpm db:generate` | Drizzle 스키마 → SQL |
| `pnpm db:migrate` | 마이그레이션 적용 |
| `pnpm seed:admin` | 관리자 계정 시드 (env 기반) |

## 설계 문서
- [PLAN.md](./PLAN.md): 아키텍처/도메인/API 합의안
- [REQUIRED.md](./REQUIRED.md): 비즈니스 요구사항
