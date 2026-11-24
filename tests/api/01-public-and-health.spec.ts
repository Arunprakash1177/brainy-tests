import { test, expect } from '@playwright/test';

test.describe('health and public endpoints', () => {
  test('health check reports healthy', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.queue).toBeDefined();
  });

  const publicGets = [
    '/api/public/content',
    '/api/public/quizzes',
    '/api/public/announcements',
    '/api/public/courses',
    '/api/public/notes',
    '/api/public/teachers',
    '/api/public/settings',
    '/api/public/surveys/config',
    '/api/categories',
    '/api/grade-levels',
    '/api/top-scorer',
    '/api/auth/setup-status',
  ];
  for (const path of publicGets) {
    test(`GET ${path} responds with valid JSON`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      const text = await res.text();
      expect(() => JSON.parse(text), `${path} must return JSON`).not.toThrow();
    });
  }

  test('robots.txt and sitemap.xml are served', async ({ request }) => {
    expect((await request.get('/robots.txt')).status()).toBe(200);
    expect((await request.get('/sitemap.xml')).status()).toBe(200);
  });

  test('public join request: validation and success', async ({ request }) => {
    const bad = await request.post('/api/public/join-request', { data: { studentName: '' } });
    expect(bad.status()).toBe(400);

    const tooLong = await request.post('/api/public/join-request', {
      data: { studentName: 'x'.repeat(121), parentPhone: '9746032479' },
    });
    expect(tooLong.status()).toBe(400);

    const ok = await request.post('/api/public/join-request', {
      data: { studentName: 'E2E Learner', parentPhone: '9746032479', grade: 'Beginner', notes: 'automated test' },
    });
    expect(ok.ok()).toBeTruthy();
  });

  test('unknown API path never returns a 5xx', async ({ request }) => {
    const res = await request.get('/api/does-not-exist');
    expect(res.status()).toBeLessThan(500);
  });
});
