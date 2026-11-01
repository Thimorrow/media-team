import { AsyncLocalStorage } from 'node:async_hooks';

export async function openDatabase({ dbPath, databaseUrl, schema } = {}) {
  const context = new AsyncLocalStorage();
  if (databaseUrl) {
    const { default: postgres } = await import('postgres');
    const schemaName = schema || 'media_team';
    if (schemaName !== 'media_team' && !/^media_test_[a-z0-9_]+$/.test(schemaName)) throw new Error('Invalid database schema');
    const url = new URL(databaseUrl);
    const sql = postgres(databaseUrl, { max: 3, idle_timeout: 20, connect_timeout: 15, ssl: ['localhost', '127.0.0.1'].includes(url.hostname) ? false : 'require', prepare: false, onnotice: () => {} });
    await sql.begin(async tx => {
      await tx.unsafe('SELECT pg_advisory_xact_lock(741991)');
      await tx.unsafe(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
      await tx.unsafe(`REVOKE ALL ON SCHEMA ${schemaName} FROM PUBLIC`);
      const roles = await tx.unsafe("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')");
      for (const { rolname } of roles) {
        await tx.unsafe(`REVOKE ALL ON SCHEMA ${schemaName} FROM ${rolname}`);
        await tx.unsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA ${schemaName} FROM ${rolname}`);
        await tx.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} REVOKE ALL ON TABLES FROM ${rolname}`);
      }
      await tx.unsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA ${schemaName} FROM PUBLIC`);
      await tx.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} REVOKE ALL ON TABLES FROM PUBLIC`);
    });
    const qualify = statement => statement
      .replace(/\b(FROM|JOIN|INTO|UPDATE|TABLE IF NOT EXISTS|TABLE|REFERENCES)\s+(users|sessions|invites|settings|services|participants|tasks|rate_limits)\b/g, (_, keyword, table) => `${keyword} ${schemaName}.${table}`)
      .replace(/\bON\s+(users|sessions|invites|settings|services|participants|tasks|rate_limits)(?=\s*\()/g, (_, table) => `ON ${schemaName}.${table}`);
    const query = async (statement, values = []) => {
      let index = 0;
      const result = await (context.getStore() || sql).unsafe(qualify(statement).replace(/\?/g, () => `$${++index}`), values);
      return result.map(row => {
        for (const key of ['n', 'total', 'completed', 'expires_at', 'reset_at']) if (typeof row[key] === 'string') row[key] = Number(row[key]);
        return row;
      });
    };
    return {
      kind: 'postgres',
      exec: statement => (context.getStore() || sql).unsafe(qualify(statement)),
      prepare: statement => ({
        all: (...values) => query(statement, values),
        get: async (...values) => (await query(statement, values))[0],
        run: async (...values) => {
          let index = 0;
          const rows = await (context.getStore() || sql).unsafe(qualify(statement).replace(/\?/g, () => `$${++index}`), values);
          return { changes: rows.count };
        },
      }),
      transaction: fn => sql.begin(tx => context.run(tx, fn)),
      close: () => sql.end({ timeout: 5 }),
    };
  }
  if (!dbPath) throw new Error('A database URL or local database path is required');
  const { DatabaseSync } = await import('node:sqlite');
  const native = new DatabaseSync(dbPath);
  let tail = Promise.resolve();
  const exclusive = fn => {
    if (context.getStore()) return Promise.resolve().then(fn);
    const pending = tail.then(fn);
    tail = pending.catch(() => {});
    return pending;
  };
  return {
    kind: 'sqlite',
    exec: statement => exclusive(() => native.exec(statement)),
    prepare: statement => Object.fromEntries(['get', 'all', 'run'].map(method => [method, (...values) => exclusive(() => native.prepare(statement)[method](...values))])),
    transaction: fn => exclusive(() => context.run(true, async () => {
      native.exec('BEGIN IMMEDIATE');
      try { const result = await fn(); native.exec('COMMIT'); return result; }
      catch (error) { native.exec('ROLLBACK'); throw error; }
    })),
    close: () => exclusive(() => native.close()),
  };
}
