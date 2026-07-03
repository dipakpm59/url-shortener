/**
 * Idempotent admin seeder. Reads ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD
 * from .env (see .env.example for defaults). Safe to re-run — skips creation
 * if an admin with that email already exists rather than erroring.
 *
 * Run with: npm run db:seed
 * To create an additional/different admin, temporarily override the three
 * ADMIN_* vars (e.g. `ADMIN_EMAIL=you@x.com ADMIN_USERNAME=you ADMIN_PASSWORD=... npm run db:seed`).
 */
const env = require('../config/env');
const { pool } = require('../config/db');
const adminModel = require('../models/admin.model');
const { hashPassword, isPasswordComplex } = require('../utils/password');

async function seedAdmin() {
  const { username, email, password } = env.adminSeed;

  if (!isPasswordComplex(password)) {
    throw new Error(
      'ADMIN_PASSWORD does not meet complexity rules (min 8 chars, upper, lower, digit, special character).'
    );
  }

  const existing = await adminModel.findByEmail(email);
  if (existing) {
    console.log(`Admin "${email}" already exists (id=${existing.id}). Skipping.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const created = await adminModel.create({ username, email, passwordHash });
  console.log(`Admin created: id=${created.id}, username=${created.username}, email=${created.email}`);
}

seedAdmin()
  .catch((err) => {
    console.error('Admin seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
