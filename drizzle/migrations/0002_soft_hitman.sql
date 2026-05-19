CREATE TABLE "replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"parent_reply_id" uuid,
	"user_id" uuid NOT NULL,
	"side" "side" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "replies_comment_created_idx" ON "replies" USING btree ("comment_id","created_at");--> statement-breakpoint
CREATE INDEX "replies_parent_idx" ON "replies" USING btree ("parent_reply_id");--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_parent_reply_id_replies_id_fk" FOREIGN KEY ("parent_reply_id") REFERENCES "public"."replies"("id") ON DELETE cascade ON UPDATE no action;