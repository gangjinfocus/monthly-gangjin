export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = message => { throw new HttpError(400, message); };
const text = (value, label, max = 500, required = false) => {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value)) fail(`${label} 형식을 확인해 주세요.`);
  const result = value.trim();
  if (required && !result) fail(`${label}을(를) 입력해 주세요.`);
  return result;
};
const email = value => {
  const result = text(value, '이메일', 254, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('올바른 이메일을 입력해 주세요.');
  return result;
};
export function inquiry(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('요청 형식을 확인해 주세요.');
  const schemas = {
    personal: ['name', 'phone', 'email', 'address', 'startMonth', 'notes'],
    institution: ['organization', 'department', 'name', 'phone', 'email', 'address', 'copies', 'duration', 'quotation', 'notes'],
    advertising: ['organization', 'name', 'phone', 'email', 'adType', 'budget', 'message'],
    contact: ['name', 'email', 'message'],
  };
  if (!schemas[input.type]) fail('문의 유형을 확인해 주세요.');
  if (input.consent !== true) fail('개인정보 수집·이용에 동의해 주세요.');
  if (input.website !== undefined && input.website !== '') fail('요청을 확인할 수 없습니다.');
  if (!Number.isFinite(input.startedAt) || now - input.startedAt < 800 || now - input.startedAt > 24 * 60 * 60 * 1000) fail('페이지를 새로 열어 다시 제출해 주세요.');
  if (typeof input.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotencyKey)) fail('요청 식별자가 필요합니다.');
  const out = { type: input.type, consent: true };
  for (const key of schemas[input.type]) {
    if (key === 'email') out[key] = email(input[key]);
    else if (key === 'copies') {
      if (!Number.isInteger(input[key]) || input[key] < 1 || input[key] > 10000) fail('부수는 1~10,000 사이의 정수로 입력해 주세요.');
      out[key] = input[key];
    } else if (key === 'quotation') {
      if (typeof input[key] !== 'boolean') fail('견적서 요청 여부를 확인해 주세요.');
      out[key] = input[key];
    } else {
      out[key] = text(input[key], key, ['message', 'notes'].includes(key) ? 5000 : 500, ['name', 'phone', 'organization', 'address', 'message', 'duration', 'adType', 'startMonth'].includes(key));
    }
  }
  if (out.phone && !/^[+\d()\s.-]{7,30}$/.test(out.phone)) fail('연락처를 확인해 주세요.');
  if (out.startMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(out.startMonth)) fail('구독 시작 월을 확인해 주세요.');
  return out;
}
const identifier = (value, label) => {
  const result = text(value, label, 150, true);
  if (!/^[\p{L}\p{N}_-]+$/u.test(result)) fail(`${label}에는 문자, 숫자, 하이픈만 사용할 수 있습니다.`);
  return result;
};
export function imagePath(value) {
  const result = text(value, '이미지 경로', 2048);
  if (!result) return '';
  if (result.startsWith('https://')) {
    try { const u = new URL(result); if (u.username || u.password) fail('이미지 URL을 확인해 주세요.'); return u.href; } catch { fail('이미지 URL을 확인해 주세요.'); }
  }
  if (/^(?:\/?(?:[\w-]+\/)*)(?:images|uploads)\/[\w./-]+$/.test(result) && !result.split('/').includes('..') && !result.includes('//')) return result;
  fail('이미지는 images 또는 uploads 경로 또는 HTTPS URL이어야 합니다.');
}
const images = value => {
  if (!Array.isArray(value) || value.length > 100) fail('이미지 목록을 확인해 주세요.');
  return value.map(img => {
    if (!img || typeof img !== 'object' || Array.isArray(img)) fail('이미지 형식을 확인해 주세요.');
    return { src: imagePath(img.src), alt: text(img.alt, '대체 텍스트', 500, true), caption: text(img.caption, '설명', 1000), credit: text(img.credit, '크레딧', 500) };
  });
};
const list = (value, max = 100) => {
  if (!Array.isArray(value) || value.length > max) fail('목록을 확인해 주세요.');
  return value.map(v => text(v, '목록 항목', 150, true));
};
export const BLOCK_TYPES = ['paragraph', 'heading', 'quote', 'image', 'pair', 'trio', 'mosaic', 'strip', 'portrait', 'full', 'overlap', 'split'];
export function article(a) {
  if (!a || typeof a !== 'object') fail('기사 형식을 확인해 주세요.');
  if (!['draft', 'scheduled', 'published'].includes(a.status)) fail('발행 상태를 확인해 주세요.');
  if (!Array.isArray(a.blocks) || a.blocks.length > 500) fail('본문 블록을 확인해 주세요.');
  if (a.status === 'scheduled' && !Number.isFinite(Date.parse(a.publishAt))) fail('예약 발행 시각을 입력해 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date || '') || !Number.isFinite(Date.parse(a.date))) fail('기사 날짜를 확인해 주세요.');
  return {
    id: identifier(a.id, '기사 ID'), slug: identifier(a.slug, '기사 주소'), title: text(a.title, '제목', 250, true),
    subtitle: text(a.subtitle, '부제', 1000), category: identifier(a.category, '카테고리'), author: text(a.author, '저자', 200),
    photographer: text(a.photographer, '사진가', 200), date: a.date, status: a.status,
    publishAt: a.status === 'scheduled' ? new Date(a.publishAt).toISOString() : null,
    primaryImage: imagePath(a.primaryImage), secondaryImage: imagePath(a.secondaryImage), images: images(a.images || []),
    tags: list(a.tags || []), people: list(a.people || []), places: list(a.places || []), issueId: text(a.issueId, '호 ID', 150),
    isDemo: a.isDemo === true, seo: { title: text(a.seo?.title, 'SEO 제목', 250), description: text(a.seo?.description, 'SEO 설명', 1000) },
    blocks: a.blocks.map(block => {
      if (!block || !BLOCK_TYPES.includes(block.type)) fail('지원하지 않는 본문 블록입니다.');
      return { type: block.type, text: text(block.text, '본문', 20000), images: images(block.images || []) };
    }),
  };
}
export function validateContent(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.articles) || !Array.isArray(value.categories) || !Array.isArray(value.issues)) fail('콘텐츠 문서 형식을 확인해 주세요.');
  if (value.articles.length > 5000 || value.issues.length > 1000 || value.categories.length > 100) fail('콘텐츠 한도를 초과했습니다.');
  const s = value.settings || {};
  const settings = {};
  for (const key of ['name', 'englishName', 'tagline', 'email', 'singlePrice', 'annualPrice']) settings[key] = text(String(s[key] ?? ''), key, 1000, key === 'name');
  if (settings.email) settings.email = email(settings.email);
  settings.heroArticleIds = list(s.heroArticleIds || []); settings.featuredArticleIds = list(s.featuredArticleIds || []);
  if (s.heroImages !== undefined && (!Array.isArray(s.heroImages) || s.heroImages.length > 100)) fail('히어로 이미지 목록을 확인해 주세요.');
  settings.heroImages = (s.heroImages || []).map(v => typeof v === 'string' ? imagePath(v) : images([v])[0]);
  settings.sectionOrder = list(s.sectionOrder || []);
  settings.footer = {};
  for (const key of ['publisher', 'editor', 'address', 'businessNumber', 'registrationNumber', 'issn', 'phone']) settings.footer[key] = text(s.footer?.[key], key, 1000);
  settings.social = {};
  for (const key of ['instagram', 'youtube', 'facebook']) {
    const v = text(s.social?.[key], key, 2048);
    if (v && !/^https:\/\//.test(v)) fail('SNS 링크는 HTTPS 주소여야 합니다.');
    settings.social[key] = v;
  }
  if (value.categories.some(c => !c || typeof c !== 'object') || value.issues.some(i => !i || typeof i !== 'object')) fail('카테고리와 발행호 형식을 확인해 주세요.');
  const categories = value.categories.map(c => ({ slug: identifier(c.slug, '카테고리 주소'), name: text(c.name, '카테고리명', 200, true), description: text(c.description, '카테고리 설명', 2000) }));
  const articles = value.articles.map(article);
  const issues = value.issues.map(i => ({ id: identifier(i.id, '호 ID'), volume: text(String(i.volume ?? ''), '호수', 100, true), month: text(i.month, '발행 월', 100, true), title: text(i.title, '호 제목', 250, true), description: text(i.description, '호 설명', 5000), cover: imagePath(i.cover), articleIds: list(i.articleIds || [], 500), isDemo: i.isDemo === true }));
  for (const [array, keys] of [[articles, ['id', 'slug']], [issues, ['id']], [categories, ['slug']]]) for (const key of keys) if (new Set(array.map(x => x[key])).size !== array.length) fail(`${key} 값이 중복되었습니다.`);
  const categoryIds = new Set(categories.map(c => c.slug)); const issueIds = new Set(issues.map(i => i.id)); const articleIds = new Set(articles.map(a => a.id));
  for (const a of articles) { if (!categoryIds.has(a.category)) fail('기사 카테고리가 존재하지 않습니다.'); if (a.issueId && !issueIds.has(a.issueId)) fail('기사 호가 존재하지 않습니다.'); }
  for (const id of [...settings.heroArticleIds, ...settings.featuredArticleIds, ...issues.flatMap(i => i.articleIds)]) if (!articleIds.has(id)) fail('선택한 기사가 존재하지 않습니다.');
  if (value.imageCredits !== undefined && (!Array.isArray(value.imageCredits) || value.imageCredits.length > 10000)) fail('사진 출처 목록을 확인해 주세요.');
  const sourceUrl = value => {
    const result = text(value, '출처 URL', 2048);
    if (!result) return '';
    try { const url = new URL(result); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('출처 URL을 확인해 주세요.'); return url.href; } catch { fail('출처 URL을 확인해 주세요.'); }
  };
  if ((value.imageCredits || []).some(c => !c || typeof c !== 'object')) fail('사진 출처 형식을 확인해 주세요.');
  const imageCredits = (value.imageCredits || []).map(credit => ({
    id: identifier(credit.id, '사진 ID'), ...images([credit])[0],
    width: Number.isInteger(credit.width) && credit.width > 0 ? credit.width : null,
    height: Number.isInteger(credit.height) && credit.height > 0 ? credit.height : null,
    source: sourceUrl(credit.source), license: text(credit.license, '라이선스', 500),
    licenseUrl: sourceUrl(credit.licenseUrl), description: text(credit.description, '사진 기록', 5000),
  }));
  return { version: 1, settings, categories, articles, issues, imageCredits };
}
