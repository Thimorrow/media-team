import { randomUUID } from 'node:crypto';

const berlinDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
const berlinHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' });

export function upcomingSundays(now = new Date()) {
  const parts = Object.fromEntries(berlinDate.formatToParts(now).map(part => [part.type, part.value]));
  const day = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
  day.setUTCDate(day.getUTCDate() + (7 - day.getUTCDay()) % 7);
  return Array.from({ length: 12 }, () => {
    const date = day.toISOString().slice(0, 10);
    const elevenUTC = new Date(day.getTime() + 11 * 60 * 60_000);
    const offsetHours = Number(berlinHour.format(elevenUTC)) - 11;
    const startsAt = new Date(elevenUTC.getTime() - offsetHours * 60 * 60_000);
    day.setUTCDate(day.getUTCDate() + 7);
    return { id: `sunday-${date}`, title: 'Sonntagsgottesdienst', startsAt: startsAt.toISOString(), meetingAt: new Date(startsAt.getTime() - 30 * 60_000).toISOString() };
  });
}

export async function insertService(db, service, participants, templates) {
  await db.prepare('INSERT INTO services (id,title,starts_at,meeting_at) VALUES (?,?,?,?)').run(service.id, service.title, service.startsAt, service.meetingAt);
  if (participants.length) {
    const values = participants.map(() => '(?,?,?)').join(',');
    await db.prepare(`INSERT INTO participants (service_id,user_id,roles) VALUES ${values}`).run(...participants.flatMap(member => [service.id, member.id, member.roles]));
  }
  const tasks = templates.common.map((task, position) => [randomUUID(), service.id, null, task.title, task.details, task.phase, position]);
  for (const member of participants) {
    const personal = templates.roles.filter(role => JSON.parse(member.roles).includes(role.id)).flatMap(role => role.tasks);
    tasks.push(...personal.map((task, position) => [randomUUID(), service.id, member.id, task.title, task.details, task.phase, position]));
  }
  if (tasks.length) {
    const values = tasks.map(() => '(?,?,?,?,?,?,?)').join(',');
    await db.prepare(`INSERT INTO tasks (id,service_id,owner_id,title,details,phase,position) VALUES ${values}`).run(...tasks.flat());
  }
}

export async function ensureSundayServices(db, now) {
  const sundays = upcomingSundays(now);
  await db.transaction(async () => {
    if (db.kind === 'postgres') await db.prepare('SELECT pg_advisory_xact_lock(741994)').get();
    const existing = await db.prepare('SELECT id,starts_at,meeting_at FROM services WHERE starts_at>=? AND starts_at<=?').all(sundays[0].startsAt, sundays.at(-1).startsAt);
    for (const sunday of sundays) {
      const manual = existing.find(service => service.starts_at === sunday.startsAt && service.meeting_at === null);
      if (manual) await db.prepare('UPDATE services SET meeting_at=? WHERE id=? AND meeting_at IS NULL').run(sunday.meetingAt, manual.id);
    }
    const missing = sundays.filter(sunday => !existing.some(service => service.id === sunday.id || service.starts_at === sunday.startsAt));
    if (!missing.length) return;
    const participants = await db.prepare('SELECT * FROM users WHERE active=1').all();
    const templates = JSON.parse((await db.prepare('SELECT value FROM settings WHERE key=?').get('templates')).value);
    for (const service of missing) await insertService(db, service, participants, templates);
  });
}
