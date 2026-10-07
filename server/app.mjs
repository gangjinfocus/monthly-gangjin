import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';
import { openStore, publicContent, hash, verifyPassword } from './store.mjs';
import { HttpError, inquiry, validateContent, article } from './validation.mjs';

const mime = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };
const hours = 8 * 60 * 60 * 1000;
const equal = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const first = Buffer.from(a); const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
};
export function createApp(options = {}) {
  const root = resolve(options.root || process.cwd());
  const dataDir = resolve(options.dataDir || process.env.DATA_DIR || resolve(root, '.runtime'));
  const origin = new URL(options.origin || process.env.APP_ORIGIN || 'http://localhost:4173').origin;
  const publicOrigins = new Set((options.publicOrigins || String(process.env.PUBLIC_ORIGINS || '').split(',')).filter(Boolean).map(value => {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('PUBLIC_ORIGINS requires HTTPS origins.');
    return url.origin;
  }));
  const basePath = `/${String(options.basePath ?? process.env.BASE_PATH ?? '').replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '') || '';
  if (!/^(?:\/[\w-]+)*$/.test(basePath)) throw new Error('BASE_PATH must contain slash-separated URL-safe segments.');
  const secureCookie = options.secureCookie ?? (process.env.NODE_ENV === 'production' || origin.startsWith('https:'));
  if (process.env.NODE_ENV === 'production' && !origin.startsWith('https:')) throw new Error('Production APP_ORIGIN must use HTTPS.');
  const db = openStore(resolve(dataDir, 'site.sqlite'), options.seedPath || resolve(root, 'data/content.json'));
  const cookieName = secureCookie ? '__Secure-gangjin_session' : 'gangjin_session';
  const attempts = new Map();
  const getContent = () => { const row = db.prepare('SELECT json,revision FROM content WHERE id=1').get(); return { content: JSON.parse(row.json), revision: row.revision }; };
  const cookie = (token, expired = false) => `${cookieName}=${token}; Path=${basePath || '/'}; HttpOnly; SameSite=Strict; Max-Age=${expired ? 0 : 8 * 3600}${secureCookie ? '; Secure' : ''}`;
  function json(res, status, value, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(value)); }
  function rate(req, name, limit, window = 15 * 60 * 1000) {
    const ip = options.trustProxy || process.env.TRUST_PROXY === '1' ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim() : req.socket.remoteAddress;
    const key = `${name}:${hash(ip || 'unknown')}`; const now = Date.now();
    if (attempts.size > 10000) for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
    if (!attempts.has(key) || attempts.get(key).until <= now) attempts.set(key, { count: 0, until: now + window });
    const entry = attempts.get(key); entry.count++;
    if (entry.count > limit) { const error = new HttpError(429, '요청이 많습니다. 잠시 후 다시 시도해 주세요.'); error.retryAfter = Math.ceil((entry.until - now) / 1000); throw error; }
    if (attempts.size > 20000) throw new HttpError(503, '잠시 후 다시 시도해 주세요.');
  }
  async function body(req, max = 1024 * 1024, binary = false) {
    if (Number(req.headers['content-length']) > max) throw new HttpError(413, '요청 용량을 초과했습니다.');
    const chunks = []; let bytes = 0;
    for await (const chunk of req) { bytes += chunk.length; if (bytes > max) throw new HttpError(413, '요청 용량을 초과했습니다.'); chunks.push(chunk); }
    const result = Buffer.concat(chunks);
    if (binary) return result;
    if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] || ''))) throw new HttpError(415, 'JSON 형식이 필요합니다.');
    try { return JSON.parse(result.toString('utf8')); } catch { throw new HttpError(400, 'JSON 형식을 확인해 주세요.'); }
  }
  function session(req) {
    const token = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires>?').get(hash(token), Date.now());
    return row || null;
  }
  function sameOrigin(req) { if (req.headers.origin !== origin) throw new HttpError(403, '요청 출처를 확인할 수 없습니다.'); }
  function authorize(req, write = false) {
    const auth = session(req); if (!auth) throw new HttpError(401, '관리자 로그인이 필요합니다.');
    if (write) { sameOrigin(req); if (!equal(req.headers['x-csrf-token'], auth.csrf)) throw new HttpError(403, '보안 토큰이 만료되었습니다. 새로 고침해 주세요.'); }
    return auth;
  }
  function saveContent(req, value) {
    const valid = validateContent(value);
    const current = getContent();
    if (req.headers['if-match'] !== `"${current.revision}"`) throw new HttpError(409, '다른 편집에서 콘텐츠가 변경되었습니다. 새로 고침 후 다시 저장해 주세요.');
    const changed = db.prepare('UPDATE content SET json=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(valid), current.revision);
    if (!changed.changes) throw new HttpError(409, '다른 편집에서 콘텐츠가 변경되었습니다. 새로 고침 후 다시 저장해 주세요.');
    return { content: valid, revision: current.revision + 1 };
  }
  async function notify(id, reference, payload) {
    const webhook = options.emailWebhook ?? process.env.EMAIL_WEBHOOK_URL;
    if (!webhook) return;
    try {
      const endpoint = new URL(webhook);
      if (endpoint.protocol !== 'https:' && endpoint.hostname !== 'localhost' && endpoint.hostname !== '127.0.0.1') throw new Error('Webhook must use HTTPS.');
      const response = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(7000), headers: { 'Content-Type': 'application/json', ...(process.env.EMAIL_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify({ id, reference, inquiry: payload, to: process.env.NOTIFICATION_EMAIL || getContent().content.settings.email }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      db.prepare('UPDATE inquiries SET notification_status=?, notification_error=NULL WHERE id=?').run('sent', id);
    } catch {
      db.prepare('UPDATE inquiries SET notification_status=?, notification_error=? WHERE id=?').run('failed', '알림 전송 실패. 문의는 저장되었습니다. 관리자에서 확인하세요.', id);
    }
  }
  async function serveFile(res, directory, pathname, privateFile = false) {
    const filepath = resolve(directory, `.${pathname}`);
    if (!filepath.startsWith(resolve(directory) + sep)) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
    if (!mime[extname(filepath).toLowerCase()]) return false;
    let info; try { info = await stat(filepath); } catch { return false; }
    if (!info.isFile()) return false;
    res.writeHead(200, { 'Content-Type': mime[extname(filepath).toLowerCase()], 'Cache-Control': privateFile ? 'no-store' : 'public, max-age=3600' }); res.end(await readFile(filepath)); return true;
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cache-Control', 'no-store');
    // Public templates have a small JSON-LD script; the administrator uses external scripts only.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    try {
      let raw; try { raw = decodeURIComponent(String(req.url || '/').split('?')[0]); } catch { throw new HttpError(400, '주소를 확인해 주세요.'); }
      if (raw.includes('\\') || raw.includes('\0') || raw.split('/').some(v => v === '..' || v === '.')) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
      const url = new URL(req.url, origin);
      if (basePath && raw !== basePath && !raw.startsWith(`${basePath}/`)) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
      const path = raw.slice(basePath.length) || '/';
      const method = req.method;
      if (['/api/content', '/api/inquiries'].includes(path) && (req.headers.origin === origin || publicOrigins.has(req.headers.origin))) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin); res.setHeader('Vary', 'Origin');
        if (method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': path === '/api/inquiries' ? 'POST, OPTIONS' : 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); res.end(); return; }
      }
      if (path.startsWith('/api/admin') || path.startsWith('/admin')) res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
      if (path === '/api/content' && method === 'GET') return json(res, 200, publicContent(getContent().content));
      if (path === '/api/inquiries' && method === 'POST') {
        if (req.headers.origin !== origin && !publicOrigins.has(req.headers.origin)) throw new HttpError(403, '요청 출처를 확인할 수 없습니다.');
        const input = await body(req, 20000); const payload = inquiry(input);
        const fingerprint = hash(JSON.stringify(payload));
        const previous = db.prepare('SELECT * FROM inquiries WHERE idempotency_key=?').get(input.idempotencyKey);
        if (previous) { if (previous.fingerprint !== fingerprint) throw new HttpError(409, '이미 사용한 요청 식별자입니다.'); return json(res, 200, { id: previous.id, reference: previous.reference, message: '문의가 접수되었습니다. 담당자가 확인 후 연락드립니다.' }); }
        rate(req, 'inquiry', options.inquiryRateLimit ?? 10);
        const id = randomUUID(); const reference = `GJ-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(8).toString('hex').toUpperCase()}`; const now = new Date().toISOString();
        db.prepare('INSERT INTO inquiries(id,reference,type,payload,created_at,updated_at,idempotency_key,fingerprint,notification_status) VALUES(?,?,?,?,?,?,?,?,?)').run(id, reference, payload.type, JSON.stringify(payload), now, now, input.idempotencyKey, fingerprint, (options.emailWebhook ?? process.env.EMAIL_WEBHOOK_URL) ? 'pending' : 'disabled');
        await notify(id, reference, payload);
        return json(res, 201, { id, reference, message: '문의가 접수되었습니다. 담당자가 확인 후 연락드립니다.' });
      }
      if (path === '/api/admin/session') {
        if (method === 'GET') { const auth = authorize(req); const admin = db.prepare('SELECT email FROM admin WHERE id=1').get(); return json(res, 200, { email: admin.email, csrfToken: auth.csrf }); }
        if (method === 'POST') {
          sameOrigin(req); rate(req, 'login', options.loginRateLimit ?? 10); const input = await body(req, 2048);
          const admin = db.prepare('SELECT * FROM admin WHERE id=1').get();
          if (!admin) throw new HttpError(503, '서버에서 init-admin 명령으로 관리자 계정을 먼저 등록해 주세요.');
          if (typeof input.password !== 'string' || input.password.length > 256) throw new HttpError(401, '이메일 또는 비밀번호를 확인해 주세요.');
          const passwordValid = verifyPassword(input.password, admin.password_hash);
          if (input.email !== admin.email || !passwordValid) throw new HttpError(401, '이메일 또는 비밀번호를 확인해 주세요.');
          db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
          const token = randomBytes(32).toString('hex'); const csrf = randomBytes(32).toString('hex');
          db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token), csrf, Date.now() + hours);
          return json(res, 200, { email: admin.email, csrfToken: csrf }, { 'Set-Cookie': cookie(token) });
        }
        if (method === 'DELETE') { const auth = authorize(req, true); db.prepare('DELETE FROM sessions WHERE token_hash=?').run(auth.token_hash); return json(res, 200, { message: '로그아웃했습니다.' }, { 'Set-Cookie': cookie('', true) }); }
      }
      if (path.startsWith('/api/admin/')) {
        authorize(req, !['GET', 'HEAD'].includes(method));
        if (path === '/api/admin/content') {
          if (method === 'GET') return json(res, 200, getContent(), { ETag: `"${getContent().revision}"` });
          if (method === 'PUT') return json(res, 200, saveContent(req, await body(req, 12 * 1024 * 1024)));
        }
        if (path === '/api/admin/articles' && method === 'POST') {
          const current = getContent().content; const created = article(await body(req, 2 * 1024 * 1024));
          current.articles.push(created); return json(res, 201, saveContent(req, current));
        }
        if (path.startsWith('/api/admin/articles/')) {
          const id = path.slice('/api/admin/articles/'.length); const current = getContent().content; const index = current.articles.findIndex(a => a.id === id);
          if (index < 0) throw new HttpError(404, '기사를 찾을 수 없습니다.');
          if (method === 'PUT') { const updated = article(await body(req, 2 * 1024 * 1024)); if (updated.id !== id) throw new HttpError(400, '기사 ID는 변경할 수 없습니다.'); current.articles[index] = updated; return json(res, 200, saveContent(req, current)); }
          if (method === 'DELETE') { current.articles.splice(index, 1); for (const key of ['heroArticleIds', 'featuredArticleIds']) current.settings[key] = current.settings[key].filter(v => v !== id); for (const i of current.issues) i.articleIds = i.articleIds.filter(v => v !== id); return json(res, 200, saveContent(req, current)); }
        }
        if (path === '/api/admin/inquiries' && method === 'GET') {
          const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50)); const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0));
          const rows = db.prepare('SELECT id,reference,type,payload,status,created_at,updated_at,notification_status,notification_error FROM inquiries ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset).map(row => ({ ...row, payload: JSON.parse(row.payload) }));
          return json(res, 200, { inquiries: rows, total: db.prepare('SELECT COUNT(*) AS n FROM inquiries').get().n });
        }
        if (path.startsWith('/api/admin/inquiries/') && method === 'PATCH') {
          const id = path.slice('/api/admin/inquiries/'.length); const input = await body(req, 1024);
          if (!['new', 'reviewing', 'contacted', 'closed', 'spam'].includes(input.status)) throw new HttpError(400, '문의 상태를 확인해 주세요.');
          const result = db.prepare('UPDATE inquiries SET status=?,updated_at=? WHERE id=?').run(input.status, new Date().toISOString(), id);
          if (!result.changes) throw new HttpError(404, '문의를 찾을 수 없습니다.'); return json(res, 200, { id, status: input.status });
        }
        if (path.startsWith('/api/admin/inquiries/') && method === 'DELETE') {
          const id = path.slice('/api/admin/inquiries/'.length);
          const removed = db.prepare('DELETE FROM inquiries WHERE id=?').run(id);
          if (!removed.changes) throw new HttpError(404, '문의를 찾을 수 없습니다.');
          return json(res, 200, { id, message: '문의를 삭제했습니다. 기존에 내려받은 백업은 별도로 관리해 주세요.' });
        }
        if (path === '/api/admin/export/content' && method === 'GET') return json(res, 200, publicContent(getContent().content), { 'Content-Disposition': 'attachment; filename="gangjin-public-content.json"' });
        if (path === '/api/admin/export/private' && method === 'GET') {
          return json(res, 200, { version: 1, exportedAt: new Date().toISOString(), content: getContent().content, inquiries: db.prepare('SELECT id,reference,type,payload,status,created_at,updated_at,notification_status,notification_error FROM inquiries ORDER BY created_at').all().map(row => ({ ...row, payload: JSON.parse(row.payload) })) }, { 'Content-Disposition': 'attachment; filename="gangjin-private-backup.json"' });
        }
        if (path === '/api/admin/upload' && method === 'POST') {
          rate(req, 'upload', 40);
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(String(req.headers['content-type'] || '').toLowerCase())) throw new HttpError(415, 'JPEG, PNG, WebP 이미지로 업로드해 주세요.');
          let alt; try { alt = decodeURIComponent(String(req.headers['x-alt'] || '')); } catch { throw new HttpError(400, '대체 텍스트를 확인해 주세요.'); }
          if (!alt.trim() || alt.length > 500 || /[\x00-\x1f]/.test(alt)) throw new HttpError(400, '이미지 대체 텍스트를 입력해 주세요.');
          const buffer = await body(req, 12 * 1024 * 1024, true); let meta;
          try { meta = await sharp(buffer, { limitInputPixels: 40_000_000, animated: false }).metadata(); } catch { throw new HttpError(400, '이미지를 읽을 수 없습니다.'); }
          if (!['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages || 1) > 1 || !meta.width || !meta.height) throw new HttpError(400, '단일 JPEG, PNG, WebP 이미지를 선택해 주세요.');
          const id = randomUUID(); const uploadDir = resolve(dataDir, 'uploads'); await mkdir(uploadDir, { recursive: true });
          const sources = []; const written = [];
          try {
            for (const width of [...new Set([480, 960, 1600, 2400].map(w => Math.min(w, Math.max(meta.width, meta.height))))].sort((a, b) => a - b)) {
              const name = `${id}-${width}.webp`; const outfile = resolve(uploadDir, name);
              const processed = await sharp(buffer, { limitInputPixels: 40_000_000 }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
              await writeFile(outfile, processed.data, { flag: 'wx' }); written.push(outfile); sources.push({ src: `${basePath}/uploads/${name}`, width: processed.info.width, height: processed.info.height });
            }
          } catch { await Promise.all(written.map(file => rm(file, { force: true }))); throw new HttpError(400, '이미지 변환을 완료하지 못했습니다.'); }
          const largest = sources.at(-1); return json(res, 201, { src: largest.src, alt: alt.trim(), width: largest.width, height: largest.height, sources });
        }
        throw new HttpError(404, '관리자 API를 찾을 수 없습니다.');
      }
      if (path.startsWith('/api/')) throw new HttpError(404, 'API를 찾을 수 없습니다.');
      if (!['GET', 'HEAD'].includes(method)) throw new HttpError(405, '허용되지 않는 요청입니다.');
      if (path === '/admin' || path === '/admin/') {
        const html = (await readFile(resolve(root, 'public/admin.html'), 'utf8')).replaceAll('__BASE_PATH__', basePath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
      }
      if (path.startsWith('/uploads/')) { if (await serveFile(res, dataDir, path)) return; throw new HttpError(404, '이미지를 찾을 수 없습니다.'); }
      if (/^\/(?:images\/|fonts\/|admin\.(?:css|js)$|site\.(?:css|js)$|favicon\.)/.test(path)) {
        if (await serveFile(res, resolve(root, 'public'), path, path.startsWith('/admin.'))) return;
        if (await serveFile(res, resolve(root, 'dist'), path)) return;
        throw new HttpError(404, '파일을 찾을 수 없습니다.');
      }
      const content = publicContent(getContent().content);
      if (path === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(`User-agent: *\nDisallow: ${basePath}/admin/\nDisallow: ${basePath}/api/admin/\nSitemap: ${origin}${basePath}/sitemap.xml\n`); return; }
      if (path === '/sitemap.xml') {
        const escapeXml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
        const routes = ['/', '/archive/', '/about/', '/credits/', '/subscribe/', '/institutions/', '/advertise/', '/contact/', ...content.articles.map(a => `/stories/${encodeURIComponent(a.slug)}/`), ...content.categories.map(c => `/category/${encodeURIComponent(c.slug)}/`), ...content.issues.map(i => `/issues/${encodeURIComponent(i.id)}/`)];
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' }); res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route => `<url><loc>${escapeXml(origin + basePath + route)}</loc></url>`).join('')}</urlset>`); return;
      }
      const known = ['/', '/archive/', '/subscribe/', '/institutions/', '/advertise/', '/about/', '/credits/', '/search/', '/contact/', '/policies/privacy/', '/policies/terms/', '/policies/email/', '/policies/subscription/', '/policies/refund/'];
      const normalizedPath = path.endsWith('/') ? path : `${path}/`;
      const exists = known.includes(normalizedPath) || content.articles.some(a => normalizedPath === `/stories/${a.slug}/`) || content.categories.some(c => normalizedPath === `/category/${c.slug}/`) || content.issues.some(i => normalizedPath === `/issues/${i.id}/`);
      if (!exists) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
      const renderer = options.renderPage || (await import(pathToFileURL(resolve(root, 'scripts/render.mjs')).href)).renderPage;
      const html = await renderer(normalizedPath, content, { basePath: `${basePath}/`, siteUrl: origin + basePath, apiBase: options.publicApiBase || process.env.PUBLIC_API_BASE || `${basePath}/api`, mode: 'live' });
      if (!html) throw new HttpError(404, '페이지를 찾을 수 없습니다.');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
    } catch (error) {
      const status = error.status || 500;
      if (status === 500) console.error('Request failed:', error.code || error.name); // No submitted data, secrets, or request URLs.
      if (!res.headersSent) json(res, status, { message: status === 500 ? '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' : error.message }, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
      else res.end();
    }
  });
  server.requestTimeout = 30000; server.headersTimeout = 15000;
  let closed = false;
  return { server, db, dataDir, origin, basePath, getContent, close: async () => { if (closed) return; closed = true; if (server.listening) await new Promise(resolveClose => server.close(resolveClose)); db.close(); } };
}
