import { spawn } from 'node:child_process';

const backend = spawn(process.execPath, ['--watch', 'server/index.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '3001', APP_ORIGIN: 'http://localhost:5173' },
});
const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { stdio: 'inherit' });
const stop = () => { backend.kill(); frontend.kill(); };
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
for (const child of [backend, frontend]) child.once('exit', code => { stop(); process.exitCode = code || 0; });
