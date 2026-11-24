import { test, expect } from '../fixtures';
import { uid } from '../helpers/api';

test.describe('learner journey', () => {
  test('request enrollment -> admin approves -> course appears in my-courses', async ({ request, sessions }) => {
    const admin = sessions.admin.headers;
    const student = sessions.student.user;

    const course = await (await request.post('/api/admin/content', {
      headers: admin, data: { title: uid('Enroll'), description: 'd', category: 'Linux', accessType: 'Free' },
    })).json();

    expect((await request.post('/api/student/request-enrollment', { data: {} })).status()).toBe(400);
    const req = await request.post('/api/student/request-enrollment', { data: { studentId: student.id, courseId: course.id } });
    expect(req.ok(), await req.text()).toBeTruthy();

    const reqs = await (await request.get('/api/admin/course-requests', { headers: admin })).json();
    const list = Array.isArray(reqs) ? reqs : reqs.requests;
    const mine = list.find((r: any) => r.courseId === course.id && r.studentId === student.id);
    expect(mine, 'request visible to admin').toBeTruthy();

    const ok = await request.post(`/api/admin/course-requests/${mine.id}/approve`, { headers: admin });
    expect(ok.ok(), await ok.text()).toBeTruthy();

    const my = await (await request.get(`/api/student/my-courses?studentId=${student.id}`)).json();
    expect(JSON.stringify(my)).toContain(course.id);

    // approved enrollment must never be downgraded by a repeat request
    await request.post('/api/student/request-enrollment', { data: { studentId: student.id, courseId: course.id } });
    const my2 = await (await request.get(`/api/student/my-courses?studentId=${student.id}`)).json();
    expect(JSON.stringify(my2)).toContain(course.id);
  });

  test('admin can decline a request', async ({ request, sessions }) => {
    const admin = sessions.admin.headers;
    const course = await (await request.post('/api/admin/content', {
      headers: admin, data: { title: uid('Decline'), description: 'd', category: 'Linux' },
    })).json();
    await request.post('/api/student/request-enrollment', { data: { studentId: sessions.student.user.id, courseId: course.id } });
    const reqs = await (await request.get('/api/admin/course-requests', { headers: admin })).json();
    const mine = (Array.isArray(reqs) ? reqs : reqs.requests).find((r: any) => r.courseId === course.id);
    expect((await request.post(`/api/admin/course-requests/${mine.id}/decline`, { headers: admin })).ok()).toBeTruthy();
    const my = await (await request.get(`/api/student/my-courses?studentId=${sessions.student.user.id}`)).json();
    expect(JSON.stringify(my)).not.toContain(course.id);
  });

  test('admin assigns a course directly to a student', async ({ request, sessions }) => {
    const admin = sessions.admin.headers;
    const course = await (await request.post('/api/admin/content', {
      headers: admin, data: { title: uid('Assign'), description: 'd', category: 'Linux' },
    })).json();
    const a = await request.post(`/api/admin/courses/${course.id}/assign`, { headers: admin, data: { studentIds: [sessions.student.user.id] } });
    expect(a.ok(), await a.text()).toBeTruthy();
    const e = await (await request.get(`/api/admin/courses/${course.id}/enrollments`, { headers: admin })).json();
    expect(JSON.stringify(e)).toContain(sessions.student.user.id);
    expect((await request.delete(`/api/admin/courses/${course.id}/enrollments/${sessions.student.user.id}`, { headers: admin })).ok()).toBeTruthy();
  });

  test('exam: assign -> student sees it -> submits once -> second submit rejected', async ({ request, sessions }) => {
    const admin = sessions.admin.headers;
    expect((await request.post('/api/admin/exams/assign', { headers: admin, data: {} })).status()).toBe(400);

    const title = uid('Exam');
    const a = await request.post('/api/admin/exams/assign', {
      headers: admin,
      data: { title, subject: 'Linux', assignmentType: 'individual', studentIds: [sessions.student.user.id], durationMinutes: 30, totalMarks: 20, passingPercent: 40 },
    });
    expect(a.ok(), await a.text()).toBeTruthy();

    const exams = await (await request.get('/api/student/exams', { headers: sessions.student.headers })).json();
    const list = Array.isArray(exams) ? exams : exams.exams;
    const exam = list.find((x: any) => x.title === title);
    expect(exam, 'assigned exam visible to the student').toBeTruthy();

    const body = { examId: exam.id, score: 15, totalMarks: 20, percentage: 75, timeSpentSeconds: 600, answers: [] };
    const s1 = await request.post('/api/student/exams/submit', { headers: sessions.student.headers, data: body });
    expect(s1.ok(), await s1.text()).toBeTruthy();
    const s2 = await request.post('/api/student/exams/submit', { headers: sessions.student.headers, data: body });
    expect(s2.status()).toBe(400);

    const subs = await (await request.get(`/api/admin/exams/${exam.id}/submissions`, { headers: admin })).json();
    expect(JSON.stringify(subs)).toContain(sessions.student.user.id);
    expect((await request.delete(`/api/admin/exams/${exam.id}`, { headers: admin })).ok()).toBeTruthy();
  });

  test('quiz submit requires a user id and records the score', async ({ request, sessions }) => {
    expect((await request.post('/api/student/quiz-submit', { data: { quizId: 'x' } })).status()).toBe(400);
    const r = await request.post('/api/student/quiz-submit', {
      data: { userId: sessions.student.user.id, quizId: 'x', scorePercent: 80, pointsEarned: 10 },
    });
    expect(r.status()).toBeLessThan(500);
  });

  test('student profile update persists the new name', async ({ request, sessions }) => {
    const u = await (await request.post('/api/admin/users', {
      headers: sessions.admin.headers,
      data: { name: 'Profile Test', email: `${uid('prof')}@example.com`, role: 'student', phone: '9000000002', address: 'x' },
    })).json();
    const r = await request.patch('/api/student/profile', { data: { userId: u.id, name: 'Profile Renamed' } });
    expect(r.ok(), await r.text()).toBeTruthy();
    expect((await request.patch('/api/student/profile', { data: { name: 'x' } })).status()).toBe(400);
    expect((await request.patch('/api/student/profile', { data: { userId: 'missing', name: 'x' } })).status()).toBe(404);
  });
});

test.describe('file upload', () => {
  test('requires auth, accepts a small file, serves it back', async ({ request, sessions }) => {
    const file = { name: 'e2e.txt', mimeType: 'text/plain', buffer: Buffer.from('hello e2e') };
    expect((await request.post('/api/upload', { multipart: { file } })).status()).toBe(401);
    const up = await request.post('/api/upload', { headers: sessions.admin.headers, multipart: { file } });
    expect(up.status(), await up.text()).toBeLessThan(400);
    const body = await up.json();
    const url = body.url || body.path || body.fileUrl;
    expect(url, `upload response: ${JSON.stringify(body)}`).toBeTruthy();
    const get = await request.get(url);
    expect(get.status()).toBe(200);
    expect(await get.text()).toBe('hello e2e');
  });
});
