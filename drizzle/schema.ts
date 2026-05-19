import {
  pgEnum,
  pgTable,
  uuid,
  text,
  timestamp,
  smallint,
  bigserial,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['USER', 'ADMIN'])
export const issueStatus = pgEnum('issue_status', [
  'DRAFT',
  'ACTIVE',
  'RESULT',
  'ARCHIVED',
  'CLEANED',
])
export const sideEnum = pgEnum('side', ['left', 'right'])
export const winnerSide = pgEnum('winner_side', ['left', 'right', 'TIE'])
export const sanctionType = pgEnum('sanction_type', ['BAN'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    nickname: text('nickname').notNull(),
    role: userRole('role').notNull().default('USER'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    bannedAt: timestamp('banned_at', { withTimezone: true }),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_uq').on(t.email),
    nicknameIdx: uniqueIndex('users_nickname_uq').on(t.nickname),
  }),
)

export const issues = pgTable('issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  sideALabel: text('side_a_label').notNull(),
  sideASummary: text('side_a_summary').notNull(),
  sideBLabel: text('side_b_label').notNull(),
  sideBSummary: text('side_b_summary').notNull(),
  opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
  closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
  resultAt: timestamp('result_at', { withTimezone: true }).notNull(),
  status: issueStatus('status').notNull().default('DRAFT'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    side: sideEnum('side').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    issueUserUq: uniqueIndex('comments_issue_user_uq').on(t.issueId, t.userId),
    issueIdx: index('comments_issue_idx').on(t.issueId),
  }),
)

export const replies = pgTable(
  'replies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    parentReplyId: uuid('parent_reply_id'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    side: sideEnum('side').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    commentCreatedIdx: index('replies_comment_created_idx').on(t.commentId, t.createdAt),
    parentIdx: index('replies_parent_idx').on(t.parentReplyId),
  }),
)

export const votes = pgTable(
  'votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    commentUserUq: uniqueIndex('votes_comment_user_uq').on(t.commentId, t.userId),
    commentIdx: index('votes_comment_idx').on(t.commentId),
  }),
)

export const chats = pgTable(
  'chats',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    issueCreatedIdx: index('chats_issue_created_idx').on(t.issueId, t.createdAt),
  }),
)

export const issueResults = pgTable('issue_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  issueId: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' })
    .unique(),
  winnerSide: winnerSide('winner_side').notNull(),
  sideATop3: jsonb('side_a_top3').notNull(),
  sideBTop3: jsonb('side_b_top3').notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sanctions = pgTable(
  'sanctions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: sanctionType('type').notNull().default('BAN'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    memo: text('memo'),
    byAdminId: uuid('by_admin_id')
      .notNull()
      .references(() => users.id),
    liftedAt: timestamp('lifted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userExpiresIdx: index('sanctions_user_expires_idx').on(t.userId, t.expiresAt),
  }),
)

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('refresh_user_idx').on(t.userId),
    hashIdx: index('refresh_hash_idx').on(t.tokenHash),
  }),
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Issue = typeof issues.$inferSelect
export type NewIssue = typeof issues.$inferInsert
export type Comment = typeof comments.$inferSelect
export type Reply = typeof replies.$inferSelect
export type NewReply = typeof replies.$inferInsert
export type Vote = typeof votes.$inferSelect
export type Chat = typeof chats.$inferSelect
export type Sanction = typeof sanctions.$inferSelect
export type IssueResult = typeof issueResults.$inferSelect
export type RefreshToken = typeof refreshTokens.$inferSelect
