process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const test = require('node:test');
const assert = require('node:assert/strict');

const adminModel = require('../src/models/admin.model');
const userModel = require('../src/models/user.model');
const { authenticateAdmin, authenticateUser } = require('../src/middleware/auth.middleware');

function fakeRes() {
  return { cleared: false, clearCookie() { this.cleared = true; } };
}

// Runs an auth.middleware function and resolves with whatever it passes to next()
// (undefined on success, an Error/AppError on rejection).
function runMiddleware(fn, req, res) {
  return new Promise((resolve) => {
    fn(req, res, (err) => resolve(err));
  });
}

// Regression tests for the bug found while manually testing the app: admin.id
// and user.id are independent sequences that both start at 1, so a USER token
// with sub=1 was being accepted as admin id=1 because authenticateAdmin only
// checked the id, never the token's `role` claim. Same bug existed in reverse
// on authenticateUser.

test('authenticateAdmin rejects a USER-role token even if that id exists in the admins table', async (t) => {
  const findById = t.mock.method(adminModel, 'findById', async () => ({
    id: 1, username: 'admin', email: 'a@a.com', created_at: new Date(),
  }));
  const req = { tokenPayload: { sub: 1, role: 'USER' } };
  const res = fakeRes();

  const err = await runMiddleware(authenticateAdmin, req, res);

  assert.ok(err, 'expected an error to be passed to next()');
  assert.equal(err.statusCode, 401);
  assert.equal(findById.mock.calls.length, 0, 'role check must short-circuit before ever hitting the DB');
  assert.equal(req.admin, undefined);
});

test('authenticateAdmin accepts a valid ADMIN-role token', async (t) => {
  t.mock.method(adminModel, 'findById', async (id) => ({
    id, username: 'admin', email: 'a@a.com', created_at: new Date(),
  }));
  const req = { tokenPayload: { sub: 1, role: 'ADMIN' } };
  const res = fakeRes();

  const err = await runMiddleware(authenticateAdmin, req, res);

  assert.equal(err, undefined);
  assert.equal(req.admin.id, 1);
});

test('authenticateAdmin rejects when the admin id no longer exists', async (t) => {
  t.mock.method(adminModel, 'findById', async () => null);
  const req = { tokenPayload: { sub: 999, role: 'ADMIN' } };
  const res = fakeRes();

  const err = await runMiddleware(authenticateAdmin, req, res);

  assert.ok(err);
  assert.equal(err.statusCode, 401);
  assert.equal(res.cleared, true);
});

test('authenticateUser rejects an ADMIN-role token even if that id exists in the users table', async (t) => {
  const findById = t.mock.method(userModel, 'findById', async () => ({ id: 1, username: 'u', is_active: 1 }));
  const req = { tokenPayload: { sub: 1, role: 'ADMIN' } };
  const res = fakeRes();

  const err = await runMiddleware(authenticateUser, req, res);

  assert.ok(err);
  assert.equal(err.statusCode, 401);
  assert.equal(findById.mock.calls.length, 0, 'role check must short-circuit before ever hitting the DB');
});

test('authenticateUser rejects a disabled account', async (t) => {
  t.mock.method(userModel, 'findById', async () => ({ id: 1, username: 'u', is_active: 0 }));
  const req = { tokenPayload: { sub: 1, role: 'USER' } };
  const res = fakeRes();

  const err = await runMiddleware(authenticateUser, req, res);

  assert.ok(err);
  assert.match(err.message, /disabled/);
});

test('authenticateUser accepts a valid, active USER-role token', async (t) => {
  t.mock.method(userModel, 'findById', async (id) => ({ id, username: 'u', is_active: 1 }));
  const req = { tokenPayload: { sub: 1, role: 'USER' } };
  const res = fakeRes();

  const err = await runMiddleware(authenticateUser, req, res);

  assert.equal(err, undefined);
  assert.equal(req.user.id, 1);
});
