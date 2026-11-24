import { test, expect } from '../fixtures';
import { bearer } from '../helpers/api';

// Every protected route must reject anonymous callers (401) and callers with
// the wrong role (403). Add new routes here whenever you add them to server.ts.
const adminOnly = [
  ['GET', '/api/admin/queue/stats'],
  ['GET', '/api/admin/surveys'],
  ['GET', '/api/admin/join-requests'],
  ['GET', '/api/admin/exams'],
  ['GET', '/api/admin/enrollments/all'],
  ['GET', '/api/admin/badges'],
  ['GET', '/api/admin/announcements'],
  ['GET', '/api/admin/settings'],
  ['POST', '/api/admin/users'],
  ['POST', '/api/admin/categories'],
  ['POST', '/api/admin/grade-levels'],
  ['POST', '/api/admin/announcements'],
  ['POST', '/api/admin/exams/assign'],
] as const;

const staffOrAdmin = [
  ['GET', '/api/admin/bootstrap'],
  ['GET', '/api/admin/stats'],
  ['GET', '/api/admin/users'],
  ['GET', '/api/admin/content'],
  ['GET', '/api/admin/quizzes'],
  ['GET', '/api/admin/sessions'],
  ['GET', '/api/admin/logs'],
  ['GET', '/api/admin/payments'],
  ['GET', '/api/admin/course-requests'],
  ['GET', '/api/admin/uploads'],
  ['POST', '/api/admin/content'],
  ['POST', '/api/admin/quizzes'],
  ['POST', '/api/admin/sessions'],
  ['POST', '/api/admin/payments'],
] as const;

const call = (request: any, method: string, path: string, headers?: Record<string, string>) =>
  request.fetch(path, { method, headers, data: method === 'GET' ? undefined : {} });

test.describe('RBAC: anonymous callers', () => {
  for (const [m, p] of [...adminOnly, ...staffOrAdmin]) {
    test(`${m} ${p} -> 401 without a token`, async ({ request }) => {
      expect((await call(request, m, p)).status()).toBe(401);
    });
    test(`${m} ${p} -> 403 with a forged token`, async ({ request }) => {
      expect((await call(request, m, p, bearer('a.b.c'))).status()).toBe(403);
    });
  }
});

test.describe('RBAC: wrong role', () => {
  for (const [m, p] of adminOnly) {
    for (const role of ['teacher', 'student'] as const) {
      test(`${m} ${p} -> 403 for ${role}`, async ({ request, sessions }) => {
        expect((await call(request, m, p, sessions[role].headers)).status()).toBe(403);
      });
    }
  }
  for (const [m, p] of staffOrAdmin) {
    test(`${m} ${p} -> 403 for student`, async ({ request, sessions }) => {
      expect((await call(request, m, p, sessions.student.headers)).status()).toBe(403);
    });
  }
  test('staff/admin GET routes succeed for teacher and admin', async ({ request, sessions }) => {
    for (const role of ['teacher', 'admin', 'superadmin'] as const) {
      for (const [m, p] of staffOrAdmin.filter(([m]) => m === 'GET')) {
        const res = await call(request, m, p, sessions[role].headers);
        expect(res.status(), `${role} ${p}`).toBeLessThan(400);
      }
    }
  });
  test('admin GET routes succeed for admin and superadmin', async ({ request, sessions }) => {
    for (const role of ['admin', 'superadmin'] as const) {
      for (const [m, p] of adminOnly.filter(([m]) => m === 'GET')) {
        const res = await call(request, m, p, sessions[role].headers);
        expect(res.status(), `${role} ${p}`).toBeLessThan(400);
      }
    }
  });
  test('only superadmin can create admin accounts', async ({ request, sessions }) => {
    const mk = (headers: any, tag: string) =>
      request.post('/api/admin/users', {
        headers,
        data: { name: 'Promo', email: `promo-${tag}-${Date.now()}@example.com`, role: 'admin' },
      });
    expect((await mk(sessions.admin.headers, 'a')).status()).toBe(403);
    expect((await mk(sessions.superadmin.headers, 's')).status()).toBe(201);
  });
});
