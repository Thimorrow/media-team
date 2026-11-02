import test from 'node:test';
import { request as httpRequest } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createApp, hashPassword } from '../server/app.mjs';

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
  let admin, anna, ben, outsider, serviceId, sharedId, annaTaskId;
  const secret = 'This is a strong test password!';
  const member = async (name, roles = ['propresenter'], isAdmin = false) => {
    const issued = await request('/api/members', { method: 'POST', cookie: admin.cookie, data: { name, password: secret, roles, isAdmin } });
    assert.equal(issued.status, 201);
    assert.equal('email' in issued.value.member, false);
    return request('/api/login', { method: 'POST', data: { name, password: secret } });
  };
  try {
    if (databaseUrl) await t.test('Postgres-Tabellen liegen im privaten Schema und Web-API-Rollen erhalten keinen Zugriff', async () => {
      const tables = await app.db.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_name IN ('users','sessions','tasks')").all(schema);
      assert.equal(tables.length, 3);
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
      assert.equal((await request('/api/setup', { method: 'POST', data: { token: 'wrong', name: 'Admin', password: secret } })).status, 403);
      const setup = await Promise.all([1, 2].map(() => request('/api/setup', { method: 'POST', data: { token: 'test-setup-only', name: 'Admin', password: secret } })));
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
      assert.equal((await request('/api/login', { method: 'POST', data: { name: 'Admin', password: 'wrong' } })).status, 401);
    });
    await t.test('Admins legen Konten direkt an; Namen sind eindeutig und keine E-Mail-Adressen nötig', async () => {
      anna = await member('Anna');
      ben = await member('Ben');
      outsider = await member('Other', ['lighting']);
      assert.equal(anna.value.user.isAdmin, false);
      assert.equal((await request('/api/login', { method: 'POST', data: { name: '  ANNA  ', password: secret } })).status, 200);
      assert.equal((await request('/api/members', { method: 'POST', data: { name: 'Unknown', password: secret, roles: [], isAdmin: true } })).status, 401);
      assert.equal((await request('/api/members', { method: 'POST', cookie: admin.cookie, data: { name: '  anna ', password: secret, roles: [], isAdmin: true } })).status, 409);
      assert.equal((await request('/api/login', { method: 'POST', data: { name: 'Anna', password: secret } })).value.user.isAdmin, false);
      assert.equal((await request('/api/members', { method: 'POST', cookie: admin.cookie, data: { name: 'some@example.test', password: secret, roles: [], isAdmin: false } })).status, 400);
      assert.equal((await request('/api/join', { method: 'POST', data: { name: 'Other', password: secret } })).status, 404);
      assert.equal((await request('/api/invites', { method: 'POST', cookie: admin.cookie, data: {} })).status, 404);
      const normalized = await member('  Jörg   Müller-Smith  ', []);
      assert.equal(normalized.value.user.name, 'Jörg Müller-Smith');
      assert.equal((await request('/api/login', { method: 'POST', data: { name: 'JÖRG MÜLLER-SMITH', password: secret } })).status, 200);
      assert.equal('email' in normalized.value.user, false);
    });
    await t.test('Admin-Funktionen und CSRF sind serverseitig geschützt', async () => {
      assert.equal((await request('/api/templates', { cookie: anna.cookie })).status, 403);
      assert.equal((await request('/api/members', { method: 'POST', cookie: anna.cookie, data: { name: 'Evil', password: secret, roles: [], isAdmin: true } })).status, 403);
      assert.equal((await request('/api/services', { method: 'POST', cookie: anna.cookie, data: {} })).status, 403);
      assert.equal((await request('/api/members', { method: 'POST', cookie: admin.cookie, data: {}, headers: { Origin: 'https://evil.example' } })).status, 403);
      assert.equal((await request('/api/logout', { method: 'POST', cookie: admin.cookie, data: {}, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
      assert.equal((await request('/api/members', { method: 'POST', cookie: admin.cookie, data: { name: 'Evil', password: secret, roles: ['nonexistent'], isAdmin: false } })).status, 400);
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
    await t.test('Gleichzeitige Aufgaben- und Namensänderungen sind atomar', async () => {
      const detail = (await request(`/api/services/${serviceId}`, { cookie: anna.cookie })).value;
      const task = detail.common.find(task => task.revision === 0);
      const changed = await Promise.all([anna, ben].map(member => request(`/api/services/${serviceId}/tasks/${task.id}`, { method: 'PUT', cookie: member.cookie, data: { done: true, revision: 0 } })));
      assert.deepEqual(changed.map(response => response.status).sort(), [200, 409]);
      const accepted = await Promise.all(['Concurrent', ' CONCURRENT '].map(name => request('/api/members', { method: 'POST', cookie: admin.cookie, data: { name, password: secret, roles: [], isAdmin: false } })));
      assert.deepEqual(accepted.map(response => response.status).sort(), [201, 409]);
      assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM users WHERE login_name=?').get('concurrent')).n, 1);
    });
    await t.test('Archiv ist schreibgeschützt; letzter Admin bleibt erhalten; deaktivierte Konten verlieren Sessions', async () => {
      assert.equal((await request(`/api/services/${serviceId}`, { method: 'PATCH', cookie: admin.cookie, data: { archived: true } })).status, 200);
      assert.equal((await request(`/api/services/${serviceId}/tasks/${sharedId}`, { method: 'PUT', cookie: anna.cookie, data: { done: false, revision: 1 } })).status, 409);
      assert.equal((await request(`/api/members/${admin.value.user.id}`, { method: 'PATCH', cookie: admin.cookie, data: { roles: [], isAdmin: false, active: true } })).status, 409);
      assert.equal((await request(`/api/members/${ben.value.user.id}`, { method: 'PATCH', cookie: admin.cookie, data: { roles: ['propresenter'], isAdmin: false, active: false } })).status, 200);
      assert.equal((await request('/api/app', { cookie: ben.cookie })).status, 401);
      assert.equal((await request('/api/login', { method: 'POST', data: { name: 'Ben', password: secret } })).status, 401);
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
      const login = await request('/api/login', { method: 'POST', data: { name: 'Anna', password: secret } });
      assert.equal(login.status, 200);
      assert.equal((await request('/api/app', { cookie: login.cookie })).status, 200);
    });
    await t.test('Anmeldebegrenzung ist in der Datenbank gespeichert und überlebt Neustarts', async () => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const response = await request('/api/login', { method: 'POST', data: { name: 'Limited', password: secret } });
        assert.equal(response.status, 401);
      }
      assert.equal((await request('/api/login', { method: 'POST', data: { name: 'Limited', password: secret } })).status, 429);
      await app.close();
      app = await createApp({ dbPath, databaseUrl, schema, setupToken: 'test-setup-only' });
      await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
      origin = `http://127.0.0.1:${app.server.address().port}`;
      assert.equal((await request('/api/login', { method: 'POST', data: { name: 'Limited', password: secret } })).status, 429);
      assert.equal((await request('/api/login', { method: 'POST', data: { name: 'Anna', password: secret } })).status, 200);
    });
    await t.test('Passwortänderung prüft das aktuelle Passwort und widerruft andere Sitzungen', async () => {
      const first = await request('/api/login', { method: 'POST', data: { name: 'Anna', password: secret } });
      const second = await request('/api/login', { method: 'POST', data: { name: 'Anna', password: secret } });
      assert.equal((await request('/api/password', { method: 'POST', cookie: first.cookie, data: { currentPassword: 'wrong', password: 'New secure password 2026!' } })).status, 400);
      assert.equal((await request('/api/password', { method: 'POST', cookie: first.cookie, data: { currentPassword: secret, password: 'short' } })).status, 400);
      assert.equal((await request('/api/password', { method: 'POST', cookie: first.cookie, data: { currentPassword: secret, password: 'New secure password 2026!' } })).status, 200);
      assert.equal((await request('/api/app', { cookie: first.cookie })).status, 200);
      assert.equal((await request('/api/app', { cookie: second.cookie })).status, 401);
      assert.equal((await request('/api/login', { method: 'POST', data: { name: 'Anna', password: secret } })).status, 401);
      assert.equal((await request('/api/login', { method: 'POST', data: { name: 'Anna', password: 'New secure password 2026!' } })).status, 200);
    });
    await t.test('Entzogene Admin-Rechte während eines offenen Anfragebodys verhindern neue Konten', { timeout: 15_000 }, async () => {
      const revoker = await member('Revoker', [], true);
      try {
        for (const action of ['deactivate', 'demote']) {
          const actor = await member(`Paused ${action}`, [], true);
          const createdName = `Forbidden ${action}`;
          let resolveBody;
          const readingBody = new Promise(resolve => { resolveBody = resolve; });
          const observe = incoming => {
            if (incoming.headers['x-test-pause'] !== action) return;
            const listener = event => {
              if (event === 'readable') {
                incoming.removeListener('newListener', listener);
                resolveBody();
              }
            };
            incoming.on('newListener', listener);
          };
          app.server.prependListener('request', observe);
          let pending;
          const result = new Promise((resolve, reject) => {
            pending = httpRequest(origin + '/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: actor.cookie, 'x-test-pause': action } }, response => {
              let content = '';
              response.setEncoding('utf8');
              response.on('data', chunk => { content += chunk; });
              response.once('end', () => resolve({ status: response.statusCode, value: JSON.parse(content) }));
            });
            pending.once('error', reject);
            pending.write('{"name":');
          });
          try {
            await readingBody;
            const revoked = await request(`/api/members/${actor.value.user.id}`, { method: 'PATCH', cookie: revoker.cookie, data: { roles: [], isAdmin: action === 'deactivate', active: action !== 'deactivate' } });
            assert.equal(revoked.status, 200);
            pending.end(JSON.stringify(createdName) + ',"password":' + JSON.stringify(secret) + ',"roles":[],"isAdmin":true}');
            const denied = await result;
            assert.equal(denied.status, action === 'deactivate' ? 401 : 403);
            assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM users WHERE login_name=?').get(createdName.toLowerCase())).n, 0);
          } finally {
            app.server.removeListener('request', observe);
            pending.destroy();
          }
        }
      } finally {
        assert.equal((await request(`/api/members/${revoker.value.user.id}`, { method: 'PATCH', cookie: admin.cookie, data: { roles: [], isAdmin: false, active: false } })).status, 200);
      }
    });
    await t.test('Gleichzeitige Admin-Abstufungen erhalten ein aktives Admin-Konto', async () => {
      const second = await member('Second Admin', [], true);
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

test('Migration auf Namen bewahrt Passwörter, Sitzungen, Aufgaben und IDs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'media-name-migration-'));
  const dbPath = join(dir, 'legacy.sqlite');
  const secret = 'Legacy secure password 2026!';
  const encoded = await hashPassword(secret);
  const rawSession = 'legacy-session-token';
  let app = await createApp({ dbPath, setupToken: 'unused' });
  try {
    await app.db.prepare('INSERT INTO users (id,name,login_name,password_hash,is_admin,roles) VALUES (?,?,?,?,?,?)').run('legacy-person', '  Jörg   Müller ', 'legacy@example.test', encoded, 1, '["sound"]');
    await app.db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(createHash('sha256').update(rawSession).digest('hex'), 'legacy-person', Date.now() + 60_000);
    await app.db.prepare('INSERT INTO services (id,title,starts_at) VALUES (?,?,?)').run('legacy-service', 'Gottesdienst', '2026-11-01T09:00:00.000Z');
    await app.db.prepare('INSERT INTO tasks (id,service_id,owner_id,title,phase,position,done,done_by,revision) VALUES (?,?,?,?,?,?,?,?,?)').run('legacy-task', 'legacy-service', 'legacy-person', 'Mikrofon prüfen', 'before', 0, 1, 'legacy-person', 3);
    await app.db.exec('ALTER TABLE users RENAME COLUMN login_name TO email');
    await app.close();
    app = await createApp({ dbPath, setupToken: 'unused' });
    assert.deepEqual({ ...await app.db.prepare('SELECT id,name,login_name,password_hash,roles FROM users').get() }, { id: 'legacy-person', name: 'Jörg Müller', login_name: 'jörg müller', password_hash: encoded, roles: '["sound"]' });
    assert.equal((await app.db.prepare('SELECT done FROM tasks WHERE id=?').get('legacy-task')).done, 1);
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    assert.equal((await fetch(origin + '/api/app', { headers: { cookie: `media_session=${rawSession}` } })).status, 200);
    const login = await fetch(origin + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'JÖRG MÜLLER', password: secret }) });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).user.id, 'legacy-person');
    await app.close();
    app = await createApp({ dbPath, setupToken: 'unused' });
    assert.equal((await app.db.prepare('SELECT login_name FROM users').get()).login_name, 'jörg müller');
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('Migration mit doppelten Namen bricht ohne Datenänderung ab', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'media-name-conflict-'));
  const dbPath = join(dir, 'legacy.sqlite');
  const app = await createApp({ dbPath, setupToken: 'unused' });
  await app.db.prepare('INSERT INTO users (id,name,login_name,password_hash) VALUES (?,?,?,?)').run('first', 'Anna', 'first@example.test', 'unchanged-first');
  await app.db.prepare('INSERT INTO users (id,name,login_name,password_hash) VALUES (?,?,?,?)').run('second', ' ANNA ', 'second@example.test', 'unchanged-second');
  await app.db.exec('ALTER TABLE users RENAME COLUMN login_name TO email');
  await app.close();
  try {
    await assert.rejects(createApp({ dbPath, setupToken: 'unused' }), /doppelte Namen/);
    const { DatabaseSync } = await import('node:sqlite');
    const check = new DatabaseSync(dbPath);
    try {
      assert.ok(check.prepare('PRAGMA table_info(users)').all().some(column => column.name === 'email'));
      assert.equal(check.prepare('SELECT password_hash FROM users WHERE id=?').get('first').password_hash, 'unchanged-first');
      assert.equal(check.prepare('SELECT name FROM users WHERE id=?').get('second').name, ' ANNA ');
    } finally { check.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
