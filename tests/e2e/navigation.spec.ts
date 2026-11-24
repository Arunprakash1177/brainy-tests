import { test, expect, loginViaStorage, watchForProblems } from '../fixtures';

// Mirrors Sidebar.tsx. Labels differ for teachers; ids are the contract.
const ADMIN_TABS = [
  'Overview', 'User Management', 'Course Library', 'Quiz Builder', 'Exam Panel',
  'CSV Templates & Import', 'Live Classes', 'Payments & Revenue', 'Lab XP & Badges',
  'Broadcasts', 'Diagnostic Surveys', 'Analytics',
];
const SUPERADMIN_ONLY = ['System Settings'];
const TEACHER_TABS = ['Instructor Overview', 'My Learners', 'My Courses', 'My Lab Quizzes', 'My Exam Panel', 'CSV Templates & Import', 'My Live Labs'];
const ADMIN_ONLY_FOR_TEACHER = ['Lab XP & Badges', 'Broadcasts', 'Diagnostic Surveys', 'Analytics', 'System Settings'];

const nav = (page: any) => page.getByRole('navigation', { name: 'Admin' });

test.describe('crawl every screen: no crashes, no 5xx, no console errors', () => {
  test('superadmin: all tabs render', async ({ page, sessions }) => {
    const problems = watchForProblems(page);
    await loginViaStorage(page, sessions.superadmin);
    await page.goto('/admin');
    await expect(nav(page)).toBeVisible();

    for (const label of [...ADMIN_TABS, ...SUPERADMIN_ONLY]) {
      await nav(page).getByRole('button', { name: new RegExp(`^${label}`) }).click();
      await page.waitForLoadState('networkidle');
      // a crashed React tree leaves #root empty
      await expect(page.locator('#root')).not.toBeEmpty();
      await expect(nav(page), `nav still present after opening ${label}`).toBeVisible();
      await expect(page.locator('main, [role="main"], #root').first()).toBeVisible();
    }
    expect(problems, 'problems seen while crawling').toEqual([]);
  });

  test('admin: all tabs render, System Settings is hidden', async ({ page, sessions }) => {
    const problems = watchForProblems(page);
    await loginViaStorage(page, sessions.admin);
    await page.goto('/admin');
    for (const label of ADMIN_TABS) {
      await nav(page).getByRole('button', { name: new RegExp(`^${label}`) }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#root')).not.toBeEmpty();
    }
    await expect(nav(page).getByRole('button', { name: /System Settings/ })).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('teacher: sees only the instructor tabs', async ({ page, sessions }) => {
    const problems = watchForProblems(page);
    await loginViaStorage(page, sessions.teacher);
    await page.goto('/admin');
    for (const label of TEACHER_TABS) {
      await nav(page).getByRole('button', { name: new RegExp(`^${label}`) }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#root')).not.toBeEmpty();
    }
    for (const label of ADMIN_ONLY_FOR_TEACHER) {
      await expect(nav(page).getByRole('button', { name: new RegExp(label) }), `${label} must be hidden`).toHaveCount(0);
    }
    expect(problems).toEqual([]);
  });
});

test.describe('layout', () => {
  test('no horizontal scroll on any admin tab', async ({ page, sessions }) => {
    await loginViaStorage(page, sessions.admin);
    await page.goto('/admin');
    const isMobile = (page.viewportSize()?.width ?? 1200) < 768;
    for (const label of ADMIN_TABS) {
      if (isMobile) await page.getByRole('button', { name: /menu/i }).first().click();
      await page.getByRole('button', { name: new RegExp(`^${label}`) }).first().click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${label} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });
});
