import { test, expect } from '../fixtures';
import { uid } from '../helpers/api';

/**
 * These tests encode the behaviour a secure app SHOULD have. Reading server.ts
 * suggests several will FAIL today -- each failure is a real vulnerability to fix.
 * They use throwaway accounts so a failing run does not damage the seeded users.
 */
test.describe('security', () => {
  test('public registration cannot choose a privileged role', async ({ request }) => {
    for (const role of ['admin', 'superadmin', 'teacher']) {
      const email = `${uid('esc')}@example.com`;
      const res = await request.post('/api/auth/register', { data: { name: 'Escalate', email, password: 'Passw0rd!', role } });
      const body = await res.json().catch(() => ({}));
      expect(body.user?.role ?? 'rejected', `self-registered as ${role}`).not.toBe(role);
    }
  });

  test('change-password requires proof of identity', async ({ request, sessions }) => {
    const email = `${uid('victim')}@example.com`;
    const created = await (await request.post('/api/admin/users', {
      headers: sessions.admin.headers,
      data: { name: 'Victim', email, role: 'teacher', password: 'OriginalPass1!' },
    })).json();

    // Clear the first-login flag the way a normal user would
    const attack = await request.post('/api/auth/change-password', { data: { email, newPassword: 'Hacked123!' } });
    expect(attack.ok(), 'anonymous password reset must not succeed').toBeFalsy();

    const stillWorks = await request.post('/api/auth/login', { data: { email, password: 'OriginalPass1!' } });
    expect(stillWorks.status()).toBe(200);
    void created;
  });

  test('student data endpoints require authentication', async ({ request, sessions }) => {
    const id = sessions.student.user.id;
    for (const path of [
      `/api/student/${id}/enrollments`,
      `/api/student/payments?studentId=${id}`,
      `/api/student/my-courses?studentId=${id}`,
    ]) {
      const res = await request.get(path);
      expect(res.status(), `anonymous GET ${path}`).toBeGreaterThanOrEqual(401);
    }
  });

  test('a learner cannot read another learner\'s data', async ({ request, sessions }) => {
    const other = await (await request.post('/api/admin/users', {
      headers: sessions.admin.headers,
      data: { name: 'Other', email: `${uid('oth')}@example.com`, role: 'student', phone: '9000000003', address: 'x' },
    })).json();
    const res = await request.get(`/api/student/payments?studentId=${other.id}`, { headers: sessions.student.headers });
    expect([401, 403]).toContain(res.status());
  });

  test('quiz submit and profile edit cannot be forged for another user without a token', async ({ request, sessions }) => {
    const q = await request.post('/api/student/quiz-submit', {
      data: { userId: sessions.student.user.id, quizId: 'x', scorePercent: 100, pointsEarned: 100000, newTotalCoins: 999999 },
    });
    expect(q.status(), 'anonymous coin/score injection').toBeGreaterThanOrEqual(401);

    const p = await request.patch('/api/student/profile', { data: { userId: sessions.student.user.id, name: 'Defaced' } });
    expect(p.status(), 'anonymous profile edit').toBeGreaterThanOrEqual(401);
  });

  test('server does not fall back to a hard-coded JWT secret', async ({ request }) => {
    // server.ts: process.env.JWT_SECRET || 'brainy_buddies_super_secret_jwt_key_2026'
    const jwt = await import('jsonwebtoken').catch(() => null);
    test.skip(!jwt, 'jsonwebtoken not installed in test project');
    const forged = jwt!.sign({ id: 'x', email: 'a@b.c', role: 'superadmin', name: 'x' }, 'brainy_buddies_super_secret_jwt_key_2026');
    const res = await request.get('/api/admin/users', { headers: { Authorization: `Bearer ${forged}` } });
    expect(res.status(), 'token signed with the public default secret was accepted').toBe(403);
  });

  test('login responses and user lists never expose secrets', async ({ request, sessions }) => {
    const res = await request.get('/api/admin/users', { headers: sessions.admin.headers });
    expect(JSON.stringify(await res.json())).not.toMatch(/passwordHash|mfaSecret|\$2[aby]\$/);
  });
});
