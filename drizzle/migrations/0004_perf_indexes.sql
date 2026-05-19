-- 성능 최적화 인덱스
-- 1) 활성 ban 조회 가속 (lifted_at IS NULL AND expires_at > now)
CREATE INDEX IF NOT EXISTS "sanctions_active_user_idx"
  ON "sanctions" ("user_id", "expires_at" DESC)
  WHERE "lifted_at" IS NULL;

-- 2) reactions 집계 가속: comment_id + kind / reply_id + kind
CREATE INDEX IF NOT EXISTS "reactions_comment_kind_idx"
  ON "reactions" ("comment_id", "kind")
  WHERE "comment_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "reactions_reply_kind_idx"
  ON "reactions" ("reply_id", "kind")
  WHERE "reply_id" IS NOT NULL;

-- 3) rebuttal 카운트 가속: 의견 직속 답글(parent_reply_id IS NULL) + 미삭제
CREATE INDEX IF NOT EXISTS "replies_root_active_idx"
  ON "replies" ("comment_id", "user_id")
  WHERE "parent_reply_id" IS NULL AND "deleted_at" IS NULL;

-- 4) 답글 조회 가속 (활성)
CREATE INDEX IF NOT EXISTS "replies_comment_active_idx"
  ON "replies" ("comment_id", "created_at")
  WHERE "deleted_at" IS NULL;

-- 5) 채팅 조회 가속 (활성)
CREATE INDEX IF NOT EXISTS "chats_issue_active_idx"
  ON "chats" ("issue_id", "id" DESC)
  WHERE "deleted_at" IS NULL;

-- 6) 의견 조회 가속 (활성)
CREATE INDEX IF NOT EXISTS "comments_issue_active_idx"
  ON "comments" ("issue_id", "user_id")
  WHERE "deleted_at" IS NULL;
