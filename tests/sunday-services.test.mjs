import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.mjs';
import { upcomingSundays } from '../server/services.mjs';

const berlin = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

test('Sonntage bleiben bei Sommerzeit, Winterzeit und Jahreswechsel um 11 Uhr in Berlin', () => {
  for (const now of ['2027-03-21T12:00:00Z', '2027-10-24T12:00:00Z', '2026-12-27T12:00:00Z']) {
    const services = upcomingSundays(new Date(now));
    assert.equal(services.length, 12);
    assert.equal(new Set(services.map(service => service.id)).size, 12);
    for (const service of services) {
      assert.equal(berlin.format(new Date(service.startsAt)), 'Sunday 11:00');
      assert.equal(berlin.format(new Date(service.meetingAt)), 'Sunday 10:30');
    }
  }
  assert.deepEqual(upcomingSundays(new Date('2027-03-21T12:00:00Z')).slice(0, 2).map(service => service.startsAt), ['2027-03-21T10:00:00.000Z', '2027-03-28T09:00:00.000Z']);
  assert.deepEqual(upcomingSundays(new Date('2027-10-24T12:00:00Z')).slice(0, 2).map(service => service.startsAt), ['2027-10-24T09:00:00.000Z', '2027-10-31T10:00:00.000Z']);
  assert.deepEqual(upcomingSundays(new Date('2026-12-27T12:00:00Z')).slice(0, 2).map(service => service.id), ['sunday-2026-12-27', 'sunday-2027-01-03']);
  assert.equal(upcomingSundays(new Date('2026-11-01T21:00:00Z'))[0].id, 'sunday-2026-11-01');
  assert.equal(upcomingSundays(new Date('2026-11-01T23:00:00Z'))[0].id, 'sunday-2026-11-08');
});

test('Sonntagsserie: automatische Aufgaben, Rechte, keine Duplikate und unveränderte gespeicherte Haken', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'media-sundays-'));
  const dbPath = join(directory, 'test.sqlite');
  let clock = new Date('2026-11-02T12:00:00Z');
  let app;
  let origin;
  const start = async () => {
    app = await createApp({ dbPath, setupToken: 'sunday-test', now: () => clock });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${app.server.address().port}`;
  };
  const request = async (path, { cookie, method = 'GET', data } = {}) => {
    const response = await fetch(origin + path, { method, headers: { ...(cookie ? { cookie } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) }, body: data ? JSON.stringify(data) : undefined });
    return { status: response.status, value: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  try {
    await start();
    const admin = await request('/api/setup', { method: 'POST', data: { token: 'sunday-test', name: 'Admin', password: 'Start6' } });
    assert.equal(admin.status, 201);
    const member = await request('/api/members', { method: 'POST', cookie: admin.cookie, data: { name: 'Anna', password: 'Start6', roles: ['lighting'], isAdmin: false } });
    assert.equal(member.status, 201);
    const anna = await request('/api/login', { method: 'POST', data: { name: 'Anna', password: 'Start6' } });
    const inactive = await request('/api/members', { method: 'POST', cookie: admin.cookie, data: { name: 'Inaktiv', password: 'Start6', roles: [], isAdmin: false } });
    assert.equal((await request(`/api/members/${inactive.value.member.id}`, { method: 'PATCH', cookie: admin.cookie, data: { roles: [], isAdmin: false, active: false } })).status, 200);
    const templates = { common: [{ id: 'shared', title: 'Beamer prüfen', phase: 'before' }], roles: [{ id: 'lighting', title: 'Licht', tasks: [{ id: 'light', title: 'Licht prüfen', phase: 'before' }] }] };
    assert.equal((await request('/api/templates', { method: 'PUT', cookie: admin.cookie, data: templates })).status, 200);

    await t.test('Ohne Anmeldung werden keine Gottesdienste angelegt', async () => {
      assert.equal((await request('/api/app')).status, 401);
      assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM services').get()).n, 0);
    });

    const manual = await request('/api/services', { method: 'POST', cookie: admin.cookie, data: { title: 'Bestehender Sonntag', startsAt: '2026-11-08T10:00:00.000Z', memberIds: [admin.value.user.id, member.value.member.id] } });
    assert.equal(manual.status, 201);
    assert.equal((await request(`/api/services/${manual.value.id}`, { cookie: admin.cookie })).value.meetingAt, null);

    await t.test('Gleichzeitiges Laden ergänzt zwölf Sonntage ohne den vorhandenen Termin zu duplizieren', async () => {
      const responses = await Promise.all(Array.from({ length: 4 }, () => request('/api/app', { cookie: anna.cookie })));
      for (const response of responses) {
        assert.equal(response.status, 200);
        assert.equal(response.value.services.length, 12);
        assert.equal(response.value.members.length, 0);
        assert.equal(response.value.services.filter(service => service.startsAt === '2026-11-08T10:00:00.000Z').length, 1);
      }
      const detail = (await request('/api/services/sunday-2026-11-15', { cookie: admin.cookie })).value;
      const previous = (await request(`/api/services/${manual.value.id}`, { cookie: admin.cookie })).value;
      assert.equal(previous.title, 'Bestehender Sonntag');
      assert.equal(previous.meetingAt, '2026-11-08T09:30:00.000Z');
      assert.equal(detail.meetingAt, '2026-11-15T09:30:00.000Z');
      assert.equal(detail.personal.length, 2);
      assert.ok(detail.personal.every(person => person.userId !== inactive.value.member.id));
      assert.equal(detail.common.length, 1);
      assert.equal(detail.personal.find(person => person.userId === member.value.member.id).tasks.length, 1);
      assert.ok(detail.common.every(task => !task.done));
      assert.equal((await request('/api/services/sunday-2026-11-15', { cookie: anna.cookie })).value.personal.length, 1);
      assert.equal((await request('/api/services', { method: 'POST', cookie: anna.cookie, data: {} })).status, 403);
    });

    await t.test('Archivierte Dienste, Aufgaben und Vorlagen-Snapshots bleiben beim Neuladen und Neustart erhalten', async () => {
      const before = (await request('/api/services/sunday-2026-11-15', { cookie: anna.cookie })).value;
      const task = before.common[0];
      assert.equal((await request(`/api/services/sunday-2026-11-15/tasks/${task.id}`, { cookie: anna.cookie, method: 'PUT', data: { done: true, revision: task.revision } })).status, 200);
      assert.equal((await request('/api/services/sunday-2026-11-22', { cookie: admin.cookie, method: 'PATCH', data: { archived: true } })).status, 200);
      templates.common[0].title = 'Neue gemeinsame Aufgabe';
      assert.equal((await request('/api/templates', { cookie: admin.cookie, method: 'PUT', data: templates })).status, 200);
      clock = new Date('2026-11-09T12:00:00Z');
      await app.close();
      await start();
      const listing = await request('/api/app', { cookie: anna.cookie });
      assert.equal(listing.status, 200);
      assert.equal(listing.value.services.length, 13);
      assert.equal(listing.value.services.find(service => service.id === 'sunday-2026-11-22').archived, true);
      const after = (await request('/api/services/sunday-2026-11-15', { cookie: anna.cookie })).value;
      assert.equal(after.common[0].id, task.id);
      assert.equal(after.common[0].title, 'Beamer prüfen');
      assert.equal(after.common[0].done, true);
      assert.equal(after.common[0].revision, 1);
      const newest = listing.value.services.filter(service => service.id.startsWith('sunday-')).sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
      const fresh = (await request(`/api/services/${newest.id}`, { cookie: anna.cookie })).value;
      assert.equal(fresh.common[0].title, 'Neue gemeinsame Aufgabe');
      assert.equal(fresh.common[0].done, false);
    });

    await t.test('Zusätzliche manuelle Gottesdienste akzeptieren nur gültige frühere Versammlungszeiten', async () => {
      const value = { title: 'Zusatztermin', startsAt: '2026-11-14T10:00:00.000Z', memberIds: [member.value.member.id] };
      for (const meetingAt of ['invalid', 123, '2026-11-14T10:00:00.000Z', '2026-11-14T11:00:00.000Z']) assert.equal((await request('/api/services', { method: 'POST', cookie: admin.cookie, data: { ...value, meetingAt } })).status, 400);
      const created = await request('/api/services', { method: 'POST', cookie: admin.cookie, data: { ...value, meetingAt: '2026-11-14T09:30:00.000Z' } });
      assert.equal(created.status, 201);
      assert.equal((await request(`/api/services/${created.value.id}`, { cookie: anna.cookie })).value.meetingAt, '2026-11-14T09:30:00.000Z');
    });
  } finally {
    await app?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('Bestehende Dienste erhalten die neue optionale Versammlungszeit ohne Datenverlust', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'media-sunday-migration-'));
  const dbPath = join(directory, 'test.sqlite');
  let app;
  try {
    app = await createApp({ dbPath });
    await app.db.prepare('INSERT INTO services (id,title,starts_at,archived) VALUES (?,?,?,?)').run('previous', 'Alter Gottesdienst', '2026-10-25T10:00:00.000Z', 1);
    await app.db.prepare('INSERT INTO tasks (id,service_id,title,phase,position,done,revision) VALUES (?,?,?,?,?,?,?)').run('previous-task', 'previous', 'Beamer prüfen', 'before', 0, 1, 2);
    await app.close();
    app = null;
    const old = new DatabaseSync(dbPath);
    old.exec('ALTER TABLE services DROP COLUMN meeting_at');
    old.close();
    for (let i = 0; i < 2; i++) {
      app = await createApp({ dbPath });
      const service = await app.db.prepare('SELECT * FROM services WHERE id=?').get('previous');
      assert.equal(service.title, 'Alter Gottesdienst');
      assert.equal(service.archived, 1);
      assert.equal(service.meeting_at, null);
      const task = await app.db.prepare('SELECT * FROM tasks WHERE id=?').get('previous-task');
      assert.equal(task.done, 1);
      assert.equal(task.revision, 2);
      await app.close();
      app = null;
    }
  } finally {
    await app?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
