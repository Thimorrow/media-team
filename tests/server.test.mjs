import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createApp } from '../server/app.mjs';

test('Media-Team API: Anmeldung, Berechtigungen, Gottesdienste und Persistenz', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'media-team-test-'));
  const dbPath = join(dir, 'test.sqlite');
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const schema = databaseUrl ? process.env.TEST_DATABASE_SCHEMA || `media_test_${randomUUID().replaceAll('-', '')}` : undefined;
  let app = await createApp({ dbPath, databaseUrl, schema, setupToken: 'test-setup-only' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  let origin = `http://127.0.0.1:${app.server.address().port}`;
  const request = async (path, { method = 'GET', data, cookie, headers = {} } = {}) => {
    const response = await fetch(origin + path, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers }, body: data ? JSON.stringify(data) : undefined });
    const value = await response.json();
    return { status: response.status, value, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  };
  let admin, anna, ben, outsider, serviceId, sharedId, annaTaskId, inviteToken;
  const secret = 'This is a strong test password!';
  const invite = async (address, roles = ['propresenter'], isAdmin = false) => {
    const issued = await request('/api/invites', { method: 'POST', cookie: admin.cookie, data: { email: address, roles, isAdmin } });
    assert.equal(issued.status, 201);
    return issued.value.token;
  };
  try {
    if (databaseUrl) await t.test('Postgres-Tabellen liegen im privaten Schema und Web-API-Rollen erhalten keinen Zugriff', async () => {
      const tables = await app.db.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_name IN ('users','sessions','invites','tasks')").all(schema);
      assert.equal(tables.length, 4);
      const apiRoles = await app.db.prepare("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')").all();
      for (const { rolname } of apiRoles) {
        assert.equal((await app.db.prepare("SELECT has_schema_privilege(?,?,'USAGE') AS allowed").get(rolname, schema)).allowed, false);
        assert.equal((await app.db.prepare("SELECT has_table_privilege(?,?,'SELECT') AS allowed").get(rolname, `${schema}.users`)).allowed, false);
        assert.equal((await app.db.prepare("SELECT has_table_privilege(?,?,'SELECT') AS allowed").get(rolname, `${schema}.sessions`)).allowed, false);
      }
    });
    await t.test('Erstes Admin-Konto braucht Einrichtungscode, sichere Sitzung und privates Passwort', async () => {
      assert.equal((await request('/api/session')).value.needsSetup, true);
      assert.equal((await request('/api/app')).status, 401);
      assert.equal((await request('/api/setup', { method: 'POST', data: { token: 'wrong', name: 'Admin', email: 'admin@example.test', password: secret } })).status, 403);
      const setup = await Promise.all([1, 2].map(() => request('/api/setup', { method: 'POST', data: { token: 'test-setup-only', name: 'Admin', email: 'admin@example.test', password: secret } })));
      assert.deepEqual(setup.map(response => response.status).sort(), [201, 409]);
      admin = setup.find(response => response.status === 201);
      assert.equal(admin.status, 201);
      assert.equal(admin.value.user.isAdmin, true);
      assert.match(admin.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
      assert.equal(admin.headers.get('cache-control'), 'no-store');
      assert.equal((await request('/api/session', { cookie: admin.cookie })).value.user.name, 'Admin');
      assert.equal((await request('/api/setup', { method: 'POST', data: {} })).status, 409);
      const stored = (await app.db.prepare('SELECT password_hash FROM users WHERE id=?').get(admin.value.user.id)).password_hash;
      assert.notEqual(stored, secret);
      assert.ok(!JSON.stringify(admin.value).includes(stored));
      assert.equal((await request('/api/login', { method: 'POST', data: { email: 'admin@example.test', password: 'wrong' } })).status, 401);
    });
    await t.test('Einladungen sind einmalig, zeitlich begrenzt und haben feste Rechte', async () => {
      inviteToken = await invite('anna@example.test');
      assert.equal((await request(`/api/invites/${inviteToken}`)).value.email, 'anna@example.test');
      anna = await request('/api/join', { method: 'POST', data: { token: inviteToken, name: 'Anna', password: secret, isAdmin: true } });
      assert.equal(anna.status, 201);
      assert.equal(anna.value.user.isAdmin, false);
      assert.equal((await request('/api/join', { method: 'POST', data: { token: inviteToken, name: 'Other', password: secret } })).status, 410);
      assert.equal((await request(`/api/invites/${inviteToken}`)).status, 404);
      const expired = await invite('expired@example.test');
      await app.db.prepare('UPDATE invites SET expires_at=0 WHERE token_hash=?').run(createHash('sha256').update(expired).digest('hex'));
      assert.equal((await request('/api/join', { method: 'POST', data: { token: expired, name: 'Expired', password: secret } })).status, 410);
      ben = await request('/api/join', { method: 'POST', data: { token: await invite('ben@example.test'), name: 'Ben', password: secret } });
      outsider = await request('/api/join', { method: 'POST', data: { token: await invite('other@example.test', ['lighting']), name: 'Other', password: secret } });
    });
    await t.test('Admin-Funktionen und CSRF sind serverseitig geschützt', async () => {
      assert.equal((await request('/api/templates', { cookie: anna.cookie })).status, 403);
      assert.equal((await request('/api/invites', { method: 'POST', cookie: anna.cookie, data: { email: 'evil@example.test', roles: [], isAdmin: true } })).status, 403);
      assert.equal((await request('/api/services', { method: 'POST', cookie: anna.cookie, data: {} })).status, 403);
      assert.equal((await request('/api/invites', { method: 'POST', cookie: admin.cookie, data: {}, headers: { Origin: 'https://evil.example' } })).status, 403);
      assert.equal((await request('/api/logout', { method: 'POST', cookie: admin.cookie, data: {}, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
      assert.equal((await request('/api/invites', { method: 'POST', cookie: admin.cookie, data: { email: 'evil@example.test', roles: ['nonexistent'], isAdmin: false } })).status, 400);
      assert.equal((await request('/api/app', { cookie: anna.cookie })).value.members.length, 0);
    });
    await t.test('Gottesdienst erzeugt gemeinsame und getrennte persönliche Aufgaben', async () => {
      const created = await request('/api/services', { method: 'POST', cookie: admin.cookie, data: { title: 'Sonntagsgottesdienst', startsAt: '2026-11-01T09:00:00.000Z', memberIds: [anna.value.user.id, ben.value.user.id] } });
      assert.equal(created.status, 201);
      serviceId = created.value.id;
      const detail = (await request(`/api/services/${serviceId}`, { cookie: admin.cookie })).value;
      assert.equal(detail.personal.length, 2);
      assert.equal(detail.common.length, 14);
      assert.ok(!detail.common.some(task => task.title.includes('Ladestation')));
      assert.ok(detail.common.some(task => task.title === 'Beamer einschalten'));
      const annaTasks = detail.personal.find(member => member.userId === anna.value.user.id).tasks;
      const benTasks = detail.personal.find(member => member.userId === ben.value.user.id).tasks;
      assert.equal(annaTasks.length, 6);
      assert.equal(benTasks.length, 6);
      assert.notEqual(annaTasks[0].id, benTasks[0].id);
      sharedId = detail.common[0].id;
      annaTaskId = annaTasks[0].id;
      assert.equal((await request(`/api/services/${serviceId}`, { cookie: anna.cookie })).value.personal.length, 1);
      assert.equal((await request(`/api/services/${serviceId}`, { cookie: outsider.cookie })).status, 403);
      assert.equal((await request('/api/app', { cookie: outsider.cookie })).value.services.length, 0);
    });
    await t.test('Gemeinsamer Haken für alle; persönliche Haken isoliert; veraltete Updates werden abgewiesen', async () => {
      const changed = await request(`/api/services/${serviceId}/tasks/${sharedId}`, { method: 'PUT', cookie: anna.cookie, data: { done: true, revision: 0 } });
      assert.equal(changed.status, 200);
      assert.equal(changed.value.task.doneBy, 'Anna');
      const benView = (await request(`/api/services/${serviceId}`, { cookie: ben.cookie })).value;
      assert.equal(benView.common.find(task => task.id === sharedId).done, true);
      assert.equal((await request(`/api/services/${serviceId}/tasks/${sharedId}`, { method: 'PUT', cookie: ben.cookie, data: { done: false, revision: 0 } })).status, 409);
      assert.equal((await request(`/api/services/${serviceId}/tasks/${annaTaskId}`, { method: 'PUT', cookie: ben.cookie, data: { done: true, revision: 0 } })).status, 403);
      assert.equal((await request(`/api/services/${serviceId}/tasks/${sharedId}`, { method: 'PUT', cookie: outsider.cookie, data: { done: true, revision: 1 } })).status, 403);
      assert.equal((await request(`/api/services/${serviceId}/tasks/${annaTaskId}`, { method: 'PUT', cookie: anna.cookie, data: { done: true, revision: 0 } })).status, 200);
      const refreshed = (await request(`/api/services/${serviceId}`, { cookie: anna.cookie })).value;
      assert.equal(refreshed.personal[0].tasks.find(task => task.id === annaTaskId).done, true);
      assert.ok(benView.personal[0].tasks.every(task => !task.done));
    });
    await t.test('Vorlagen ändern nur neue Dienste; zusätzliche Aufgaben sind personenbezogen', async () => {
      const before = (await request('/api/templates', { cookie: admin.cookie })).value;
      const changed = structuredClone(before);
      changed.common[0].title = 'Neuer Computer-Check';
      assert.equal((await request('/api/templates', { method: 'PUT', cookie: admin.cookie, data: changed })).status, 200);
      const old = (await request(`/api/services/${serviceId}`, { cookie: admin.cookie })).value;
      assert.equal(old.common[0].title, 'Computer einschalten');
      const created = await request('/api/services', { method: 'POST', cookie: admin.cookie, data: { title: 'Nächster Gottesdienst', startsAt: '2026-11-08T09:00:00.000Z', memberIds: [anna.value.user.id, ben.value.user.id] } });
      const fresh = (await request(`/api/services/${created.value.id}`, { cookie: anna.cookie })).value;
      assert.equal(fresh.common[0].title, 'Neuer Computer-Check');
      assert.ok(fresh.common.every(task => !task.done));
      assert.ok(fresh.personal[0].tasks.every(task => !task.done));
      const extra = await request(`/api/services/${serviceId}/personal-tasks`, { method: 'POST', cookie: admin.cookie, data: { userId: anna.value.user.id, title: 'Ansage abholen', phase: 'before' } });
      assert.equal(extra.status, 201);
      assert.ok((await request(`/api/services/${serviceId}`, { cookie: anna.cookie })).value.personal[0].tasks.some(task => task.title === 'Ansage abholen'));
      assert.ok(!(await request(`/api/services/${serviceId}`, { cookie: ben.cookie })).value.personal[0].tasks.some(task => task.title === 'Ansage abholen'));
    });
    await t.test('Gleichzeitige Änderungen und Einladungsannahmen sind atomar', async () => {
      const detail = (await request(`/api/services/${serviceId}`, { cookie: anna.cookie })).value;
      const task = detail.common.find(task => task.revision === 0);
      const changed = await Promise.all([anna, ben].map(member => request(`/api/services/${serviceId}/tasks/${task.id}`, { method: 'PUT', cookie: member.cookie, data: { done: true, revision: 0 } })));
      assert.deepEqual(changed.map(response => response.status).sort(), [200, 409]);
      const oneUse = await invite('concurrent@example.test', []);
      const accepted = await Promise.all(['First', 'Second'].map(name => request('/api/join', { method: 'POST', data: { token: oneUse, name, password: secret } })));
      assert.deepEqual(accepted.map(response => response.status).sort(), [201, 410]);
    });
    await t.test('Archiv ist schreibgeschützt; letzter Admin bleibt erhalten; deaktivierte Konten verlieren Sessions', async () => {
      assert.equal((await request(`/api/services/${serviceId}`, { method: 'PATCH', cookie: admin.cookie, data: { archived: true } })).status, 200);
      assert.equal((await request(`/api/services/${serviceId}/tasks/${sharedId}`, { method: 'PUT', cookie: anna.cookie, data: { done: false, revision: 1 } })).status, 409);
      assert.equal((await request(`/api/members/${admin.value.user.id}`, { method: 'PATCH', cookie: admin.cookie, data: { roles: [], isAdmin: false, active: true } })).status, 409);
      assert.equal((await request(`/api/members/${ben.value.user.id}`, { method: 'PATCH', cookie: admin.cookie, data: { roles: ['propresenter'], isAdmin: false, active: false } })).status, 200);
      assert.equal((await request('/api/app', { cookie: ben.cookie })).status, 401);
      assert.equal((await request('/api/login', { method: 'POST', data: { email: 'ben@example.test', password: secret } })).status, 401);
    });
    await t.test('Daten und Anmeldung bleiben nach Serverneustart erhalten; Abmelden widerruft Sitzung', async () => {
      await app.close();
      app = await createApp({ dbPath, databaseUrl, schema, setupToken: 'different-token' });
      await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
      origin = `http://127.0.0.1:${app.server.address().port}`;
      const detail = (await request(`/api/services/${serviceId}`, { cookie: anna.cookie })).value;
      assert.equal(detail.common.find(task => task.id === sharedId).done, true);
      assert.equal(detail.personal[0].tasks.find(task => task.id === annaTaskId).done, true);
      assert.equal((await request('/api/session')).value.needsSetup, false);
      assert.equal((await request('/api/logout', { method: 'POST', cookie: anna.cookie, data: {} })).status, 200);
      assert.equal((await request('/api/app', { cookie: anna.cookie })).status, 401);
      const login = await request('/api/login', { method: 'POST', data: { email: 'anna@example.test', password: secret } });
      assert.equal(login.status, 200);
      assert.equal((await request('/api/app', { cookie: login.cookie })).status, 200);
    });
    await t.test('Anmeldebegrenzung ist in der Datenbank gespeichert und überlebt Neustarts', async () => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const response = await request('/api/login', { method: 'POST', data: { email: 'limited@example.test', password: secret } });
        assert.equal(response.status, 401);
      }
      assert.equal((await request('/api/login', { method: 'POST', data: { email: 'limited@example.test', password: secret } })).status, 429);
      await app.close();
      app = await createApp({ dbPath, databaseUrl, schema, setupToken: 'test-setup-only' });
      await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
      origin = `http://127.0.0.1:${app.server.address().port}`;
      assert.equal((await request('/api/login', { method: 'POST', data: { email: 'limited@example.test', password: secret } })).status, 429);
      assert.equal((await request('/api/login', { method: 'POST', data: { email: 'anna@example.test', password: secret } })).status, 200);
    });
    await t.test('Passwortänderung prüft das aktuelle Passwort und widerruft andere Sitzungen', async () => {
      const first = await request('/api/login', { method: 'POST', data: { email: 'anna@example.test', password: secret } });
      const second = await request('/api/login', { method: 'POST', data: { email: 'anna@example.test', password: secret } });
      assert.equal((await request('/api/password', { method: 'POST', cookie: first.cookie, data: { currentPassword: 'wrong', password: 'New secure password 2026!' } })).status, 400);
      assert.equal((await request('/api/password', { method: 'POST', cookie: first.cookie, data: { currentPassword: secret, password: 'short' } })).status, 400);
      assert.equal((await request('/api/password', { method: 'POST', cookie: first.cookie, data: { currentPassword: secret, password: 'New secure password 2026!' } })).status, 200);
      assert.equal((await request('/api/app', { cookie: first.cookie })).status, 200);
      assert.equal((await request('/api/app', { cookie: second.cookie })).status, 401);
      assert.equal((await request('/api/login', { method: 'POST', data: { email: 'anna@example.test', password: secret } })).status, 401);
      assert.equal((await request('/api/login', { method: 'POST', data: { email: 'anna@example.test', password: 'New secure password 2026!' } })).status, 200);
    });
    await t.test('Gleichzeitige Admin-Abstufungen erhalten ein aktives Admin-Konto', async () => {
      const secondToken = await invite('second-admin@example.test', [], true);
      const second = await request('/api/join', { method: 'POST', data: { token: secondToken, name: 'Second Admin', password: secret } });
      const lowered = await Promise.all([admin, second].map(user => request(`/api/members/${user.value.user.id}`, { method: 'PATCH', cookie: user.cookie, data: { roles: [], isAdmin: false, active: true } })));
      assert.deepEqual(lowered.map(response => response.status).sort(), [200, 409]);
      assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM users WHERE is_admin=1 AND active=1').get()).n, 1);
    });
  } finally {
    try {
      const preserve = process.env.TEST_DATABASE_SCHEMA && process.env.TEST_PRESERVE_SCHEMA === '1';
      if (schema && !preserve) await app.db.exec(`DROP SCHEMA ${schema} CASCADE`);
    } finally {
      await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
});
