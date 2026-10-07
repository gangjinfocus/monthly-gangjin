import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app.mjs';
if (existsSync(resolve('.env'))) process.loadEnvFile(resolve('.env'));
// Restrict new SQLite WAL files and uploads on Unix; Windows uses host ACLs.
if (process.platform !== 'win32') process.umask(0o077);
const app = createApp();
const port = Number(process.env.PORT || 4173);
app.server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Monthly Gangjin listening on ${app.origin}${app.basePath}/ (port ${port}).`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
