CREATE TABLE `proofing_links` (
	`token` text PRIMARY KEY NOT NULL,
	`revoke_token` text NOT NULL,
	`name` text NOT NULL,
	`meta_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`finalized_at` integer,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spread_images` (
	`link_token` text NOT NULL,
	`idx` integer NOT NULL,
	`r2_key` text NOT NULL,
	PRIMARY KEY(`link_token`, `idx`),
	FOREIGN KEY (`link_token`) REFERENCES `proofing_links`(`token`) ON UPDATE no action ON DELETE cascade
);
