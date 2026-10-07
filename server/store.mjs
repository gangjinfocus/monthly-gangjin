import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export const hash = value => createHash('sha256').update(value).digest('hex');
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  const [salt, digest] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function openStore(path, seedPath) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (process.platform !== 'win32') chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id=1), email TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, type TEXT NOT NULL,
      payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL, fingerprint TEXT NOT NULL, notification_status TEXT NOT NULL, notification_error TEXT);
    CREATE INDEX IF NOT EXISTS inquiries_created ON inquiries(created_at DESC);`);
  if (!db.prepare('SELECT id FROM content WHERE id=1').get()) {
    const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
    db.prepare('INSERT INTO content(id,json) VALUES(1,?)').run(JSON.stringify(seed));
  }
  return db;
}
export function publicContent(content, now = Date.now()) {
  const copy = structuredClone(content);
  copy.articles = copy.articles.filter(a => a.status === 'published' || (a.status === 'scheduled' && Number.isFinite(Date.parse(a.publishAt)) && Date.parse(a.publishAt) <= now)).map(a => ({ ...a, status: 'published' }));
  const ids = new Set(copy.articles.map(a => a.id));
  for (const issue of copy.issues) issue.articleIds = issue.articleIds.filter(id => ids.has(id));
  for (const key of ['heroArticleIds', 'featuredArticleIds']) copy.settings[key] = (copy.settings[key] || []).filter(id => ids.has(id));
  return copy;
}
