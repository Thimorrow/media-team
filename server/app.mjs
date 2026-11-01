import { createServer } from 'node:http';
import { openDatabase } from './db.mjs';
import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scryptAsync = promisify(scrypt);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const sessionAge = 7 * 24 * 60 * 60 * 1000;
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${Buffer.from(await scryptAsync(password, salt, 64)).toString('hex')}`;
}
async function passwordMatches(password, encoded) {
  const [salt, stored] = encoded.split(':');
  const actual = Buffer.from(await scryptAsync(password, salt, 64));
  return timingSafeEqual(actual, Buffer.from(stored, 'hex'));
}
function text(value, name, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `${name} fehlt oder ist zu lang.`);
  return value.trim();
}
function email(value) {
  const result = text(value, 'E-Mail', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, 'Bitte eine gültige E-Mail-Adresse angeben.');
  return result;
}
function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 256) fail(400, 'Das Passwort muss 12 bis 256 Zeichen lang sein.');
  return value;
}
function boolean(value, name) {
  if (typeof value !== 'boolean') fail(400, `${name} muss wahr oder falsch sein.`);
  return value;
}
async function body(req) {
  if (req.body !== undefined) {
    const serialized = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(serialized) > 256_000) fail(413, 'Die Anfrage ist zu groß.');
    try {
      const value = JSON.parse(serialized);
      if (!value || Array.isArray(value) || typeof value !== 'object') fail(400, 'Ungültige Anfrage.');
      return value;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      fail(400, 'Die Anfrage enthält ungültige Daten.');
    }
  }
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 256_000) fail(413, 'Die Anfrage ist zu groß.');
  }
  try {
    const value = JSON.parse(data || '{}');
    if (!value || Array.isArray(value) || typeof value !== 'object') fail(400, 'Ungültige Anfrage.');
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    fail(400, 'Die Anfrage enthält ungültige Daten.');
  }
}
function initialTemplates() {
  const common = JSON.parse(readFileSync(resolve(root, 'data/common-checklist.json'), 'utf8'));
  const roles = JSON.parse(readFileSync(resolve(root, 'data/role-checklists.json'), 'utf8'));
  const tasks = sections => sections.flatMap(section => section.tasks.filter(task => !task.confirmationRequired).map(task => ({ id: task.id, title: task.title, details: task.details || '', phase: section.id === 'after-service' ? 'after' : 'before' })));
  return { common: tasks(common.sections), roles: roles.roles.map(role => ({ id: role.id, title: role.title, tasks: tasks(role.sections) })) };
}
function validateTemplates(value) {
  if (!Array.isArray(value.common) || !Array.isArray(value.roles) || value.roles.length > 30) fail(400, 'Ungültige Vorlagen.');
  const taskIds = new Set();
  const tasks = list => {
    if (!Array.isArray(list) || list.length > 150) fail(400, 'Zu viele Aufgaben in einer Vorlage.');
    return list.map(task => {
      if (!task || typeof task !== 'object') fail(400, 'Ungültige Aufgabe in der Vorlage.');
      const id = text(task.id, 'Aufgaben-ID', 100);
      if (taskIds.has(id)) fail(400, 'Aufgaben-IDs müssen eindeutig sein.');
      taskIds.add(id);
      if (!['before', 'after'].includes(task.phase)) fail(400, 'Ungültige Aufgabenphase.');
      return { id, title: text(task.title, 'Aufgabe'), details: typeof task.details === 'string' ? task.details.trim().slice(0, 1000) : '', phase: task.phase };
    });
  };
  const common = tasks(value.common);
  const roleIds = new Set();
  const roles = value.roles.map(role => {
    if (!role || typeof role !== 'object') fail(400, 'Ungültiger Dienst in der Vorlage.');
    const id = text(role.id, 'Dienst-ID', 80);
    if (roleIds.has(id)) fail(400, 'Dienst-IDs müssen eindeutig sein.');
    roleIds.add(id);
    return { id, title: text(role.title, 'Dienst'), tasks: tasks(role.tasks) };
  });
  return { common, roles };
}

export async function createApp({ dbPath, databaseUrl, schema, setupToken, baseUrl, distPath = resolve(root, 'dist') } = {}) {
  const db = await openDatabase({ dbPath, databaseUrl, schema });
  if (db.kind === 'sqlite') await db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, roles TEXT NOT NULL DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invites (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, is_admin INTEGER NOT NULL, roles TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, title TEXT NOT NULL, starts_at TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS participants (service_id TEXT NOT NULL REFERENCES services(id), user_id TEXT NOT NULL REFERENCES users(id), roles TEXT NOT NULL, PRIMARY KEY(service_id,user_id));
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, service_id TEXT NOT NULL REFERENCES services(id), owner_id TEXT REFERENCES users(id), title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', phase TEXT NOT NULL CHECK(phase IN ('before','after')), position INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, done_by TEXT REFERENCES users(id), revision INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS tasks_service ON tasks(service_id);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at BIGINT NOT NULL);`;
  await db.transaction(async () => {
    if (db.kind === 'postgres') await db.prepare('SELECT pg_advisory_xact_lock(741992)').get();
    await db.exec(schemaSql.replace(/expires_at INTEGER/g, 'expires_at BIGINT'));
  });
  await db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT (key) DO NOTHING').run('templates', JSON.stringify(initialTemplates()));
  const templates = async () => JSON.parse((await db.prepare('SELECT value FROM settings WHERE key=?').get('templates')).value);
  const publicUser = row => ({ id: row.id, name: row.name, email: row.email, isAdmin: !!row.is_admin, roles: JSON.parse(row.roles) });
  const roles = async value => {
    const current = await templates();
    if (!Array.isArray(value) || value.length > 30 || value.some(id => typeof id !== 'string' || !current.roles.some(role => role.id === id))) fail(400, 'Ungültiger Dienst.');
    return [...new Set(value)];
  };
  const getUser = async req => {
    const raw = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('media_session='))?.slice(14);
    if (!raw || raw.length > 200) return null;
    return await db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>? AND active=1').get(hash(raw), Date.now()) || null;
  };
  const requireUser = async req => await getUser(req) || fail(401, 'Bitte melde dich erneut an.');
  const requireAdmin = async req => {
    const user = await requireUser(req);
    if (!user.is_admin) fail(403, 'Dafür brauchst du ein Admin-Konto.');
    return user;
  };
  const cookie = (req, res, raw = '', maxAge = sessionAge / 1000) => {
    const secure = (baseUrl || '').startsWith('https:') || process.env.VERCEL === '1';
    res.setHeader('Set-Cookie', `media_session=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
  };
  const newSession = async (req, res, userId, expectedHash) => {
    const raw = token();
    const user = await db.transaction(async () => {
      const current = await db.prepare('SELECT * FROM users WHERE id=?' + (db.kind === 'postgres' ? ' FOR UPDATE' : '')).get(userId);
      if (!current?.active || (expectedHash && current.password_hash !== expectedHash)) fail(401, 'Dein Konto wurde gerade geändert. Bitte melde dich erneut an.');
      await db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
      await db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(raw), userId, Date.now() + sessionAge);
      return current;
    });
    cookie(req, res, raw);
    return user;
  };
  const canReadService = async (id, user) => {
    const service = await db.prepare('SELECT * FROM services WHERE id=?').get(id);
    if (!service) fail(404, 'Dieser Gottesdienst wurde nicht gefunden.');
    if (!user.is_admin && !await db.prepare('SELECT 1 FROM participants WHERE service_id=? AND user_id=?').get(id, user.id)) fail(403, 'Du bist diesem Gottesdienst nicht zugeordnet.');
    return service;
  };
  const taskShape = row => ({ id: row.id, title: row.title, details: row.details, phase: row.phase, done: !!row.done, doneBy: row.done_by_name || null, revision: row.revision });
  const transaction = fn => db.transaction(fn);
  async function rateLimit(req, scope, limit = 20) {
    const now = Date.now();
    const clientIp = process.env.VERCEL === '1' ? String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
    const key = `${clientIp}:${scope}`;
    await db.prepare('DELETE FROM rate_limits WHERE reset_at<?').run(now);
    const row = await db.prepare(`INSERT INTO rate_limits (key,count,reset_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<? THEN 1 ELSE rate_limits.count+1 END,
      reset_at=CASE WHEN rate_limits.reset_at<? THEN excluded.reset_at ELSE rate_limits.reset_at END
      RETURNING count`).get(key, now + 15 * 60_000, now, now);
    if (row.count > limit) fail(429, 'Zu viele Versuche. Bitte warte 15 Minuten.');
  }
  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  };

  async function api(req, res, url) {
    const path = url.pathname;
    const method = req.method;
    if (!['GET', 'HEAD'].includes(method)) {
      const origin = req.headers.origin;
      const allowed = baseUrl ? new URL(baseUrl).origin : `${process.env.VERCEL === '1' ? 'https' : 'http'}://${req.headers.host}`;
      if ((origin && origin !== allowed) || req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Diese Anfrage stammt nicht aus der App.');
      if (req.headers['content-type'] && !req.headers['content-type'].startsWith('application/json')) fail(415, 'Bitte JSON-Daten senden.');
    }
    if (method === 'GET' && path === '/api/session') {
      const user = await getUser(req);
      return json(res, 200, { user: user ? publicUser(user) : null, needsSetup: !await db.prepare('SELECT 1 FROM users LIMIT 1').get() });
    }
    if (method === 'POST' && path === '/api/setup') {
      await rateLimit(req, 'setup');
      const value = await body(req);
      if (await db.prepare('SELECT 1 FROM users LIMIT 1').get()) fail(409, 'Die App ist bereits eingerichtet.');
      if (!setupToken || typeof value.token !== 'string' || hash(value.token) !== hash(setupToken)) fail(403, 'Der Einrichtungscode ist ungültig.');
      const name = text(value.name, 'Name', 80), address = email(value.email), encoded = await hashPassword(password(value.password));
      const id = randomUUID();
      await transaction(async () => {
        if (db.kind === 'postgres') await db.prepare('SELECT pg_advisory_xact_lock(741993)').get();
        if (await db.prepare('SELECT 1 FROM users LIMIT 1').get()) fail(409, 'Die App ist bereits eingerichtet.');
        await db.prepare('INSERT INTO users (id,name,email,password_hash,is_admin) VALUES (?,?,?,?,1)').run(id, name, address, encoded);
      });
      await newSession(req, res, id);
      return json(res, 201, { user: publicUser(await db.prepare('SELECT * FROM users WHERE id=?').get(id)) });
    }
    if (method === 'POST' && path === '/api/login') {
      const value = await body(req), address = email(value.email);
      await rateLimit(req, 'login', 200);
      await rateLimit(req, `login:${hash(address)}`);
      if (typeof value.password !== 'string' || value.password.length > 256) fail(401, 'E-Mail oder Passwort stimmen nicht.');
      const user = await db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(address);
      const dummy = '00000000000000000000000000000000:' + '0'.repeat(128);
      const valid = await passwordMatches(value.password, user?.password_hash || dummy);
      if (!user || !valid) fail(401, 'E-Mail oder Passwort stimmen nicht.');
      const current = await newSession(req, res, user.id, user.password_hash);
      return json(res, 200, { user: publicUser(current) });
    }
    if (method === 'POST' && path === '/api/logout') {
      const raw = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('media_session='))?.slice(14);
      if (raw) await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(raw));
      cookie(req, res, '', 0);
      return json(res, 200, {});
    }
    if (method === 'POST' && path === '/api/password') {
      const user = await requireUser(req);
      await rateLimit(req, `password:${user.id}`, 10);
      const value = await body(req);
      if (typeof value.currentPassword !== 'string' || value.currentPassword.length > 256 || !await passwordMatches(value.currentPassword, user.password_hash)) fail(400, 'Das aktuelle Passwort stimmt nicht.');
      const encoded = await hashPassword(password(value.password));
      const raw = req.headers.cookie.split(';').map(part => part.trim()).find(part => part.startsWith('media_session='))?.slice(14);
      await transaction(async () => {
        const changed = await db.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=? AND active=1').run(encoded, user.id, user.password_hash);
        if (!changed.changes) fail(409, 'Dein Konto wurde gerade geändert. Bitte melde dich erneut an.');
        await db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(user.id, hash(raw));
      });
      return json(res, 200, {});
    }
    const inviteMatch = path.match(/^\/api\/invites\/([A-Za-z0-9_-]{40,100})$/);
    if (method === 'GET' && inviteMatch) {
      const invite = await db.prepare('SELECT * FROM invites WHERE token_hash=? AND expires_at>?').get(hash(inviteMatch[1]), Date.now());
      if (!invite) fail(404, 'Diese Einladung ist abgelaufen oder bereits verwendet.');
      return json(res, 200, { email: invite.email, isAdmin: !!invite.is_admin, roles: JSON.parse(invite.roles), expiresAt: new Date(Number(invite.expires_at)).toISOString() });
    }
    if (method === 'POST' && path === '/api/join') {
      await rateLimit(req, 'join');
      const value = await body(req), raw = text(value.token, 'Einladung', 100);
      const invite = await db.prepare('SELECT * FROM invites WHERE token_hash=? AND expires_at>?').get(hash(raw), Date.now());
      if (!invite) fail(410, 'Diese Einladung ist abgelaufen oder bereits verwendet.');
      const name = text(value.name, 'Name', 80), encoded = await hashPassword(password(value.password)), id = randomUUID();
      await transaction(async () => {
        const consumed = await db.prepare('DELETE FROM invites WHERE token_hash=? AND expires_at>? RETURNING *').get(hash(raw), Date.now());
        if (!consumed) fail(410, 'Diese Einladung ist abgelaufen oder bereits verwendet.');
        if (await db.prepare('SELECT 1 FROM users WHERE email=?').get(consumed.email)) fail(409, 'Für diese E-Mail besteht bereits ein Konto.');
        await db.prepare('INSERT INTO users (id,name,email,password_hash,is_admin,roles) VALUES (?,?,?,?,?,?)').run(id, name, consumed.email, encoded, consumed.is_admin, consumed.roles);
      });
      await newSession(req, res, id);
      return json(res, 201, { user: publicUser(await db.prepare('SELECT * FROM users WHERE id=?').get(id)) });
    }
    if (method === 'GET' && path === '/api/app') {
      const user = await requireUser(req);
      const rows = await db.prepare(user.is_admin ? 'SELECT * FROM services ORDER BY starts_at DESC' : 'SELECT services.* FROM services JOIN participants ON participants.service_id=services.id WHERE user_id=? ORDER BY starts_at DESC').all(...(user.is_admin ? [] : [user.id]));
      const services = await Promise.all(rows.map(async service => {
        const count = await db.prepare('SELECT COUNT(*) total,COALESCE(SUM(done),0) completed FROM tasks WHERE service_id=?' + (user.is_admin ? '' : ' AND (owner_id IS NULL OR owner_id=?)')).get(...(user.is_admin ? [service.id] : [service.id, user.id]));
        return { id: service.id, title: service.title, startsAt: service.starts_at, archived: !!service.archived, ...count };
      }));
      const members = user.is_admin ? (await db.prepare('SELECT * FROM users ORDER BY name').all()).map(row => ({ ...publicUser(row), active: !!row.active })) : [];
      return json(res, 200, { user: publicUser(user), services, roles: (await templates()).roles.map(({ id, title }) => ({ id, title })), members });
    }
    if (path === '/api/templates') {
      await requireAdmin(req);
      if (method === 'GET') return json(res, 200, await templates());
      if (method === 'PUT') {
        const value = validateTemplates(await body(req));
        const usedRoles = (await db.prepare('SELECT roles FROM users UNION ALL SELECT roles FROM invites').all()).flatMap(row => JSON.parse(row.roles));
        if (usedRoles.some(id => !value.roles.some(role => role.id === id))) fail(409, 'Ein zugewiesener Dienst kann nicht entfernt werden.');
        await db.prepare('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify(value), 'templates');
        return json(res, 200, {});
      }
    }
    if (method === 'POST' && path === '/api/invites') {
      await requireAdmin(req);
      const value = await body(req), address = email(value.email), assigned = await roles(value.roles), isAdmin = boolean(value.isAdmin, 'Admin-Recht');
      if (await db.prepare('SELECT 1 FROM users WHERE email=?').get(address)) fail(409, 'Für diese E-Mail besteht bereits ein Konto.');
      const raw = token(), expiresAt = Date.now() + sessionAge;
      await transaction(async () => {
        await db.prepare('DELETE FROM invites WHERE email=? OR expires_at<=?').run(address, Date.now());
        await db.prepare('INSERT INTO invites VALUES (?,?,?,?,?)').run(hash(raw), address, +isAdmin, JSON.stringify(assigned), expiresAt);
      });
      return json(res, 201, { token: raw, expiresAt: new Date(expiresAt).toISOString() });
    }
    const memberMatch = path.match(/^\/api\/members\/([^/]+)$/);
    if (method === 'PATCH' && memberMatch) {
      await requireAdmin(req);
      const value = await body(req), assigned = await roles(value.roles), isAdmin = boolean(value.isAdmin, 'Admin-Recht'), active = boolean(value.active, 'Aktiv');
      await transaction(async () => {
        if (db.kind === 'postgres') await db.prepare('SELECT pg_advisory_xact_lock(741993)').get();
        const target = await db.prepare('SELECT * FROM users WHERE id=?').get(memberMatch[1]);
        if (!target) fail(404, 'Dieses Mitglied wurde nicht gefunden.');
        if (target.is_admin && target.active && (!isAdmin || !active) && (await db.prepare('SELECT COUNT(*) n FROM users WHERE is_admin=1 AND active=1').get()).n <= 1) fail(409, 'Das letzte aktive Admin-Konto muss erhalten bleiben.');
        await db.prepare('UPDATE users SET roles=?,is_admin=?,active=? WHERE id=?').run(JSON.stringify(assigned), +isAdmin, +active, target.id);
        if (!active) await db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
      });
      return json(res, 200, {});
    }
    if (method === 'POST' && path === '/api/services') {
      await requireAdmin(req);
      const value = await body(req), title = text(value.title, 'Gottesdienst'), startsAt = new Date(value.startsAt);
      if (typeof value.startsAt !== 'string' || !Number.isFinite(startsAt.getTime())) fail(400, 'Bitte Datum und Uhrzeit angeben.');
      if (!Array.isArray(value.memberIds) || value.memberIds.length > 300 || value.memberIds.some(id => typeof id !== 'string')) fail(400, 'Ungültige Teilnehmerliste.');
      const ids = [...new Set(value.memberIds)], participants = await Promise.all(ids.map(id => db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(id)));
      if (participants.some(member => !member)) fail(400, 'Ein ausgewähltes Mitglied ist nicht verfügbar.');
      const id = randomUUID(), current = await templates();
      await transaction(async () => {
        await db.prepare('INSERT INTO services (id,title,starts_at) VALUES (?,?,?)').run(id, title, startsAt.toISOString());
        const insertTask = db.prepare('INSERT INTO tasks (id,service_id,owner_id,title,details,phase,position) VALUES (?,?,?,?,?,?,?)');
        for (const [position, task] of current.common.entries()) await insertTask.run(randomUUID(), id, null, task.title, task.details, task.phase, position);
        for (const member of participants) {
          await db.prepare('INSERT INTO participants VALUES (?,?,?)').run(id, member.id, member.roles);
          const personal = current.roles.filter(role => JSON.parse(member.roles).includes(role.id)).flatMap(role => role.tasks);
          for (const [position, task] of personal.entries()) await insertTask.run(randomUUID(), id, member.id, task.title, task.details, task.phase, position);
        }
      });
      return json(res, 201, { id });
    }
    const serviceMatch = path.match(/^\/api\/services\/([^/]+)$/);
    if (serviceMatch && method === 'GET') {
      const user = await requireUser(req), service = await canReadService(serviceMatch[1], user);
      const tasks = await db.prepare('SELECT tasks.*,users.name AS done_by_name FROM tasks LEFT JOIN users ON users.id=tasks.done_by WHERE service_id=? ORDER BY position,tasks.id').all(service.id);
      const participants = await db.prepare('SELECT participants.*,users.name FROM participants JOIN users ON users.id=participants.user_id WHERE service_id=?' + (user.is_admin ? '' : ' AND user_id=?')).all(...(user.is_admin ? [service.id] : [service.id, user.id]));
      const common = tasks.filter(task => task.owner_id === null).map(taskShape);
      const personal = participants.map(member => ({ userId: member.user_id, name: member.name, roles: JSON.parse(member.roles), tasks: tasks.filter(task => task.owner_id === member.user_id).map(taskShape) }));
      return json(res, 200, { id: service.id, title: service.title, startsAt: service.starts_at, archived: !!service.archived, common, personal });
    }
    if (serviceMatch && method === 'PATCH') {
      const user = await requireAdmin(req), service = await canReadService(serviceMatch[1], user), value = await body(req);
      await db.prepare('UPDATE services SET archived=? WHERE id=?').run(+boolean(value.archived, 'Archiviert'), service.id);
      return json(res, 200, {});
    }
    const taskMatch = path.match(/^\/api\/services\/([^/]+)\/tasks\/([^/]+)$/);
    if (taskMatch && method === 'PUT') {
      const user = await requireUser(req), value = await body(req);
      const done = boolean(value.done, 'Erledigt');
      if (!Number.isInteger(value.revision) || value.revision < 0) fail(400, 'Der Aufgabenstand fehlt. Bitte neu laden.');
      const updated = await transaction(async () => {
        const service = await canReadService(taskMatch[1], user);
        const current = db.kind === 'postgres' ? await db.prepare('SELECT * FROM services WHERE id=? FOR UPDATE').get(service.id) : service;
        if (current.archived) fail(409, 'Dieser Gottesdienst ist archiviert.');
        const task = await db.prepare('SELECT * FROM tasks WHERE service_id=? AND id=?').get(service.id, taskMatch[2]);
        if (!task) fail(404, 'Diese Aufgabe wurde nicht gefunden.');
        if (task.owner_id !== null && task.owner_id !== user.id && !user.is_admin) fail(403, 'Persönliche Aufgaben kann nur die zugeordnete Person abhaken.');
        const result = await db.prepare('UPDATE tasks SET done=?,done_by=?,revision=revision+1 WHERE id=? AND revision=?').run(+done, done ? user.id : null, task.id, value.revision);
        if (!result.changes) fail(409, 'Diese Aufgabe wurde gerade geändert. Der aktuelle Stand wird neu geladen.');
        return taskShape(await db.prepare('SELECT tasks.*,users.name AS done_by_name FROM tasks LEFT JOIN users ON users.id=tasks.done_by WHERE tasks.id=?').get(task.id));
      });
      return json(res, 200, { task: updated });
    }
    const personalMatch = path.match(/^\/api\/services\/([^/]+)\/personal-tasks$/);
    if (personalMatch && method === 'POST') {
      const user = await requireAdmin(req), service = await canReadService(personalMatch[1], user), value = await body(req);
      if (service.archived) fail(409, 'Dieser Gottesdienst ist archiviert.');
      const userId = text(value.userId, 'Person', 100);
      if (!await db.prepare('SELECT 1 FROM participants WHERE service_id=? AND user_id=?').get(service.id, userId)) fail(400, 'Die Person nimmt an diesem Gottesdienst nicht teil.');
      if (!['before', 'after'].includes(value.phase)) fail(400, 'Ungültige Aufgabenphase.');
      const id = randomUUID(), position = (await db.prepare('SELECT COALESCE(MAX(position),0)+1 n FROM tasks WHERE service_id=? AND owner_id=?').get(service.id, userId)).n;
      await db.prepare('INSERT INTO tasks (id,service_id,owner_id,title,phase,position) VALUES (?,?,?,?,?,?)').run(id, service.id, userId, text(value.title, 'Aufgabe'), value.phase, position);
      return json(res, 201, { id });
    }
    fail(404, 'Diese Funktion wurde nicht gefunden.');
  }

  const handler = async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'Diese Methode ist nicht erlaubt.');
      const requested = resolve(distPath, '.' + decodeURIComponent(url.pathname));
      if (requested !== distPath && !requested.startsWith(resolve(distPath) + sep)) fail(403, 'Zugriff verweigert.');
      let file = requested;
      if (!existsSync(file) || !statSync(file).isFile()) file = resolve(distPath, 'index.html');
      if (!existsSync(file)) return json(res, 503, { error: 'Die Oberfläche wurde noch nicht gebaut. Bitte npm run build ausführen.' });
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
      res.setHeader('Cache-Control', file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      res.writeHead(200);
      res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      if (!(error instanceof HttpError)) console.error('Request failed:', { name: error.name, code: error.code });
      json(res, error.status || 500, { error: error instanceof HttpError ? error.message : 'Die Anfrage konnte nicht gespeichert werden. Bitte erneut versuchen.' });
    }
  };
  const server = createServer(handler);
  return { server, db, handler, close: async () => {
    if (server.listening) await new Promise(resolveClose => { server.close(resolveClose); server.closeIdleConnections(); });
    await db.close();
  } };
}

let deployedApp;
export async function handleRequest(req, res) {
  try {
    if (!deployedApp) {
      const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
      if (!databaseUrl || !process.env.SETUP_TOKEN) throw new Error('Database URL and SETUP_TOKEN must be configured');
      deployedApp = createApp({ databaseUrl, setupToken: process.env.SETUP_TOKEN, baseUrl: process.env.APP_ORIGIN });
    }
    const app = await deployedApp;
    return app.handler(req, res);
  } catch (error) {
    deployedApp = undefined;
    console.error('Backend initialization failed:', { name: error.name, code: error.code });
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'Die Datenbankverbindung ist noch nicht eingerichtet. Bitte wende dich an die Administration.' }));
  }
}
