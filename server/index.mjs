import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createApp } from './app.mjs';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const directory = resolve('.local');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const tokenPath = resolve(directory, 'setup-token');
if (!existsSync(tokenPath)) writeFileSync(tokenPath, randomBytes(32).toString('base64url'), { mode: 0o600 });
chmodSync(tokenPath, 0o600);
const setupToken = process.env.SETUP_TOKEN || readFileSync(tokenPath, 'utf8').trim();
const dbPath = resolve(process.env.DB_PATH || '.local/media.sqlite');
const app = await createApp({ dbPath, databaseUrl, setupToken, baseUrl: process.env.APP_ORIGIN });
app.server.listen(port, host, async () => {
  const origin = process.env.APP_ORIGIN || `http://localhost:${port}`;
  console.log(`Media Team: ${origin}`);
  if (!await app.db.prepare('SELECT 1 FROM users LIMIT 1').get()) console.log(`Erstes Admin-Konto einrichten: ${origin}/#setup=${setupToken}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
