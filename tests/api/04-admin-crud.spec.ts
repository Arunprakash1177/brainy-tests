import { test, expect } from '../fixtures';
import { uid } from '../helpers/api';

test.describe('users', () => {
  test('create -> list -> update -> delete', async ({ request, sessions }) => {
    const h = sessions.admin.headers;
    const email = `${uid('user')}@example.com`;

    // Students require phone + address
    const bad = await request.post('/api/admin/users', { headers: h, data: { name: 'No Phone', email, role: 'student' } });
    expect(bad.status()).toBe(400);

    const created = await request.post('/api/admin/users', {
      headers: h,
      data: { name: 'CRUD Student', email, role: 'student', phone: '9000000001', address: '1 Test Lane', grade: 'Beginner' },
    });
    expect(created.status()).toBe(201);
    const user = await created.json();
    expect(user.passwordHash).toBeUndefined();
    expect(user.initialPassword).toBeTruthy();

    const dup = await request.post('/api/admin/users', {
      headers: h,
      data: { name: 'Dup', email, role: 'student', phone: '9000000001', address: 'x' },
    });
    expect(dup.status()).toBe(400);

    const list = await request.get('/api/admin/users', { headers: h });
    expect(JSON.stringify(await list.json())).toContain(email);

    const upd = await request.put(`/api/admin/users/${user.id}`, { headers: h, data: { name: 'CRUD Student Renamed' } });
    expect(upd.ok(), await upd.text()).toBeTruthy();

    const del = await request.delete(`/api/admin/users/${user.id}`, { headers: h });
    expect(del.ok(), await del.text()).toBeTruthy();
    const after = await request.get('/api/admin/users', { headers: h });
    expect(JSON.stringify(await after.json())).not.toContain(email);
  });

  test('new user logs in with the generated password', async ({ request, sessions }) => {
    const email = `${uid('first')}@example.com`;
    const c = await request.post('/api/admin/users', {
      headers: sessions.admin.headers,
      data: { name: 'First Login', email, role: 'teacher' },
    });
    const { initialPassword } = await c.json();
    const res = await request.post('/api/auth/login', { data: { email, password: initialPassword } });
    expect(res.status()).toBe(200);
    expect((await res.json()).user.mustChangePassword).toBeTruthy();
  });
});

test.describe('courses / content', () => {
  test('create validates, toggles status, updates, deletes', async ({ request, sessions }) => {
    const h = sessions.admin.headers;
    expect((await request.post('/api/admin/content', { headers: h, data: { title: 'x' } })).status()).toBe(400);

    const title = uid('Course');
    const c = await request.post('/api/admin/content', {
      headers: h,
      data: { title, description: 'E2E course', category: 'Linux', type: 'course', accessType: 'Paid', gradeLevel: 'Beginner' },
    });
    expect(c.status()).toBe(201);
    const course = await c.json();
    expect(course.price).toBe(999); // default paid price

    const toggled = await request.patch(`/api/admin/content/${course.id}/status`, { headers: h });
    expect(toggled.ok()).toBeTruthy();

    const put = await request.put(`/api/admin/content/${course.id}`, { headers: h, data: { title: title + '-edited', description: 'd', category: 'Linux' } });
    expect(put.ok(), await put.text()).toBeTruthy();

    // lessons
    const les = await request.post(`/api/admin/courses/${course.id}/lessons`, { headers: h, data: { title: 'Lesson 1', contentType: 'video' } });
    expect(les.status()).toBe(201);
    const lesson = await les.json();
    expect((await request.post(`/api/admin/courses/${course.id}/lessons`, { headers: h, data: {} })).status()).toBe(400);
    const lessons = await request.get(`/api/courses/${course.id}/lessons`);
    expect(JSON.stringify(await lessons.json())).toContain('Lesson 1');
    expect((await request.put(`/api/admin/lessons/${lesson.id}`, { headers: h, data: { title: 'Lesson 1b' } })).ok()).toBeTruthy();
    expect((await request.delete(`/api/admin/lessons/${lesson.id}`, { headers: h })).ok()).toBeTruthy();

    expect((await request.delete(`/api/admin/content/${course.id}`, { headers: h })).ok()).toBeTruthy();
  });

  test('a teacher cannot change another author\'s course', async ({ request, sessions }) => {
    const c = await request.post('/api/admin/content', {
      headers: sessions.admin.headers,
      data: { title: uid('Owned'), description: 'd', category: 'Linux', author: 'Someone Else' },
    });
    const course = await c.json();
    const res = await request.patch(`/api/admin/content/${course.id}/status`, { headers: sessions.teacher.headers });
    expect(res.status()).toBe(403);
  });
});

test.describe('quizzes', () => {
  test('create with questions, publish toggle, update, delete', async ({ request, sessions }) => {
    const h = sessions.admin.headers;
    expect((await request.post('/api/admin/quizzes', { headers: h, data: { title: 'x' } })).status()).toBe(400);

    const created = await request.post('/api/admin/quizzes', {
      headers: h,
      data: {
        title: uid('Quiz'), category: 'Linux', gradeLevel: 'Beginner', timeLimitMinutes: 5, pointsReward: 30,
        questions: [{ questionText: 'Which command lists files?', options: ['ls', 'cd', 'rm', 'mv'], correctAnswerIndex: 0 }],
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const quiz = await created.json();
    expect(quiz.questionsCount ?? quiz.questions?.length).toBe(1);

    expect((await request.patch(`/api/admin/quizzes/${quiz.id}/status`, { headers: h })).ok()).toBeTruthy();
    expect((await request.put(`/api/admin/quizzes/${quiz.id}`, { headers: h, data: { title: 'renamed', category: 'Linux', gradeLevel: 'Beginner', questions: [] } })).ok()).toBeTruthy();
    expect((await request.delete(`/api/admin/quizzes/${quiz.id}`, { headers: h })).ok()).toBeTruthy();
  });
});

test.describe('live sessions, announcements, payments, categories', () => {
  test('live session lifecycle', async ({ request, sessions }) => {
    const h = sessions.teacher.headers;
    expect((await request.post('/api/admin/sessions', { headers: h, data: {} })).status()).toBe(400);
    const c = await request.post('/api/admin/sessions', { headers: h, data: { title: uid('Live'), subject: 'Linux' } });
    expect(c.status()).toBe(201);
    const s = await c.json();
    expect((await request.patch(`/api/admin/sessions/${s.id}/status`, { headers: h, data: { status: 'completed' } })).ok()).toBeTruthy();
    expect((await request.delete(`/api/admin/sessions/${s.id}`, { headers: h })).ok()).toBeTruthy();
  });

  test('announcement is created, visible publicly, then deleted', async ({ request, sessions }) => {
    const h = sessions.admin.headers;
    expect((await request.post('/api/admin/announcements', { headers: h, data: { title: 'x' } })).status()).toBe(400);
    const title = uid('Notice');
    const c = await request.post('/api/admin/announcements', { headers: h, data: { title, message: 'hello', targetRole: 'all' } });
    expect(c.status()).toBe(201);
    const a = await c.json();
    const pub = await request.get('/api/public/announcements');
    expect(JSON.stringify(await pub.json())).toContain(title);
    expect((await request.delete(`/api/admin/announcements/${a.id}`, { headers: h })).ok()).toBeTruthy();
  });

  test('payment record lifecycle', async ({ request, sessions }) => {
    const h = sessions.admin.headers;
    const invoiceNumber = uid('INV');
    const c = await request.post('/api/admin/payments', {
      headers: h,
      data: { studentName: 'Pay Test', studentEmail: 'pay@example.com', courseOrGrade: 'Linux', amount: 1500, dueDate: '2026-12-31', status: 'pending', invoiceNumber },
    });
    expect(c.ok(), await c.text()).toBeTruthy();
    const list = await (await request.get('/api/admin/payments', { headers: h })).json();
    const rec = (Array.isArray(list) ? list : list.payments).find((p: any) => p.invoiceNumber === invoiceNumber);
    expect(rec, 'created invoice must appear in list').toBeTruthy();
    expect((await request.patch(`/api/admin/payments/${rec.id}/status`, { headers: h, data: { status: 'paid' } })).ok()).toBeTruthy();
    expect((await request.delete(`/api/admin/payments/${rec.id}`, { headers: h })).ok()).toBeTruthy();
  });

  test('category and grade level create/delete', async ({ request, sessions }) => {
    const h = sessions.admin.headers;
    const name = uid('Cat');
    expect((await request.post('/api/admin/categories', { headers: h, data: {} })).status()).toBe(400);
    expect((await request.post('/api/admin/categories', { headers: h, data: { name } })).ok()).toBeTruthy();
    expect(JSON.stringify(await (await request.get('/api/categories')).json())).toContain(name);
    expect((await request.delete(`/api/admin/categories/${encodeURIComponent(name)}`, { headers: h })).ok()).toBeTruthy();

    const g = uid('Grade');
    expect((await request.post('/api/admin/grade-levels', { headers: h, data: { name: g } })).ok()).toBeTruthy();
    expect((await request.delete(`/api/admin/grade-levels/${encodeURIComponent(g)}`, { headers: h })).ok()).toBeTruthy();
  });

  test('join request can be approved/updated and deleted by admin', async ({ request, sessions }) => {
    await request.post('/api/public/join-request', { data: { studentName: uid('Lead'), parentPhone: '9746032479' } });
    const list = await (await request.get('/api/admin/join-requests', { headers: sessions.admin.headers })).json();
    const arr = Array.isArray(list) ? list : list.requests;
    expect(arr.length).toBeGreaterThan(0);
    const id = arr[0].id;
    expect((await request.patch(`/api/admin/join-requests/${id}`, { headers: sessions.admin.headers, data: { status: 'contacted' } })).ok()).toBeTruthy();
    expect((await request.delete(`/api/admin/join-requests/${id}`, { headers: sessions.admin.headers })).ok()).toBeTruthy();
  });
});
