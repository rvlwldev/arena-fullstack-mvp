-- V2.1: side enum A/B → left/right (데이터 변환 포함)
ALTER TABLE "public"."comments" ALTER COLUMN "side" SET DATA TYPE text;--> statement-breakpoint
UPDATE "public"."comments" SET "side" = CASE "side" WHEN 'A' THEN 'left' WHEN 'B' THEN 'right' ELSE "side" END;--> statement-breakpoint
DROP TYPE "public"."side";--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('left', 'right');--> statement-breakpoint
ALTER TABLE "public"."comments" ALTER COLUMN "side" SET DATA TYPE "public"."side" USING "side"::"public"."side";--> statement-breakpoint
ALTER TABLE "public"."issue_results" ALTER COLUMN "winner_side" SET DATA TYPE text;--> statement-breakpoint
UPDATE "public"."issue_results" SET "winner_side" = CASE "winner_side" WHEN 'A' THEN 'left' WHEN 'B' THEN 'right' ELSE "winner_side" END;--> statement-breakpoint
DROP TYPE "public"."winner_side";--> statement-breakpoint
CREATE TYPE "public"."winner_side" AS ENUM('left', 'right', 'TIE');--> statement-breakpoint
ALTER TABLE "public"."issue_results" ALTER COLUMN "winner_side" SET DATA TYPE "public"."winner_side" USING "winner_side"::"public"."winner_side";
