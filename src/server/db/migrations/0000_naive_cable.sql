CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`image` text,
	`provider` text,
	`provider_id` text,
	`institution` text,
	`research_area` text,
	`orcid` text,
	`bio` text,
	`org_id` text,
	`team_id` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `project_members` (
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'editor',
	`invited_by` text,
	`joined_at` text
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`title` text NOT NULL,
	`description` text,
	`target_product` text,
	`status` text DEFAULT 'active',
	`visibility` text DEFAULT 'private',
	`forked_from` text,
	`created_by` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `experiment_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text,
	`path` text,
	`size_bytes` integer,
	`mime_type` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`tool` text NOT NULL,
	`input_json` text,
	`output_json` text,
	`status` text DEFAULT 'pending',
	`duration_ms` integer,
	`error_message` text,
	`created_by` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_number` integer,
	`timestamp` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text,
	`actor_email` text,
	`actor_ip` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`project_id` text,
	`before_state` text,
	`after_state` text,
	`change_summary` text,
	`hash` text NOT NULL,
	`previous_hash` text,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_log_sequence_number_unique` ON `audit_log` (`sequence_number`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`scopes` text DEFAULT 'read,write',
	`expires_at` text,
	`last_used_at` text,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `inventory_chemicals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cas_number` text,
	`molecular_formula` text,
	`molecular_weight_g_mol` real,
	`vendor` text,
	`catalog_number` text,
	`lot_number` text,
	`purity_percent` real,
	`expiry_date` text,
	`hazard_class` text,
	`sds_url` text,
	`storage_temperature` text,
	`quantity_remaining` real,
	`quantity_unit` text,
	`reorder_threshold` real,
	`notes` text,
	`project_id` text,
	`created_by` text,
	`created_at` text,
	`updated_at` text,
	`archived` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `inventory_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`capacity` integer,
	`current_count` integer DEFAULT 0,
	`temperature_c` real,
	`notes` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `inventory_plasmids` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`backbone` text,
	`insert_description` text,
	`insert_sequence` text,
	`insert_length_bp` integer,
	`resistance` text,
	`copy_number` text,
	`promoter` text,
	`tags` text,
	`linked_pathway_node` text,
	`design_source_tool` text,
	`freezer_location_id` text,
	`concentration_ng_ul` real,
	`addgene_id` text,
	`sequence_verified` integer DEFAULT 0,
	`notes` text,
	`project_id` text,
	`created_by` text,
	`created_at` text,
	`updated_at` text,
	`archived` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `inventory_primers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sequence_5to3` text NOT NULL,
	`length_bp` integer,
	`tm_celsius` real,
	`gc_percent` real,
	`target_gene` text,
	`modification_5prime` text,
	`pair_id` text,
	`concentration_uM` real,
	`vendor` text,
	`notes` text,
	`project_id` text,
	`created_by` text,
	`created_at` text,
	`updated_at` text,
	`archived` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `inventory_strains` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`genotype` text,
	`species` text DEFAULT 'E. coli',
	`source` text,
	`parent_strain_id` text,
	`associated_plasmid_ids` text,
	`freezer_location_id` text,
	`box_position` text,
	`aliquot_count` integer DEFAULT 0,
	`resistance_markers` text,
	`notes` text,
	`project_id` text,
	`created_by` text,
	`created_at` text,
	`updated_at` text,
	`archived` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `pm_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`due_date` text,
	`status` text DEFAULT 'upcoming',
	`deliverables` text,
	`created_at` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `pm_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'backlog',
	`priority` text DEFAULT 'medium',
	`assigned_to` text,
	`created_by` text,
	`due_date` text,
	`milestone_id` text,
	`tool_id` text,
	`experiment_record_id` text,
	`tags` text,
	`sort_order` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `pm_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`description` text,
	`tasks` text,
	`milestones` text,
	`created_by` text,
	`is_public` integer DEFAULT 0,
	`fork_count` integer DEFAULT 0,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text,
	`message` text NOT NULL,
	`reply_to_id` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `comment_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `comment_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`project_id` text,
	`created_by` text,
	`resolved` integer DEFAULT 0,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`body` text,
	`read` integer DEFAULT 0,
	`link` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`permission` text DEFAULT 'view',
	`created_by` text,
	`expires_at` text,
	`max_uses` integer,
	`use_count` integer DEFAULT 0,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `decision_log` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`title` text NOT NULL,
	`context` text,
	`options` text,
	`decision` text,
	`rationale` text,
	`outcome` text,
	`related_experiment_ids` text,
	`decided_by` text,
	`decided_at` text
);
--> statement-breakpoint
CREATE TABLE `literature_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`doi` text,
	`title` text,
	`authors` text,
	`journal` text,
	`year` integer,
	`abstract` text,
	`tags` text,
	`user_annotations` text,
	`added_by` text,
	`added_at` text
);
--> statement-breakpoint
CREATE TABLE `protocols` (
	`id` text PRIMARY KEY NOT NULL,
	`wiki_page_id` text,
	`category` text,
	`estimated_duration_min` integer,
	`difficulty` text,
	`equipment` text,
	`reagents` text,
	`steps` text,
	`fork_of` text,
	`fork_count` integer DEFAULT 0,
	`rating_avg` real,
	`rating_count` integer DEFAULT 0,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `wiki_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`content` text,
	`content_markdown` text,
	`category` text,
	`tags` text,
	`created_by` text,
	`last_edited_by` text,
	`version` integer DEFAULT 1,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `wiki_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`version` integer NOT NULL,
	`content` text,
	`content_markdown` text,
	`edited_by` text,
	`change_summary` text,
	`edited_at` text
);
--> statement-breakpoint
CREATE TABLE `ai_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`user_id` text,
	`title` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tool_calls` text,
	`token_usage` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`org_id` text,
	`date` text NOT NULL,
	`model` text,
	`input_tokens` integer DEFAULT 0,
	`output_tokens` integer DEFAULT 0,
	`cost_usd` real DEFAULT 0,
	`request_type` text
);
