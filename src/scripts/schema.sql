-- Table definitions only. Database creation + selection is handled by
-- src/scripts/initDb.js using DB_NAME from .env, so this file never
-- hardcodes a database name (avoids drift between .env and the schema).

CREATE TABLE IF NOT EXISTS urls (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  long_url          TEXT NOT NULL,
  long_url_hash     CHAR(64) NOT NULL,
  short_code        VARCHAR(20) NOT NULL,
  is_custom_alias   BOOLEAN NOT NULL DEFAULT FALSE,
  click_count       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at  TIMESTAMP NULL DEFAULT NULL,
  expires_at        TIMESTAMP NULL DEFAULT NULL,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at        TIMESTAMP NULL DEFAULT NULL,

  UNIQUE KEY uq_short_code (short_code),
  INDEX idx_long_url_hash (long_url_hash),
  INDEX idx_created_at (created_at),
  INDEX idx_is_deleted (is_deleted),
  INDEX idx_expires_at (expires_at)
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

-- Single-role admin auth. failed_attempts/locked_until implement account
-- lockout independently of (and in addition to) the IP-based rate limiter
-- on the login route, so a distributed attacker can't bypass lockout by
-- rotating IPs against one known admin account.
CREATE TABLE IF NOT EXISTS admins (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username         VARCHAR(50) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  failed_attempts  INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until     TIMESTAMP NULL DEFAULT NULL,
  reset_otp_hash    CHAR(64) NULL DEFAULT NULL,
  reset_otp_expires TIMESTAMP NULL DEFAULT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_admin_username (username),
  UNIQUE KEY uq_admin_email (email)
) ENGINE=InnoDB;

-- Note: CREATE TABLE IF NOT EXISTS above is a no-op on a database that
-- already had an `admins` table before reset_otp_* existed. That upgrade
-- path is handled in src/scripts/initDb.js via an information_schema check
-- instead of `ADD COLUMN IF NOT EXISTS`, which this MySQL version rejects.

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
