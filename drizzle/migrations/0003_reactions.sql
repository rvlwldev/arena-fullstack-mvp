-- V2.3: votes 폐기 + reactions(empathy/dopamine) 신설
DROP TABLE "votes";--> statement-breakpoint
CREATE TYPE "public"."reaction_kind" AS ENUM('empathy', 'dopamine');--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"comment_id" uuid,
	"reply_id" uuid,
	"kind" "reaction_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_target_xor" CHECK ((("comment_id" IS NOT NULL) AND ("reply_id" IS NULL)) OR (("comment_id" IS NULL) AND ("reply_id" IS NOT NULL)))
);--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_reply_id_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_comment_user_kind_uq" ON "reactions" ("comment_id","user_id","kind") WHERE "comment_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_reply_user_kind_uq" ON "reactions" ("reply_id","user_id","kind") WHERE "reply_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "reactions_comment_idx" ON "reactions" ("comment_id");--> statement-breakpoint
CREATE INDEX "reactions_reply_idx" ON "reactions" ("reply_id");
