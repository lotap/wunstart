CREATE TYPE "attempt_scopes" AS ENUM('CREDENTIAL', 'NETWORK');--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"scope" "attempt_scopes",
	"target" varchar(255),
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "auth_attempts_pkey" PRIMARY KEY("scope","target")
);
--> statement-breakpoint
CREATE INDEX "auth_attempts_window_start_index" ON "auth_attempts" ("window_start");