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

    await addColumnIfMissing(connection, 'admins', 'reset_otp_hash', 'CHAR(64) NULL DEFAULT NULL');
    await addColumnIfMissing(connection, 'admins', 'reset_otp_expires', 'TIMESTAMP NULL DEFAULT NULL');

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

initDb().catch((err) => {
  console.error('Database initialization failed:', err.message);
  process.exit(1);
});
