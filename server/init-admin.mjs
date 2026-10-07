import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openStore, passwordHash } from './store.mjs';
if (existsSync(resolve('.env'))) process.loadEnvFile(resolve('.env'));
if (process.platform !== 'win32') process.umask(0o077);
const email = process.env.ADMIN_EMAIL || process.argv[2];
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL or pass the administrator email as the first argument.');
let password = process.env.ADMIN_PASSWORD;
function maskedPassword(label) {
  return new Promise((accept, reject) => {
    process.stdout.write(label); process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    let value = '';
    const finish = error => { process.stdin.removeListener('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); error ? reject(error) : accept(value); };
    const onData = chunk => {
      for (const char of chunk) {
        if (char === '\u0003') { finish(new Error('Administrator setup cancelled.')); return; }
        if (char === '\r' || char === '\n') { finish(); return; }
        if (char === '\u007f' || char === '\b') { if (value) { value = [...value].slice(0, -1).join(''); process.stdout.write('\b \b'); } }
        else if (char >= ' ' && value.length < 256) { value += char; process.stdout.write('*'); }
      }
    };
    process.stdin.on('data', onData);
  });
}
if (!password) {
  if (process.stdin.isTTY) {
    password = await maskedPassword('New administrator password: ');
    if (password !== await maskedPassword('Confirm password: ')) throw new Error('Passwords do not match.');
  } else {
    const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk);
    password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  }
}
if (password.length < 14 || password.length > 256) throw new Error('Use a unique password of 14–256 characters.');
const db = openStore(resolve(process.env.DATA_DIR || '.runtime', 'site.sqlite'), resolve('data/content.json'));
db.exec('BEGIN IMMEDIATE');
try {
  db.prepare('INSERT INTO admin(id,email,password_hash) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash').run(email, passwordHash(password));
  db.exec('DELETE FROM sessions; COMMIT');
} catch (error) { db.exec('ROLLBACK'); throw error; } finally { db.close(); password = undefined; delete process.env.ADMIN_PASSWORD; }
console.log('Administrator registered. Existing sessions revoked.');
