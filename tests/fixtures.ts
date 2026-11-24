import { test as base, expect, Page } from '@playwright/test';
import { login, Role, bearer } from './helpers/api';

type Session = { token: string; user: any; headers: { Authorization: string } };
type Fixtures = { sessions: Record<Role, Session> };

export const test = base.extend<{}, Fixtures>({
  sessions: [
    async ({ playwright }, use) => {
      const baseURL = process.env.BASE_URL || `http://localhost:${process.env.TEST_PORT || '3100'}`;
      const ctx = await playwright.request.newContext({ baseURL });
      const out = {} as Record<Role, Session>;
      for (const r of ['superadmin', 'admin', 'teacher', 'student'] as Role[]) {
        const { token, user } = await login(ctx, r);
        out[r] = { token, user, headers: bearer(token) };
      }
      await ctx.dispose();
      await use(out);
    },
    { scope: 'worker' },
  ],
});

export { expect };

/** Log in through the API and inject the JWT so UI tests skip the login form. */
export async function loginViaStorage(page: Page, session: Session) {
  await page.addInitScript((t) => localStorage.setItem('brainy_auth_token', t), session.token);
}

/**
 * Collects anything that indicates a broken screen: uncaught exceptions,
 * console errors, failed requests and 5xx API responses.
 */
export function watchForProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Browsers log every non-2xx fetch as a console error; real 5xx are caught below.
    if (/Failed to load resource.*(401|403|404)/.test(t)) return;
    problems.push(`console.error: ${t}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    if (r.url().startsWith('http') && !/unsplash|googleapis|gstatic|youtube/.test(r.url()))
      problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
  });
  return problems;
}
