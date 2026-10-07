import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { createApp } from '../server/app.mjs';
import { passwordHash } from '../server/store.mjs';

const seed = () => ({ version: 1, settings: { name: '월간 강진', englishName: 'Monthly Gangjin', email: 'editor@example.test', heroArticleIds: ['public', 'draft', 'due', 'future'], featuredArticleIds: ['draft'], heroImages: [], sectionOrder: [], footer: {}, social: {} }, categories: [{ slug: 'life', name: '생활', description: '' }], articles: ['public', 'draft', 'due', 'future'].map(id => ({ id, slug: id, title: `제목 ${id}`, subtitle: '', category: 'life', author: '', photographer: '', date: '2026-10-07', status: id === 'public' ? 'published' : id === 'draft' ? 'draft' : 'scheduled', publishAt: id === 'due' ? '2020-01-01T00:00:00Z' : id === 'future' ? '2099-01-01T00:00:00Z' : null, primaryImage: 'images/demo.jpg', secondaryImage: '', images: [], tags: [], people: [], places: [], issueId: 'one', isDemo: true, seo: { title: '', description: '' }, blocks: [{ type: 'paragraph', text: '본문', images: [] }] })), issues: [{ id: 'one', volume: '1', month: '2026-10', title: '첫 호', description: '', cover: 'images/demo.jpg', articleIds: ['public', 'draft', 'due', 'future'], isDemo: true }] });
async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(resolve(tmpdir(), 'gangjin-backend-')); const seedPath = resolve(dir, 'content.json'); await writeFile(seedPath, JSON.stringify(seed()));
  const app = createApp({ root: resolve(import.meta.dirname, '..'), dataDir: resolve(dir, 'private'), seedPath, origin: 'http://localhost:4173', renderPage: (path, content, config) => `<html>${content.articles.map(a => a.title).join('|')} ${config.apiBase}</html>`, ...overrides });
  app.db.prepare('INSERT INTO admin(id,email,password_hash) VALUES(1,?,?)').run('editor@example.test', passwordHash('unique-password-for-testing'));
  await new Promise(resolveListen => app.server.listen(0, '127.0.0.1', resolveListen));
  const address = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const call = async (path, { method = 'GET', data, cookie, csrf, headers = {}, binary } = {}) => {
    const res = await fetch(address + (overrides.basePath || '') + path, { method, headers: { Origin: 'http://localhost:4173', ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers }, body: binary || (data ? JSON.stringify(data) : undefined) });
    const body = (res.headers.get('content-type') || '').includes('application/json') ? await res.json() : await res.text(); return { res, body };
  };
  const login = async () => { const { res, body } = await call('/api/admin/session', { method: 'POST', data: { email: 'editor@example.test', password: 'unique-password-for-testing' } }); assert.equal(res.status, 200); return { cookie: res.headers.get('set-cookie').split(';')[0], csrf: body.csrfToken }; };
  return { app, call, login, dir, address };
}
const form = () => ({ type: 'contact', name: '문의자', email: 'private@example.test', message: '개인적인 문의 내용', consent: true, website: '', startedAt: Date.now() - 10000, idempotencyKey: crypto.randomUUID() });

test('public content never leaks draft/future articles; due articles and links are live', async t => {
  const { call } = await fixture(t);
  const { body } = await call('/api/content');
  assert.deepEqual(body.articles.map(a => a.id), ['public', 'due']); assert.equal(body.articles[1].status, 'published');
  assert.deepEqual(body.settings.heroArticleIds, ['public', 'due']); assert.deepEqual(body.issues[0].articleIds, ['public', 'due']);
  const html = await call('/'); assert.match(html.body, /제목 public/); assert.doesNotMatch(html.body, /제목 draft|제목 future/);
});
test('administrator authentication, cookie attributes, CSRF/origin checks, logout', async t => {
  const { call, login } = await fixture(t);
  assert.equal((await call('/api/admin/content')).res.status, 401);
  assert.equal((await call('/api/admin/export/private')).res.status, 401);
  assert.equal((await call('/api/admin/session', { method: 'POST', data: { email: 'editor@example.test', password: 'wrong' } })).res.status, 401);
  const auth = await login(); const session = await call('/api/admin/session', auth); assert.equal(session.body.csrfToken, auth.csrf);
  const current = (await call('/api/admin/content', auth)).body;
  assert.equal((await call('/api/admin/content', { ...auth, csrf: '', method: 'PUT', data: current.content, headers: { 'If-Match': '"1"' } })).res.status, 403);
  assert.equal((await call('/api/admin/content', { ...auth, method: 'PUT', data: current.content, headers: { Origin: 'https://attacker.test', 'If-Match': '"1"' } })).res.status, 403);
  const response = await call('/api/admin/session', { ...auth, method: 'DELETE' }); assert.equal(response.res.status, 200); assert.match(response.res.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Max-Age=0/);
  assert.equal((await call('/api/admin/content', auth)).res.status, 401);
});
test('content CRUD instant rendering, revisions prevent lost updates, invalid image paths blocked', async t => {
  const { call, login } = await fixture(t); const auth = await login();
  let doc = (await call('/api/admin/content', auth)).body;
  const newArticle = { ...structuredClone(doc.content.articles[0]), id: 'new', slug: 'new', title: '바뀐 제목', status: 'published' };
  let saved = await call('/api/admin/articles', { ...auth, method: 'POST', data: newArticle, headers: { 'If-Match': `"${doc.revision}"` } }); assert.equal(saved.res.status, 201);
  assert.match((await call('/')).body, /바뀐 제목/);
  assert.equal((await call('/api/admin/content', { ...auth, method: 'PUT', data: doc.content, headers: { 'If-Match': `"${doc.revision}"` } })).res.status, 409);
  doc = saved.body; const invalid = structuredClone(doc.content); invalid.articles[0].primaryImage = '../private/site.sqlite';
  assert.equal((await call('/api/admin/content', { ...auth, method: 'PUT', data: invalid, headers: { 'If-Match': `"${doc.revision}"` } })).res.status, 400);
  saved = await call('/api/admin/articles/new', { ...auth, method: 'DELETE', headers: { 'If-Match': `"${doc.revision}"` } }); assert.equal(saved.res.status, 200);
  assert.doesNotMatch((await call('/')).body, /바뀐 제목/);
});
test('inquiries validate consent, persist, deduplicate retries, and remain absent in public export', async t => {
  const { call, login, app } = await fixture(t); const auth = await login(); const data = form();
  assert.equal((await call('/api/inquiries', { method: 'POST', data: { ...data, consent: false } })).res.status, 400);
  assert.equal((await call('/api/inquiries', { method: 'POST', data: { ...data, email: 'bad' } })).res.status, 400);
  assert.equal((await call('/api/inquiries', { method: 'POST', data: { ...data, website: 'spam' } })).res.status, 400);
  const accepted = await call('/api/inquiries', { method: 'POST', data }); assert.equal(accepted.res.status, 201); assert.match(accepted.body.reference, /^GJ-/);
  const retry = await call('/api/inquiries', { method: 'POST', data }); assert.equal(retry.res.status, 200); assert.equal(retry.body.id, accepted.body.id);
  assert.equal((await call('/api/inquiries', { method: 'POST', data: { ...data, message: 'different' } })).res.status, 409);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM inquiries').get().n, 1);
  const listing = (await call('/api/admin/inquiries', auth)).body; assert.equal(listing.inquiries[0].payload.email, data.email);
  assert.equal((await call(`/api/admin/inquiries/${accepted.body.id}`, { ...auth, method: 'PATCH', data: { status: 'closed' } })).res.status, 200);
  assert.equal((await call(`/api/admin/inquiries/${accepted.body.id}`, { ...auth, method: 'PATCH', data: { status: 'invalid' } })).res.status, 400);
  assert.doesNotMatch(JSON.stringify((await call('/api/content')).body), /private@example/);
  assert.doesNotMatch(JSON.stringify((await call('/api/admin/export/content', auth)).body), /private@example|제목 draft/);
  const backup = await call('/api/admin/export/private', auth); assert.equal(backup.body.inquiries[0].status, 'closed'); assert.match(JSON.stringify(backup.body), /private@example/); assert.doesNotMatch(JSON.stringify(backup.body), /password_hash|token_hash/);
  assert.equal((await call(`/api/admin/inquiries/${accepted.body.id}`, { ...auth, csrf: '', method: 'DELETE' })).res.status, 403);
  assert.equal((await call(`/api/admin/inquiries/${accepted.body.id}`, { ...auth, method: 'DELETE' })).res.status, 200);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM inquiries').get().n, 0);
});
test('stored inquiry survives SQLite restart; webhook failure never loses submission', async t => {
  const { app, call, dir } = await fixture(t, { emailWebhook: 'http://127.0.0.1:1/unreachable' }); const accepted = await call('/api/inquiries', { method: 'POST', data: form() }); assert.equal(accepted.res.status, 201);
  assert.equal(app.db.prepare('SELECT notification_status FROM inquiries').get().notification_status, 'failed');
  await app.close();
  const restarted = createApp({ root: resolve(import.meta.dirname, '..'), dataDir: resolve(dir, 'private'), seedPath: resolve(dir, 'content.json'), origin: 'http://localhost:4173' });
  assert.equal(restarted.db.prepare('SELECT id FROM inquiries').get().id, accepted.body.id); await restarted.close();
});
test('inquiry and login rate limits fail explicitly; idempotent retries are still accepted', async t => {
  const { call } = await fixture(t, { inquiryRateLimit: 1, loginRateLimit: 1 }); const data = form();
  assert.equal((await call('/api/inquiries', { method: 'POST', data })).res.status, 201);
  assert.equal((await call('/api/inquiries', { method: 'POST', data })).res.status, 200);
  const blocked = await call('/api/inquiries', { method: 'POST', data: form() }); assert.equal(blocked.res.status, 429); assert.ok(Number(blocked.res.headers.get('retry-after')) > 0);
  assert.equal((await call('/api/admin/session', { method: 'POST', data: { email: 'editor@example.test', password: 'bad' } })).res.status, 401);
  assert.equal((await call('/api/admin/session', { method: 'POST', data: { email: 'editor@example.test', password: 'bad' } })).res.status, 429);
});
test('image uploads are re-encoded variants with base-aware paths; unsafe files and traversal blocked', async t => {
  const { call, login, address } = await fixture(t, { basePath: '/monthly' }); const auth = await login();
  const input = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#446655' } }).jpeg().toBuffer();
  const uploaded = await call('/api/admin/upload', { ...auth, method: 'POST', binary: input, headers: { 'Content-Type': 'image/jpeg', 'X-Alt': encodeURIComponent('강진의 풍경'), 'X-File-Name': '../../private' } });
  assert.equal(uploaded.res.status, 201); assert.match(uploaded.body.src, /^\/monthly\/uploads\/[a-f\d-]+-\d+\.webp$/); assert.equal(uploaded.body.alt, '강진의 풍경'); assert.ok(uploaded.body.sources.length > 1);
  const imageResponse = await fetch(address + uploaded.body.src); assert.equal(imageResponse.status, 200); assert.equal(imageResponse.headers.get('content-type'), 'image/webp');
  const invalid = await call('/api/admin/upload', { ...auth, method: 'POST', binary: Buffer.from('<script>evil</script>'), headers: { 'Content-Type': 'image/jpeg', 'X-Alt': 'test' } }); assert.equal(invalid.res.status, 400);
  const traversal = await fetch(`${address}/monthly/uploads/%2e%2e%2fsite.sqlite`); assert.equal(traversal.status, 404);
  const db = await call('/.runtime/site.sqlite'); assert.equal(db.res.status, 404);
});
test('administrator frontend has no inline scripts, PII localStorage, or syntax errors', async () => {
  const html = await readFile(resolve(import.meta.dirname, '../public/admin.html'), 'utf8'); const script = await readFile(resolve(import.meta.dirname, '../public/admin.js'), 'utf8');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/); assert.doesNotMatch(script, /localStorage\s*\./);
  const { Script } = await import('node:vm'); assert.doesNotThrow(() => new Script(script));
});
test('public frontend CORS allowlist excludes administrator APIs and foreign origins', async t => {
  const { call } = await fixture(t, { publicOrigins: ['https://gangjinfocus.github.io'] });
  const preflight = await call('/api/inquiries', { method: 'OPTIONS', headers: { Origin: 'https://gangjinfocus.github.io' } });
  assert.equal(preflight.res.status, 204); assert.equal(preflight.res.headers.get('access-control-allow-origin'), 'https://gangjinfocus.github.io');
  const accepted = await call('/api/inquiries', { method: 'POST', data: form(), headers: { Origin: 'https://gangjinfocus.github.io' } }); assert.equal(accepted.res.status, 201);
  const foreign = await call('/api/inquiries', { method: 'POST', data: form(), headers: { Origin: 'https://foreign.example' } }); assert.equal(foreign.res.status, 403); assert.equal(foreign.res.headers.get('access-control-allow-origin'), null);
  const admin = await call('/api/admin/session', { method: 'POST', data: { email: 'editor@example.test', password: 'unique-password-for-testing' }, headers: { Origin: 'https://gangjinfocus.github.io' } }); assert.equal(admin.res.status, 403); assert.equal(admin.res.headers.get('access-control-allow-origin'), null);
});
test('editing retains photo source/license metadata and live sitemap never exposes drafts', async t => {
  const { call, login } = await fixture(t); const auth = await login(); const current = (await call('/api/admin/content', auth)).body;
  current.content.imageCredits = [{ id: 'photo', src: '/images/demo.jpg', alt: '풍경', caption: '', credit: 'Author', width: 100, height: 100, source: 'https://commons.wikimedia.org/wiki/File:Example.jpg', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', description: 'Source attribution' }];
  const saved = await call('/api/admin/content', { ...auth, method: 'PUT', data: current.content, headers: { 'If-Match': `"${current.revision}"` } }); assert.equal(saved.res.status, 200);
  assert.equal((await call('/api/content')).body.imageCredits[0].license, 'CC BY 4.0');
  const sitemap = await call('/sitemap.xml'); assert.equal(sitemap.res.status, 200); assert.match(sitemap.body, /stories\/public/); assert.doesNotMatch(sitemap.body, /stories\/(draft|future)/);
  assert.equal((await call('/stories/draft/')).res.status, 404);
});
test('all public inquiry forms validate exact types, required fields, and freshness', async t => {
  const { call } = await fixture(t);
  const examples = [
    { type: 'personal', name: '독자', phone: '010-1234-5678', email: 'reader@example.test', address: '강진군', startMonth: '2026-11', notes: '' },
    { type: 'institution', organization: '도서관', department: '', name: '담당자', phone: '061-123-4567', email: 'staff@example.test', address: '강진군', copies: 5, duration: '12', quotation: true, notes: '' },
    { type: 'advertising', organization: '광고주', name: '담당자', phone: '010-1234-5678', email: 'ad@example.test', adType: 'print', budget: '', message: '광고 상담 요청' },
  ];
  for (const example of examples) assert.equal((await call('/api/inquiries', { method: 'POST', data: { ...form(), ...example } })).res.status, 201);
  assert.equal((await call('/api/inquiries', { method: 'POST', data: { ...form(), ...examples[1], copies: '5' } })).res.status, 400);
  assert.equal((await call('/api/inquiries', { method: 'POST', data: { ...form(), ...examples[1], quotation: 'true' } })).res.status, 400);
  assert.equal((await call('/api/inquiries', { method: 'POST', data: { ...form(), startedAt: Date.now() } })).res.status, 400);
  assert.equal((await call('/api/inquiries', { method: 'POST', data: { ...form(), startedAt: Date.now() - 2 * 24 * 60 * 60 * 1000 } })).res.status, 400);
  assert.equal((await call('/api/inquiries', { method: 'POST', data: { ...form(), name: '' } })).res.status, 400);
});
test('CLI refuses short passwords, stores only scrypt hash, and revokes sessions on credential change', async t => {
  const dir = await mkdtemp(resolve(tmpdir(), 'gangjin-cli-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(resolve(dir, 'data')); await writeFile(resolve(dir, 'data/content.json'), JSON.stringify(seed()));
  const { spawnSync } = await import('node:child_process'); const entry = resolve(import.meta.dirname, '../server/init-admin.mjs');
  const env = { ...process.env, ADMIN_EMAIL: 'editor@example.test', DATA_DIR: resolve(dir, 'private'), ADMIN_PASSWORD: 'tiny' };
  const rejected = spawnSync(process.execPath, [entry], { cwd: dir, env, encoding: 'utf8' }); assert.notEqual(rejected.status, 0); assert.doesNotMatch(rejected.stderr, /tiny/);
  const secret = 'long-unique-cli-testing-password';
  const registered = spawnSync(process.execPath, [entry], { cwd: dir, env: { ...env, ADMIN_PASSWORD: secret }, encoding: 'utf8' }); assert.equal(registered.status, 0); assert.doesNotMatch(registered.stdout + registered.stderr, new RegExp(secret));
  const { DatabaseSync } = await import('node:sqlite'); const db = new DatabaseSync(resolve(dir, 'private/site.sqlite')); const stored = db.prepare('SELECT password_hash FROM admin').get().password_hash;
  assert.notEqual(stored, secret); assert.match(stored, /^[a-f\d]{32}:[a-f\d]{128}$/); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('test', 'csrf', Date.now() + 10000); db.close();
  const rotated = spawnSync(process.execPath, [entry], { cwd: dir, env: { ...env, ADMIN_PASSWORD: secret + '-rotated' }, encoding: 'utf8' }); assert.equal(rotated.status, 0);
  const reopened = new DatabaseSync(resolve(dir, 'private/site.sqlite')); assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0); reopened.close();
});
