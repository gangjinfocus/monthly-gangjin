// Local test environment only. The production administrator is registered separately.
import {mkdir,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {createApp} from '../server/app.mjs';
import {passwordHash} from '../server/store.mjs';
await mkdir('test-results',{recursive:true});
const app=createApp({dataDir:resolve('test-results/browser-runtime'),origin:'http://localhost:4173'});
const password=randomBytes(24).toString('base64url');
app.db.prepare('INSERT INTO admin(id,email,password_hash) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash').run('editor@example.test',passwordHash(password));
await writeFile('test-results/browser-login.json',JSON.stringify({email:'editor@example.test',password}),{mode:0o600});
app.server.listen(4173,'127.0.0.1',()=>console.log('Isolated local QA server on http://localhost:4173/'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0)});
