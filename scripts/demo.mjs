import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp, hashPassword, normalizeAccountName } from '../server/app.mjs';

mkdirSync(resolve('.local'), { recursive: true, mode: 0o700 });
const app = await createApp({ dbPath: resolve('.local/demo.sqlite'), setupToken: 'demo-not-for-real-use', baseUrl: process.env.APP_ORIGIN });
const password = 'Media-Team-Demo-2026!';
if (!await app.db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  const encoded = await hashPassword(password);
  const people = [
    { name: 'Alex', roles: ['propresenter'], admin: 1 },
    { name: 'Mara', roles: ['propresenter'], admin: 0 },
    { name: 'Jonas', roles: ['sound'], admin: 0 },
    { name: 'Lea', roles: ['lighting'], admin: 0 },
  ];
  for (const person of people) await app.db.prepare('INSERT INTO users (id,name,login_name,password_hash,is_admin,roles) VALUES (?,?,?,?,?,?)').run(randomUUID(), person.name, normalizeAccountName(person.name).loginName, encoded, person.admin, JSON.stringify(person.roles));
  await new Promise(resolveListen => app.server.listen(0, '127.0.0.1', resolveListen));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const login = await fetch(origin + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Alex', password }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const memberIds = (await app.db.prepare('SELECT id FROM users').all()).map(user => user.id);
  const dates = ['2026-10-25T09:00:00Z', '2026-11-01T09:00:00Z', '2026-11-08T09:00:00Z', '2026-11-15T09:00:00Z'];
  for (const [index, startsAt] of dates.entries()) {
    const response = await fetch(origin + '/api/services', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ title: 'Sonntagsgottesdienst', startsAt, memberIds }) });
    const { id } = await response.json();
    const tasks = await app.db.prepare('SELECT id FROM tasks WHERE service_id=? ORDER BY position').all(id);
    const completed = index === 0 ? tasks.length : index === 1 ? 5 : 0;
    const admin = await app.db.prepare('SELECT id FROM users WHERE is_admin=1').get();
    for (const task of tasks.slice(0, completed)) await app.db.prepare('UPDATE tasks SET done=1,done_by=?,revision=1 WHERE id=?').run(admin.id, task.id);
    if (index === 0) await app.db.prepare('UPDATE services SET archived=1 WHERE id=?').run(id);
  }
  await new Promise(resolveClose => app.server.close(resolveClose));
}
const port = Number(process.env.PORT || 3000);
app.server.listen(port, '127.0.0.1', () => {
  console.log(`DEMO mit getrennten Beispieldaten: http://localhost:${port}`);
  console.log(`Admin: Alex | Passwort: ${password}`);
  console.log(`Mitglied: Mara | Passwort: ${password}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
