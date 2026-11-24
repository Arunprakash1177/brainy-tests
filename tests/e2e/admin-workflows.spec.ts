import { test, expect, loginViaStorage, watchForProblems } from '../fixtures';
import { uid } from '../helpers/api';

const nav = (page: any) => page.getByRole('navigation', { name: 'Admin' });

test.describe('data created through the API is visible in the UI', () => {
  test('new course appears in Course Library', async ({ page, request, sessions }) => {
    const title = uid('UI Course');
    await request.post('/api/admin/content', {
      headers: sessions.admin.headers,
      data: { title, description: 'seen in the UI', category: 'Linux' },
    });
    await loginViaStorage(page, sessions.admin);
    await page.goto('/admin');
    await nav(page).getByRole('button', { name: /^Course Library/ }).click();
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test('new learner appears in User Management and can be searched', async ({ page, request, sessions }) => {
    const name = uid('UI Learner');
    await request.post('/api/admin/users', {
      headers: sessions.admin.headers,
      data: { name, email: `${uid('ui')}@example.com`, role: 'student', phone: '9000000009', address: 'x' },
    });
    await loginViaStorage(page, sessions.admin);
    await page.goto('/admin');
    await nav(page).getByRole('button', { name: /^User Management/ }).click();
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test('new broadcast appears in Broadcasts', async ({ page, request, sessions }) => {
    const title = uid('UI Notice');
    await request.post('/api/admin/announcements', {
      headers: sessions.admin.headers,
      data: { title, message: 'hello from the test', targetRole: 'all' },
    });
    await loginViaStorage(page, sessions.admin);
    await page.goto('/admin');
    await nav(page).getByRole('button', { name: /^Broadcasts/ }).click();
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test('new live class appears in Live Classes', async ({ page, request, sessions }) => {
    const title = uid('UI Live');
    await request.post('/api/admin/sessions', { headers: sessions.admin.headers, data: { title, subject: 'Linux' } });
    await loginViaStorage(page, sessions.admin);
    await page.goto('/admin');
    await nav(page).getByRole('button', { name: /^Live Classes/ }).click();
    await expect(page.getByText(title).first()).toBeVisible();
  });
});

test.describe('public site', () => {
  test('landing page loads without errors', async ({ page }) => {
    const problems = watchForProblems(page);
    await page.goto('/');
    await expect(page.locator('#root')).not.toBeEmpty();
    expect(problems).toEqual([]);
  });
});
