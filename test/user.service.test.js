process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const userModel = require('../src/models/user.model');
const { hashPassword } = require('../src/utils/password');
const userService = require('../src/services/user.service');
const env = require('../src/config/env');

const CORRECT_PASSWORD = 'CorrectHorseBattery1!';
let correctHash;

before(async () => {
  correctHash = await hashPassword(CORRECT_PASSWORD);
});

function makeUser(overrides = {}) {
  return {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    password_hash: correctHash,
    is_active: 1,
    failed_attempts: 0,
    locked_until: null,
    created_at: new Date(),
    ...overrides,
  };
}

// --- register ---

test('register rejects a weak password before touching the database', async (t) => {
  const findByEmail = t.mock.method(userModel, 'findByEmail', async () => null);

  await assert.rejects(
    () => userService.register({ username: 'bob', email: 'bob@example.com', password: 'weak' }),
    (err) => {
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
  assert.equal(findByEmail.mock.calls.length, 0);
});

test('register rejects a duplicate email', async (t) => {
  t.mock.method(userModel, 'findByEmail', async () => makeUser());

  await assert.rejects(
    () => userService.register({ username: 'newname', email: 'alice@example.com', password: CORRECT_PASSWORD }),
    (err) => {
      assert.equal(err.statusCode, 409);
      return true;
    }
  );
});

test('register rejects a duplicate username when the email is free', async (t) => {
  t.mock.method(userModel, 'findByEmail', async () => null);
  t.mock.method(userModel, 'findByUsername', async () => makeUser());

  await assert.rejects(
    () => userService.register({ username: 'alice', email: 'new@example.com', password: CORRECT_PASSWORD }),
    (err) => {
      assert.equal(err.statusCode, 409);
      return true;
    }
  );
});

test('register succeeds and returns a public shape without the password hash', async (t) => {
  t.mock.method(userModel, 'findByEmail', async () => null);
  t.mock.method(userModel, 'findByUsername', async () => null);
  const create = t.mock.method(userModel, 'create', async ({ username, email }) => makeUser({ username, email }));

  const user = await userService.register({ username: 'newuser', email: 'new@example.com', password: CORRECT_PASSWORD });

  assert.equal(create.mock.calls.length, 1);
  assert.equal(user.username, 'newuser');
  assert.equal(user.password_hash, undefined);
});

// --- login ---

test('login rejects a disabled account even with the correct password', async (t) => {
  t.mock.method(userModel, 'findByEmailOrUsername', async () => makeUser({ is_active: 0 }));

  await assert.rejects(
    () => userService.login({ identifier: 'alice', password: CORRECT_PASSWORD }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /disabled/);
      return true;
    }
  );
});

test('login refuses a locked account regardless of password correctness', async (t) => {
  t.mock.method(userModel, 'findByEmailOrUsername', async () =>
    makeUser({ locked_until: new Date(Date.now() + 5 * 60 * 1000) })
  );

  await assert.rejects(
    () => userService.login({ identifier: 'alice', password: CORRECT_PASSWORD }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /locked/i);
      return true;
    }
  );
});

test('login locks the account once failed attempts reach the configured max', async (t) => {
  t.mock.method(userModel, 'findByEmailOrUsername', async () =>
    makeUser({ failed_attempts: env.loginAttempts.max - 1 })
  );
  t.mock.method(userModel, 'incrementFailedAttempts', async () => {});
  const lock = t.mock.method(userModel, 'lockAccount', async () => {});

  await assert.rejects(
    () => userService.login({ identifier: 'alice', password: 'totally-wrong' }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /locked/i);
      return true;
    }
  );
  assert.equal(lock.mock.calls.length, 1);
});

test('successful login resets failed attempts and returns a token plus the public user shape', async (t) => {
  t.mock.method(userModel, 'findByEmailOrUsername', async () => makeUser({ failed_attempts: 3 }));
  const reset = t.mock.method(userModel, 'resetFailedAttempts', async () => {});

  const { token, user } = await userService.login({ identifier: 'alice', password: CORRECT_PASSWORD });

  assert.equal(reset.mock.calls.length, 1);
  assert.equal(typeof token, 'string');
  assert.equal(user.id, 1);
  assert.equal(user.password_hash, undefined);
});
