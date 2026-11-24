# Brainy Buddies test suite

Drop these into the root of the admin repo (`Brainy-Buddies-admin-main/`):

    playwright.config.ts
    tests/
    .github/workflows/e2e.yml

Then:

    npm i -D @playwright/test
    npx playwright install chromium
    npm test                 # everything (starts the app itself on :3100)
    npm run test:api         # API only, no browser, ~seconds
    npm run test:e2e         # browser tests
    npm run test:ui          # Playwright's interactive runner
    npm run test:report      # open the HTML report

Add to `package.json` scripts:

    "test": "playwright test",
    "test:api": "playwright test --project=api",
    "test:e2e": "playwright test --project=e2e-desktop --project=e2e-mobile",
    "test:ui": "playwright test --ui",
    "test:report": "playwright show-report"

## What is covered
- `01` health + every public endpoint returns valid JSON
- `02` login / register / me / suspended users / no user enumeration
- `03` RBAC matrix: every protected route x anonymous / forged token / wrong role
- `04` CRUD for users, courses, lessons, quizzes, live classes, announcements, payments, categories, join requests
- `05` learner journey: enrol -> approve/decline -> my courses, exams (submit once), quiz submit, profile, uploads
- `06` security expectations (see below)
- `e2e/login` admin login/logout/reload/tampered token, learner cannot reach admin UI
- `e2e/navigation` opens EVERY sidebar tab per role and fails on page errors, console errors, 5xx or a blank screen
- `e2e/admin-workflows` data created via API shows up in the UI

## Test data
Default run uses the app's built-in in-memory store (DATABASE_URL is blanked), so
nothing real is touched and every run starts clean. To test against Postgres set
`TEST_DATABASE_URL` to a throwaway database that has had `prisma db push` and
`npm run prisma:seed` applied. Against an already running server: `BASE_URL=https://staging... npm run test:api`
(this creates records; use staging, never production).

## Not covered yet (needs more work)
MFA/TOTP flow, forgot-password code flow, parent portal linking, bulk CSV import,
Gemini assistant, Redis queue mode, and click-through UI forms (create user / quiz /
course through modals). These need `data-testid` attributes in the components for
stable selectors; add them and extend `e2e/admin-workflows.spec.ts`.
