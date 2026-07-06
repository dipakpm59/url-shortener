-- Migration 002: role-based auth, user accounts, and URL ownership.
--
-- This file documents the raw migration statements for review. It is NOT
-- executed directly against the database — src/scripts/initDb.js applies
-- the equivalent changes idempotently (each step guarded by an
-- information_schema check), since this MySQL version doesn't support
-- `ADD COLUMN IF NOT EXISTS` / `ADD CONSTRAINT IF NOT EXISTS`, and running
-- these statements a second time as-is would error on a database that
-- already has them applied.
--
-- Order matters: users must exist before urls' FK can reference it, the
-- ownership columns must exist and be backfilled before the CHECK
-- constraint is added (existing rows would otherwise violate it), and the
-- dead columns are dropped last.

-- 1. New users table.
CREATE TABLE IF NOT EXISTS users (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username         VARCHAR(50) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  failed_attempts  INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until     TIMESTAMP NULL DEFAULT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- 2. Add nullable ownership columns to urls.
ALTER TABLE urls
  ADD COLUMN owner_admin_id BIGINT UNSIGNED NULL AFTER id,
  ADD COLUMN owner_user_id  BIGINT UNSIGNED NULL AFTER owner_admin_id;

-- 3. Backfill: every pre-existing (anonymous) url becomes owned by the
--    oldest admin account. This is the one step that changes existing data.
UPDATE urls
SET owner_admin_id = (SELECT MIN(id) FROM admins)
WHERE owner_admin_id IS NULL AND owner_user_id IS NULL;

-- 4. Now that every row has exactly one owner, the FKs and CHECK can be
--    added safely.
ALTER TABLE urls
  ADD CONSTRAINT fk_url_owner_admin FOREIGN KEY (owner_admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_url_owner_user  FOREIGN KEY (owner_user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  ADD CONSTRAINT chk_url_owner CHECK (
    (owner_admin_id IS NOT NULL AND owner_user_id IS NULL) OR
    (owner_admin_id IS NULL AND owner_user_id IS NOT NULL)
  ),
  ADD INDEX idx_owner_user_created (owner_user_id, created_at);

-- 5. Drop the now-dead custom-alias column (feature removed in a prior
--    migration at the application layer; the column itself is dropped now
--    that a real schema migration is in scope).
ALTER TABLE urls DROP COLUMN is_custom_alias;

-- 6. Drop the now-dead forgot-password columns (feature removed in a prior
--    migration at the application layer; same reasoning as above).
ALTER TABLE admins
  DROP COLUMN reset_otp_hash,
  DROP COLUMN reset_otp_expires;
