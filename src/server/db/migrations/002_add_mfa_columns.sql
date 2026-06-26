-- Migration 002: Add MFA (TOTP) columns to users table
-- Adds support for Time-based One-Time Password multi-factor authentication

ALTER TABLE `users` ADD COLUMN `mfa_enabled` integer DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `mfa_secret` text;
ALTER TABLE `users` ADD COLUMN `mfa_backup_codes` text;
