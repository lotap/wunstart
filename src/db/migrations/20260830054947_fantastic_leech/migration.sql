ALTER TABLE "anons" ADD COLUMN "user_agents" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "anons" ADD COLUMN "countries" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "anons" ADD COLUMN "cities" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "anons" ADD COLUMN "regions" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "anons_archive" ADD COLUMN "user_agents" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "anons_archive" ADD COLUMN "countries" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "anons_archive" ADD COLUMN "cities" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "anons_archive" ADD COLUMN "regions" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_agents" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "countries" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "cities" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "regions" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions_archive" ADD COLUMN "user_agents" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions_archive" ADD COLUMN "countries" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions_archive" ADD COLUMN "cities" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions_archive" ADD COLUMN "regions" text[] NOT NULL;