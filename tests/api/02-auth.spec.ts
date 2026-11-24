import { test, expect } from '../fixtures';
import { USERS, uid, bearer } from '../helpers/api';

test.describe('authentication', () => {
  for (const role of Object.keys(USERS) as (keyof typeof USERS)[]) {
    test(`login works for ${role} and never leaks the password hash`, async ({ request }) => {
      const res = await request.post('/api/auth/login', { data: USERS[role] });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.token).toBeTruthy();
      expect(body.user.email).toBe(USERS[role].email);
      expect(JSON.stringify(body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    });
  }

  test('wrong password -> 401', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: { email: USERS.admin.email, password: 'nope' } });
    expect(res.status()).toBe(401);
  });

  test('unknown email -> 401 with the same message as wrong password', async ({ request }) => {
    const a = await request.post('/api/auth/login', { data: { email: 'ghost@nowhere.dev', password: 'x' } });
    const b = await request.post('/api/auth/login', { data: { email: USERS.admin.email, password: 'x' } });
    expect(a.status()).toBe(401);
    expect((await a.json()).error).toBe((await b.json()).error); // no user enumeration
  });

  test('missing fields -> 400', async ({ request }) => {
    expect((await request.post('/api/auth/login', { data: {} })).status()).toBe(400);
    expect((await request.post('/api/auth/login', { data: { email: 'a@b.c' } })).status()).toBe(400);
  });

  test('email is case-insensitive and trimmed', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: `  ${USERS.admin.email.toUpperCase()} `, password: USERS.admin.password },
    });
    expect(res.status()).toBe(200);
  });

  test('/api/auth/me: valid, missing and garbage tokens', async ({ request, sessions }) => {
    const ok = await request.get('/api/auth/me', { headers: sessions.admin.headers });
    expect(ok.status()).toBe(200);
    expect((await request.get('/api/auth/me')).status()).toBe(401);
    expect((await request.get('/api/auth/me', { headers: bearer('garbage.token.here') })).status()).toBe(403);
  });

  test('register: validation, success, duplicate, then login with the new account', async ({ request }) => {
    const email = `${uid('reg')}@example.com`;
    expect((await request.post('/api/auth/register', { data: { email } })).status()).toBe(400);

    const ok = await request.post('/api/auth/register', { data: { name: 'Reg Test', email, password: 'Passw0rd!' } });
    expect(ok.status()).toBe(201);
    const body = await ok.json();
    expect(body.token).toBeTruthy();
    expect(body.user.role).toBe('student');

    const dup = await request.post('/api/auth/register', { data: { name: 'Reg Test', email, password: 'Passw0rd!' } });
    expect(dup.status()).toBe(400);

    const again = await request.post('/api/auth/login', { data: { email, password: 'Passw0rd!' } });
    expect(again.status()).toBe(200);
  });

  test('suspended user cannot log in', async ({ request, sessions }) => {
    const email = `${uid('susp')}@example.com`;
    const created = await request.post('/api/admin/users', {
      headers: sessions.admin.headers,
      data: { name: 'Suspend Me', email, role: 'student', phone: '9000000000', address: 'Test Street', password: 'Passw0rd!' },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const { id } = await created.json();

    const s = await request.patch(`/api/admin/users/${id}/status`, {
      headers: sessions.admin.headers,
      data: { status: 'suspended' },
    });
    expect(s.ok(), await s.text()).toBeTruthy();

    const res = await request.post('/api/auth/login', { data: { email, password: 'Passw0rd!' } });
    expect(res.status()).toBe(403);
  });
});
