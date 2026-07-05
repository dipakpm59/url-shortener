/**
 * One-time / idempotent DB bootstrap: creates the database and tables from schema.sql.
 * Run with: npm run db:init
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env');

async function initDb() {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  });

  try {
    console.log(`Ensuring database "${env.db.database}" exists...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${env.db.database}\``);

    console.log('Running schema.sql against MySQL...');
    await connection.query(schemaSql);

    await migrateUserRolesAndOwnership(connection);

    console.log(`Database "${env.db.database}" initialized successfully.`);
  } finally {
    await connection.end();
  }
}

/** Idempotent column migration — this MySQL version has no ADD COLUMN IF NOT EXISTS. */
async function addColumnIfMissing(connection, table, column, definition) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (rows[0].count > 0) return;

  console.log(`Adding missing column ${table}.${column}...`);
  await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

/** Idempotent column removal — mirrors addColumnIfMissing for the drop direction. */
async function dropColumnIfExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (rows[0].count === 0) return;

  console.log(`Dropping column ${table}.${column}...`);
  await connection.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
}

/** Idempotent constraint addition (FOREIGN KEY or CHECK) — checked by name via information_schema. */
async function addConstraintIfMissing(connection, table, constraintName, definitionSql) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [table, constraintName]
  );
  if (rows[0].count > 0) return;

  console.log(`Adding constraint ${constraintName} on ${table}...`);
  await connection.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${constraintName}\` ${definitionSql}`);
}

/** Idempotent index addition — checked by name via information_schema. */
async function addIndexIfMissing(connection, table, indexName, columnsSql) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  if (rows[0].count > 0) return;

  console.log(`Adding index ${indexName} on ${table}...`);
  await connection.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` ${columnsSql}`);
}

/**
 * Migration 002 (see src/scripts/migrations/002_user_roles_and_ownership.sql
 * for the raw, reviewable SQL this mirrors idempotently): adds URL
 * ownership, backfills pre-existing anonymous urls to the oldest admin
 * account, then drops the columns left dead by the earlier custom-alias
 * and forgot-password removals.
 */
async function migrateUserRolesAndOwnership(connection) {
  await addColumnIfMissing(connection, 'urls', 'owner_admin_id', 'BIGINT UNSIGNED NULL');
  await addColumnIfMissing(connection, 'urls', 'owner_user_id', 'BIGINT UNSIGNED NULL');

  console.log('Backfilling any ownerless urls to the oldest admin account...');
  await connection.query(
    `UPDATE urls
     SET owner_admin_id = (SELECT MIN(id) FROM admins)
     WHERE owner_admin_id IS NULL AND owner_user_id IS NULL`
  );

  await addConstraintIfMissing(
    connection, 'urls', 'fk_url_owner_admin',
    'FOREIGN KEY (owner_admin_id) REFERENCES admins(id) ON DELETE CASCADE'
  );
  await addConstraintIfMissing(
    connection, 'urls', 'fk_url_owner_user',
    'FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE'
  );
  await addConstraintIfMissing(
    connection, 'urls', 'chk_url_owner',
    `CHECK (
      (owner_admin_id IS NOT NULL AND owner_user_id IS NULL) OR
      (owner_admin_id IS NULL AND owner_user_id IS NOT NULL)
    )`
  );
  await addIndexIfMissing(connection, 'urls', 'idx_owner_user_created', '(owner_user_id, created_at)');

  await dropColumnIfExists(connection, 'urls', 'is_custom_alias');
  await dropColumnIfExists(connection, 'admins', 'reset_otp_hash');
  await dropColumnIfExists(connection, 'admins', 'reset_otp_expires');

  await addColumnIfMissing(connection, 'users', 'is_active', 'BOOLEAN NOT NULL DEFAULT TRUE');
}

initDb().catch((err) => {
  console.error('Database initialization failed:', err.message);
  process.exit(1);
});
