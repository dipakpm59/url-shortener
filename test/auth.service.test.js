process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const adminModel = require('../src/models/admin.model');
const adminLogModel = require('../src/models/adminLog.model');
const { hashPassword } = require('../src/utils/password');
const authService = require('../src/services/auth.service');
const env = require('../src/config/env');

const CORRECT_PASSWORD = 'CorrectHorseBattery1!';
let correctHash;

// Real bcrypt hash computed once — used instead of mocking comparePassword,
// since auth.service.js destructures {comparePassword} at require time, so
// mocking it on the module object afterward wouldn't affect the already-bound
// local reference inside auth.service.js.
before(async () => {
  correctHash = await hashPassword(CORRECT_PASSWORD);
});

function makeAdmin(overrides = {}) {
  return {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    password_hash: correctHash,
    failed_attempts: 0,
    locked_until: null,
    created_at: new Date(),
    ...overrides,
  };
}

test('login throws a generic error for an unknown identifier, and logs the attempt', async (t) => {
  t.mock.method(adminModel, 'findByEmailOrUsername', async () => null);
  const logs = [];
  t.mock.method(adminLogModel, 'record', async (args) => logs.push(args));

  await assert.rejects(
    () => authService.login({ identifier: 'ghost', password: 'x' }),
    (err) => {
      assert.equal(err.statusCode, 401);
      assert.equal(err.message, 'Invalid email/username or password.');
      return true;
    }
  );
  assert.equal(logs[0].action, 'login_failed');
});

test('login refuses a locked account regardless of password correctness', async (t) => {
  t.mock.method(adminModel, 'findByEmailOrUsername', async () =>
    makeAdmin({ locked_until: new Date(Date.now() + 5 * 60 * 1000) })
  );
  t.mock.method(adminLogModel, 'record', async () => {});

  await assert.rejects(
    () => authService.login({ identifier: 'admin', password: CORRECT_PASSWORD }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /locked/i);
      return true;
    }
  );
});

test('login increments failed attempts on a wrong password, below the lockout threshold', async (t) => {
  t.mock.method(adminModel, 'findByEmailOrUsername', async () => makeAdmin({ failed_attempts: 1 }));
  const increment = t.mock.method(adminModel, 'incrementFailedAttempts', async () => {});
  const lock = t.mock.method(adminModel, 'lockAccount', async () => {});
  t.mock.method(adminLogModel, 'record', async () => {});

  await assert.rejects(
    () => authService.login({ identifier: 'admin', password: 'totally-wrong' }),
    (err) => {
      assert.equal(err.statusCode, 401);
      return true;
    }
  );
  assert.equal(increment.mock.calls.length, 1);
  assert.equal(lock.mock.calls.length, 0);
});

test('login locks the account once failed attempts reach the configured max', async (t) => {
  t.mock.method(adminModel, 'findByEmailOrUsername', async () =>
    makeAdmin({ failed_attempts: env.loginAttempts.max - 1 })
  );
  t.mock.method(adminModel, 'incrementFailedAttempts', async () => {});
  const lock = t.mock.method(adminModel, 'lockAccount', async () => {});
  const logs = [];
  t.mock.method(adminLogModel, 'record', async (args) => logs.push(args));

  await assert.rejects(
    () => authService.login({ identifier: 'admin', password: 'totally-wrong' }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /locked/i);
      return true;
    }
  );
  assert.equal(lock.mock.calls.length, 1);
  assert.ok(logs.some((l) => l.action === 'account_locked'));
});

test('successful login resets failed attempts and returns a token plus the public admin shape', async (t) => {
  t.mock.method(adminModel, 'findByEmailOrUsername', async () => makeAdmin({ failed_attempts: 2 }));
  const reset = t.mock.method(adminModel, 'resetFailedAttempts', async () => {});
  t.mock.method(adminLogModel, 'record', async () => {});

  const { token, admin } = await authService.login({ identifier: 'admin', password: CORRECT_PASSWORD });

  assert.equal(reset.mock.calls.length, 1);
  assert.equal(typeof token, 'string');
  assert.equal(admin.id, 1);
  assert.equal(admin.password_hash, undefined, 'the public admin shape must not leak the password hash');
});
