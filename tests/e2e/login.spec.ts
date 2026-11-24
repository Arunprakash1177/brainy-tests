import { test, expect } from '../fixtures';
import { USERS } from '../helpers/api';
import { watchForProblems } from '../fixtures';

// The admin login screen is shown at /admin or ?portal=admin.
async function adminLogin(page: any, who: keyof typeof USERS) {
  await page.goto('/admin');
  await page.locator('input[type="email"]').first().fill(USERS[who].email);
  await page.locator('input[placeholder="••••••••"]').first().fill(USERS[who].password);
  await page.getByRole('button', { name: /Sign In to Admin Panel/i }).click();
}

test.describe('admin login screen', () => {
  test('admin signs in, sees the dashboard, signs out', async ({ page }) => {
    const problems = watchForProblems(page);
    await adminLogin(page, 'admin');
    await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('brainy_auth_token'))).toBeTruthy();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('brainy_auth_token'))).toBeNull();
    expect(problems).toEqual([]);
  });

  test('wrong password shows an error and stays signed out', async ({ page }) => {
    await page.goto('/admin');
    await page.locator('input[type="email"]').first().fill(USERS.admin.email);
    await page.locator('input[placeholder="••••••••"]').first().fill('wrong-password');
    await page.getByRole('button', { name: /Sign In to Admin Panel/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
  });

  test('session survives a page reload', async ({ page }) => {
    await adminLogin(page, 'admin');
    await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();
  });

  test('an expired or tampered token drops back to the login screen', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('brainy_auth_token', 'tampered.token.value'));
    await page.goto('/admin');
    await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });
});

test.describe('learner and parent portals', () => {
  test('learner lands in the learner portal, never in the admin workspace', async ({ page, sessions }) => {
    const problems = watchForProblems(page);
    await page.addInitScript((t) => localStorage.setItem('brainy_auth_token', t), sessions.student.token);
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
    await expect(page.locator('body')).toContainText(/learn|course|lab|quiz/i);
    expect(problems).toEqual([]);
  });

  test('learner who opens /admin still cannot see the admin workspace', async ({ page, sessions }) => {
    await page.addInitScript((t) => localStorage.setItem('brainy_auth_token', t), sessions.student.token);
    await page.goto('/admin');
    await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
  });
});
