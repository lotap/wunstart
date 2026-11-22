DROP INDEX "activities_ip_address_timestamp_index";--> statement-breakpoint
DROP INDEX "bans_ip_address_index";--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "ip_network" cidr NOT NULL;--> statement-breakpoint
ALTER TABLE "activities_archive" ADD COLUMN "ip_network" cidr NOT NULL;--> statement-breakpoint
ALTER TABLE "bans" ADD COLUMN "ip_network" cidr;--> statement-breakpoint
ALTER TABLE "bans_archive" ADD COLUMN "ip_network" cidr;--> statement-breakpoint
ALTER TABLE "bans" DROP CONSTRAINT "bans_scope_target_unique";--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_scope_target_unique" UNIQUE NULLS NOT DISTINCT("scope","ip_network","failed_credential","user_id","anon_id","users_archive_id","anons_archive_id");--> statement-breakpoint
CREATE INDEX "activities_ip_network_timestamp_index" ON "activities" ("ip_network","timestamp");--> statement-breakpoint
CREATE INDEX "bans_ip_network_index" ON "bans" ("ip_network") WHERE "ip_network" is not null;--> statement-breakpoint
ALTER TABLE "bans" DROP CONSTRAINT "bans_single_target_check", ADD CONSTRAINT "bans_single_target_check" CHECK (num_nonnulls("ip_network", "failed_credential", "user_id", "anon_id", "users_archive_id", "anons_archive_id") = 1);