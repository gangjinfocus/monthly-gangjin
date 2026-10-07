import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:4188';
const root = new URL('../../test-results/wp-runtime/', import.meta.url);
const auth = JSON.parse(await readFile(new URL('http-auth.json', root), 'utf8'));
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
if (!process.argv.includes('--admin-only')) {
const publicResponse = await fetch(`${base}/wp-json/monthly-gangjin/v1/content`);
check(publicResponse.ok, 'public content REST');
const publicContent = await publicResponse.json();
const importedArticle = publicContent.articles.find(article => !article.id.startsWith('test-') && !article.id.startsWith('wp-'));
check(publicContent.articles.every(article => article.status === 'published'), 'public content only published');
check(!JSON.stringify(publicContent).includes('fixture@example.invalid'), 'inquiries absent from public content');
check(publicContent.imageCredits.length >= 20, 'attribution exported');
for (const path of ['/', '/archive/', '/subscribe/', '/institutions/', '/advertise/', '/about/', '/search/', '/contact/', '/credits/', ...['privacy','terms','email','subscription','refund'].map(key => `/policies/${key}/`), `/stories/${importedArticle.slug}/`, `/issues/${publicContent.issues[0].id}/`, `/category/${publicContent.categories.find(category => category.slug !== 'uncategorized').slug}/`]) {
  const response = await fetch(base + path);
  const html = await response.text();
  check(response.ok && html.includes('main-content') && !html.includes('Fatal error') && !html.includes('critical error'), `native route ${path}`);
  check(html.includes('data-api-base="http://127.0.0.1:4188/wp-json/monthly-gangjin/v1"'), `API base ${path}`);
  if (path === `/stories/${importedArticle.slug}/`) {
    check(html.includes('gallery-trigger') && html.includes('data-gallery-src'), 'native Gutenberg image gallery with attribution links');
    check(html.includes('article-images') && html.includes('layout-'), 'native Gutenberg magazine layouts');
  }
}
for (const path of ['/stories/test-draft/', '/stories/test-future/']) check((await fetch(base + path)).status === 404, `private article ${path}`);
for (const path of ['/wp-content/themes/monthly-gangjin/assets/site.css','/wp-content/themes/monthly-gangjin/assets/site.js','/wp-content/themes/monthly-gangjin/fonts/fonts.css']) check((await fetch(base+path)).ok, `shared asset ${path}`);
await writeFile(new URL('http-public-result.json',root), JSON.stringify({checks},null,2));
}
const anonymousAdmin = await fetch(`${base}/wp-admin/admin.php?page=mg-dashboard`, {redirect:'manual'});
check([302,303].includes(anonymousAdmin.status), 'anonymous admin requires login');
const admin = await fetch(`${base}/wp-admin/admin.php?page=mg-dashboard`, {headers:{Cookie:auth.cookie}});
const adminHtml = await admin.text();
check(admin.ok && adminHtml.includes('개인정보가 포함된 비공개 접수함'), 'authenticated private admin');
const badStatus = await fetch(`${base}/wp-admin/admin-post.php`, {method:'POST',headers:{Cookie:auth.cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'mg_status',id:String(auth.inquiryId),status:'completed',_wpnonce:'invalid'}),redirect:'manual'});
check(badStatus.status === 403, 'bad status nonce rejected');
for (const status of ['quoted','contracting','active','completed']) {
const goodStatus = await fetch(`${base}/wp-admin/admin-post.php`, {method:'POST',headers:{Cookie:auth.cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'mg_status',id:String(auth.inquiryId),status,_wpnonce:auth.statusNonce}),redirect:'manual'});
check(goodStatus.status === 302, `authenticated nonce ${status} update`);
const changed = await (await fetch(`${base}/wp-admin/admin.php?page=mg-dashboard`,{headers:{Cookie:auth.cookie}})).text();
check(changed.includes(`value="${status}" selected`), `${status} persisted and rendered`);
}
const reusedPublicChecks = process.argv.includes('--admin-only') ? JSON.parse(await readFile(new URL('http-public-result.json',root),'utf8')).checks : 0;
await writeFile(new URL('http-smoke-result.json', root),JSON.stringify({checks:checks+reusedPublicChecks,reusedPublicChecks,wordpressRoutes:'native',adminStatus:'nonce checked and persisted'},null,2));
console.log(`PASS: ${checks} WordPress ${process.argv.includes('--admin-only') ? 'administrator' : 'full'} HTTP assertions${reusedPublicChecks ? `; ${reusedPublicChecks} unchanged public checks reused` : ''}.`);
