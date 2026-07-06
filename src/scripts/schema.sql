-- Table definitions only. Database creation + selection is handled by
-- src/scripts/initDb.js using DB_NAME from .env, so this file never
-- hardcodes a database name (avoids drift between .env and the schema).
--
-- Order matters here: admins/users must exist before urls, since urls
-- carries FK references to both.

-- Admin auth. failed_attempts/locked_until implement account lockout
-- independently of (and in addition to) the IP-based rate limiter on the
-- login route, so a distributed attacker can't bypass lockout by rotating
-- IPs against one known admin account. Admins have no daily URL cap.
CREATE TABLE IF NOT EXISTS admins (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username         VARCHAR(50) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  failed_attempts  INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until     TIMESTAMP NULL DEFAULT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_admin_username (username),
  UNIQUE KEY uq_admin_email (email)
) ENGINE=InnoDB;

-- Regular user auth — same shape/lockout behavior as admins, kept as a
-- separate table (not unified) so admin login is completely unaffected by
-- this table's existence. Subject to the per-user daily URL creation cap.
CREATE TABLE IF NOT EXISTS users (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username         VARCHAR(50) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts  INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until     TIMESTAMP NULL DEFAULT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- Every url is owned by exactly one identity — either an admin or a user,
-- never both, never neither. MySQL can't FK a single column to "one of two
-- tables", so ownership is two nullable FK columns plus a CHECK enforcing
-- exactly one is set. idx_owner_user_created makes the per-user daily-limit
-- check (COUNT WHERE owner_user_id = ? AND created_at >= CURDATE()) an
-- index range scan instead of a table scan.
CREATE TABLE IF NOT EXISTS urls (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_admin_id    BIGINT UNSIGNED NULL,
  owner_user_id     BIGINT UNSIGNED NULL,
  long_url          TEXT NOT NULL,
  long_url_hash     CHAR(64) NOT NULL,
  short_code        VARCHAR(20) NOT NULL,
  click_count       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at  TIMESTAMP NULL DEFAULT NULL,
  expires_at        TIMESTAMP NULL DEFAULT NULL,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at        TIMESTAMP NULL DEFAULT NULL,

  CONSTRAINT fk_url_owner_admin FOREIGN KEY (owner_admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  CONSTRAINT fk_url_owner_user  FOREIGN KEY (owner_user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT chk_url_owner CHECK (
    (owner_admin_id IS NOT NULL AND owner_user_id IS NULL) OR
    (owner_admin_id IS NULL AND owner_user_id IS NOT NULL)
  ),

  UNIQUE KEY uq_short_code (short_code),
  INDEX idx_long_url_hash (long_url_hash),
  INDEX idx_created_at (created_at),
  INDEX idx_is_deleted (is_deleted),
  INDEX idx_expires_at (expires_at),
  INDEX idx_owner_user_created (owner_user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS click_events (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  url_id       BIGINT UNSIGNED NOT NULL,
  clicked_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  referrer     VARCHAR(255) NULL,
  user_agent   VARCHAR(255) NULL,
  ip_hash      CHAR(64) NULL,

  CONSTRAINT fk_click_url FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE,
  INDEX idx_url_id (url_id),
  INDEX idx_clicked_at (clicked_at)
) ENGINE=InnoDB;

-- Note: CREATE TABLE IF NOT EXISTS above is a no-op on a database that
-- already had these tables before this shape existed. That upgrade path
-- (dropping is_custom_alias/reset_otp_*, adding ownership + constraints,
-- backfilling existing rows) is handled in src/scripts/initDb.js via
-- information_schema checks instead of `ADD COLUMN IF NOT EXISTS`, which
-- this MySQL version rejects.

-- Audit trail for security-relevant admin actions. admin_id is nullable so
-- failed-login attempts against a nonexistent email can still be recorded.
CREATE TABLE IF NOT EXISTS admin_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id    BIGINT UNSIGNED NULL,
  action      VARCHAR(50) NOT NULL,
  details     VARCHAR(255) NULL,
  ip_address  VARCHAR(64) NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_log_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_admin_id (admin_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;
