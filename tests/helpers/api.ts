import { APIRequestContext, expect } from '@playwright/test';

// These four exist in BOTH the in-memory fallback store (src/db.ts)
// and the Postgres seed (prisma/seed.ts).
export const USERS = {
  superadmin: { email: 'superadmin@infraops.dev', password: 'superadmin123' },
  admin: { email: 'admin@infraops.dev', password: 'admin123' },
  teacher: { email: 'meera.nair@infraops.dev', password: 'teacher123' },
  student: { email: 'aarav.s@example.com', password: 'student123' },
} as const;

export type Role = keyof typeof USERS;

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function login(request: APIRequestContext, who: Role) {
  const res = await request.post('/api/auth/login', { data: USERS[who] });
  expect(res.status(), `login as ${who}`).toBe(200);
  const body = await res.json();
  expect(body.token, `token for ${who} (is MFA enabled on this seed user?)`).toBeTruthy();
  return { token: body.token as string, user: body.user };
}
