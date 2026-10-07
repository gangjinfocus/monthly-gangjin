/* Private state lives only in memory. Cookies are HttpOnly. */
(() => {
  'use strict';
  const apiBase = document.body.dataset.apiBase;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const types = ['paragraph', 'heading', 'quote', 'image', 'pair', 'trio', 'mosaic', 'strip', 'portrait', 'full', 'overlap', 'split'];
  const typeNames = { paragraph: '문단', heading: '소제목', quote: '인용', image: '한 장', pair: '두 장', trio: '세 장', mosaic: '모자이크', strip: '필름 스트립', portrait: '세로 사진', full: '전폭 사진', overlap: '겹친 사진', split: '사진 · 글 분할' };
  const statusNames = { draft: '초안', published: '공개', scheduled: '예약' };
  let csrf = '', content = null, revision = 0, editing = null, editedIssue = null, tab = 'articles', offset = 0;
  function notice(message = '', error = false) { $('#notice').textContent = message; $('#notice').classList.toggle('error', error); }
  async function request(path, { method = 'GET', data, binary, headers = {} } = {}) {
    const response = await fetch(`${apiBase}${path}`, { method, credentials: 'same-origin', headers: { ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(!['GET', 'HEAD'].includes(method) && csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers }, body: binary ?? (data === undefined ? undefined : JSON.stringify(data)) });
    const result = await response.json().catch(() => ({ message: '서버 응답을 읽을 수 없습니다.' }));
    if (!response.ok) { if (response.status === 401) showLogin(); throw new Error(result.message); }
    return result;
  }
  function showLogin() { csrf = ''; content = null; $('#workspace').hidden = true; $('#login').hidden = false; $('#logout').hidden = true; if ($('#editor').open) $('#editor').close(); }
  async function refresh() { const data = await request('/admin/content'); content = data.content; revision = data.revision; }
  async function ready(session) { csrf = session.csrfToken; await refresh(); $('#login').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false; renderTab(); }
  async function commit(next) { const result = await request('/admin/content', { method: 'PUT', data: next, headers: { 'If-Match': `"${revision}"` } }); content = result.content; revision = result.revision; notice('저장했습니다. 공개 페이지에 반영되었습니다.'); }
  function field(name, label, value = '', type = 'text', required = false, extra = '') { return `<label>${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}"${required ? ' required' : ''} ${extra}></label>`; }
  function area(name, label, value = '') { return `<label>${esc(label)}<textarea name="${esc(name)}">${esc(value)}</textarea></label>`; }
  function options(items, selected) { return items.map(i => `<option value="${esc(i.value)}"${i.value === selected ? ' selected' : ''}>${esc(i.label)}</option>`).join(''); }
  function articleChecks(name, ids) { return `<div class="checks">${content.articles.map(a => `<label><input type="checkbox" name="${name}" value="${esc(a.id)}"${ids.includes(a.id) ? ' checked' : ''}>${esc(a.title)} <span class="status">${statusNames[a.status]}</span></label>`).join('')}</div>`; }
  function renderTab() {
    document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    if (tab === 'articles') renderArticles(); else if (tab === 'issues') renderIssues(); else if (tab === 'settings') renderSettings(); else if (tab === 'inquiries') renderInquiries().catch(e => notice(e.message, true)); else renderExports();
  }
  function renderArticles() {
    $('#panel').innerHTML = `<h1>기사 관리</h1><p>초안과 미래 예약 기사는 공개 JSON과 검색 목록에 포함되지 않습니다.</p><div class="toolbar"><button id="new-article">새 기사</button><button id="refresh" class="secondary">새로 고침</button><input id="article-filter" placeholder="제목 검색" aria-label="제목 검색"></div><div class="table-wrap"><table><thead><tr><th>기사</th><th>카테고리</th><th>상태</th><th>작업</th></tr></thead><tbody>${content.articles.map(a => `<tr data-title="${esc(a.title.toLowerCase())}"><td>${esc(a.title)}<br><span class="muted">${esc(a.slug)} · ${esc(a.date)}${a.isDemo ? ' · 예시 콘텐츠' : ''}</span></td><td>${esc(content.categories.find(c => c.slug === a.category)?.name || a.category)}</td><td><span class="status">${statusNames[a.status]}</span>${a.publishAt ? `<br><span class="muted">${esc(new Date(a.publishAt).toLocaleString('ko-KR'))}</span>` : ''}</td><td><button data-edit="${esc(a.id)}">편집</button></td></tr>`).join('')}</tbody></table></div>`;
    $('#new-article').onclick = () => openArticle();
    $('#refresh').onclick = async () => { try { await refresh(); renderArticles(); notice('최신 콘텐츠를 불러왔습니다.'); } catch(e) { notice(e.message, true); } };
    $('#article-filter').oninput = e => document.querySelectorAll('[data-title]').forEach(row => row.hidden = !row.dataset.title.includes(e.target.value.toLowerCase()));
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openArticle(b.dataset.edit));
  }
  function openArticle(id) {
    editing = id ? structuredClone(content.articles.find(a => a.id === id)) : { id: crypto.randomUUID(), slug: '', title: '', subtitle: '', category: content.categories[0]?.slug || '', author: '', photographer: '', date: new Date().toISOString().slice(0, 10), status: 'draft', publishAt: null, primaryImage: '', secondaryImage: '', images: [], tags: [], people: [], places: [], issueId: '', isDemo: false, seo: { title: '', description: '' }, blocks: [{ type: 'paragraph', text: '', images: [] }] };
    $('#editor-title').textContent = id ? '기사 편집' : '새 기사';
    $('#editor-fields').innerHTML = `<div class="grid">${field('title', '제목', editing.title, 'text', true)}${field('slug', '기사 주소 (문자·숫자·하이픈)', editing.slug, 'text', true)}${field('subtitle', '부제', editing.subtitle)}<label>카테고리<select name="category">${options(content.categories.map(c => ({ value: c.slug, label: c.name })), editing.category)}</select></label>${field('author', '저자', editing.author)}${field('photographer', '사진가', editing.photographer)}${field('date', '기사 날짜', editing.date, 'date', true)}<label>발행 상태<select name="status">${options(Object.entries(statusNames).map(([value, label]) => ({ value, label })), editing.status)}</select></label>${field('publishAt', '예약 시각 (현재 브라우저 시간대)', editing.publishAt ? localDateTime(editing.publishAt) : '', 'datetime-local')}<label>발행호<select name="issueId"><option value="">미지정</option>${options(content.issues.map(i => ({ value: i.id, label: i.title })), editing.issueId)}</select></label>${field('tags', '태그 (쉼표 구분)', editing.tags.join(', '))}${field('people', '사람 (쉼표 구분)', editing.people.join(', '))}${field('places', '장소 (쉼표 구분)', editing.places.join(', '))}<label><input name="isDemo" type="checkbox"${editing.isDemo ? ' checked' : ''}> 예시 콘텐츠 표시</label>${field('seoTitle', '검색 제목', editing.seo.title)}${field('seoDescription', '검색 설명', editing.seo.description)}</div><fieldset><legend>대표 이미지</legend>${imageEditor(editing.images[0] || { src: editing.primaryImage, alt: editing.title }, 'primary')}<p class="muted">대표 이미지 업로드 후 대체 텍스트·설명·출처를 입력하세요. 기존 경로는 images/ 또는 uploads/입니다.</p>${field('secondaryImage', '보조 이미지 경로 (선택)', editing.secondaryImage)}</fieldset><h3>본문 블록</h3><p class="muted">사진 블록은 이미지 추가 버튼으로 여러 장을 배치할 수 있습니다. 위·아래 버튼으로 읽는 순서를 바꿉니다.</p><div id="blocks"></div><div class="toolbar"><select id="block-type" aria-label="추가할 블록">${options(types.map(value => ({ value, label: typeNames[value] })), 'paragraph')}</select><button type="button" id="add-block">블록 추가</button>${id ? '<button type="button" id="delete-article" class="danger">기사 삭제</button>' : ''}</div>`;
    renderBlocks(); bindImages($('#editor-fields'));
    $('#add-block').onclick = () => { captureBlocks(); editing.blocks.push({ type: $('#block-type').value, text: '', images: [] }); renderBlocks(); };
    if (id) $('#delete-article').onclick = async () => {
      if (!confirm('이 기사를 삭제할까요? 홈과 발행호의 연결도 제거됩니다.')) return;
      try { const result = await request(`/admin/articles/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'If-Match': `"${revision}"` } }); content = result.content; revision = result.revision; $('#editor').close(); renderArticles(); notice('기사를 삭제했습니다.'); } catch(e) { notice(e.message, true); }
    };
    $('#editor').showModal();
  }
  function localDateTime(value) { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  function imageEditor(img, key) { return `<div class="image-row" data-image="${key}"><div class="grid">${field('src', '이미지 경로', img.src)}${field('alt', '대체 텍스트', img.alt)}${field('caption', '사진 설명', img.caption)}${field('credit', '사진 출처', img.credit)}</div>${img.src ? `<img src="${esc(img.src.startsWith('/') || img.src.startsWith('https:') ? img.src : `${apiBase.slice(0, -4)}/${img.src}`)}" alt="${esc(img.alt)}" loading="lazy">` : ''}<label>이미지 업로드 (최대 12MB)<input type="file" accept="image/jpeg,image/png,image/webp" data-upload></label>${key !== 'primary' ? '<button type="button" data-remove-image class="secondary">이미지 제거</button>' : ''}</div>`; }
  function getImage(row) { return Object.fromEntries(['src', 'alt', 'caption', 'credit'].map(key => [key, row.querySelector(`[name="${key}"]`).value.trim()])); }
  function bindImages(scope) {
    scope.querySelectorAll('[data-upload]').forEach(input => input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      const row = input.closest('[data-image]'); const alt = row.querySelector('[name=alt]').value.trim();
      if (!alt) { alert('업로드 전에 대체 텍스트를 입력해 주세요.'); input.value = ''; return; }
      if (file.size > 12 * 1024 * 1024) { alert('이미지는 12MB 이하여야 합니다.'); input.value = ''; return; }
      input.disabled = true;
      try { const image = await request('/admin/upload', { method: 'POST', binary: file, headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name), 'X-Alt': encodeURIComponent(alt) } }); row.querySelector('[name=src]').value = image.src; let preview = row.querySelector('img'); if (!preview) { preview = document.createElement('img'); row.prepend(preview); } preview.src = image.src; preview.alt = alt; notice('이미지를 업로드했습니다. 기사 저장을 완료해 주세요.'); } catch(e) { alert(e.message); } finally { input.disabled = false; input.value = ''; }
    });
    scope.querySelectorAll('[data-remove-image]').forEach(b => b.onclick = () => b.closest('[data-image]').remove());
  }
  function captureBlocks() {
    editing.blocks = [...document.querySelectorAll('[data-block]')].map(row => ({ type: row.querySelector('[data-block-type]').value, text: row.querySelector('[data-block-text]').value, images: [...row.querySelectorAll('[data-image]')].map(getImage) }));
  }
  function renderBlocks() {
    $('#blocks').innerHTML = editing.blocks.map((block, index) => `<div class="block" data-block="${index}"><div class="block-head"><strong>블록 ${index + 1}</strong><button type="button" data-up="${index}" class="secondary"${index === 0 ? ' disabled' : ''}>위로</button><button type="button" data-down="${index}" class="secondary"${index === editing.blocks.length - 1 ? ' disabled' : ''}>아래로</button><button type="button" data-remove="${index}" class="secondary">삭제</button></div><label>레이아웃<select data-block-type>${options(types.map(value => ({ value, label: typeNames[value] })), block.type)}</select></label><label>본문 / 인용 / 이미지와 함께 표시할 글<textarea data-block-text>${esc(block.text)}</textarea></label><div data-block-images>${(block.images || []).map((img, i) => imageEditor(img, `${index}-${i}`)).join('')}</div><button type="button" data-add-image="${index}" class="secondary">이미지 추가</button></div>`).join('');
    bindImages($('#blocks'));
    for (const [attribute, delta] of [['data-up', -1], ['data-down', 1]]) document.querySelectorAll(`[${attribute}]`).forEach(b => b.onclick = () => { captureBlocks(); const index = Number(b.getAttribute(attribute)); const moved = editing.blocks.splice(index, 1)[0]; editing.blocks.splice(index + delta, 0, moved); renderBlocks(); });
    document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { captureBlocks(); editing.blocks.splice(Number(b.dataset.remove), 1); renderBlocks(); });
    document.querySelectorAll('[data-add-image]').forEach(b => b.onclick = () => { captureBlocks(); editing.blocks[Number(b.dataset.addImage)].images.push({ src: '', alt: '', caption: '', credit: '' }); renderBlocks(); });
  }
  $('#editor-form').onsubmit = async event => {
    event.preventDefault(); const form = event.currentTarget; const value = name => form.elements.namedItem(name).value.trim();
    captureBlocks();
    for (const key of ['title', 'slug', 'subtitle', 'category', 'author', 'photographer', 'date', 'status', 'issueId', 'secondaryImage']) editing[key] = value(key);
    for (const key of ['tags', 'people', 'places']) editing[key] = value(key).split(',').map(v => v.trim()).filter(Boolean);
    editing.publishAt = value('publishAt') ? new Date(value('publishAt')).toISOString() : null;
    editing.isDemo = form.elements.isDemo.checked; editing.seo = { title: value('seoTitle'), description: value('seoDescription') };
    const primary = getImage(form.querySelector('[data-image=primary]')); editing.primaryImage = primary.src; editing.images = primary.src ? [primary, ...editing.images.slice(1)] : [];
    const next = structuredClone(content); const index = next.articles.findIndex(a => a.id === editing.id); if (index < 0) next.articles.push(editing); else next.articles[index] = editing;
    const save = form.querySelector('[type=submit]'); save.disabled = true;
    try { await commit(next); $('#editor').close(); renderArticles(); } catch(e) { alert(e.message); notice(e.message, true); } finally { save.disabled = false; }
  };
  $('#editor-close').onclick = () => { if (confirm('기사 편집을 닫을까요? 저장하지 않은 변경은 사라집니다.')) $('#editor').close(); };
  function renderIssues() {
    $('#panel').innerHTML = `<h1>발행호 관리</h1><button id="new-issue">새 발행호</button><div id="issue-list">${content.issues.map(i => `<article class="card"><h3>${esc(i.title)}</h3><p>${esc(i.volume)} · ${esc(i.month)} · 기사 ${i.articleIds.length}개${i.isDemo ? ' · 예시 발행호' : ''}</p><button data-edit-issue="${esc(i.id)}">편집</button></article>`).join('')}</div><div id="issue-editor"></div>`;
    $('#new-issue').onclick = () => editIssue(); document.querySelectorAll('[data-edit-issue]').forEach(b => b.onclick = () => editIssue(b.dataset.editIssue));
  }
  function editIssue(id) {
    editedIssue = id ? structuredClone(content.issues.find(i => i.id === id)) : { id: crypto.randomUUID(), volume: '', month: new Date().toISOString().slice(0, 7), title: '', description: '', cover: '', articleIds: [], isDemo: false };
    $('#issue-editor').innerHTML = `<form id="issue-form" class="card"><h2>${id ? '발행호 편집' : '새 발행호'}</h2><div class="grid">${field('title', '발행호 제목', editedIssue.title, 'text', true)}${field('volume', '호수', editedIssue.volume, 'text', true)}${field('month', '발행 월', editedIssue.month, 'month', true)}${field('cover', '표지 이미지 경로', editedIssue.cover)}</div>${area('description', '발행호 설명', editedIssue.description)}<label><input type="checkbox" name="isDemo"${editedIssue.isDemo ? ' checked' : ''}> 예시 발행호</label><h3>수록 기사</h3>${articleChecks('articleIds', editedIssue.articleIds)}<div class="toolbar"><button>저장</button><button type="button" id="cancel-issue" class="secondary">취소</button>${id ? '<button type="button" id="delete-issue" class="danger">발행호 삭제</button>' : ''}</div></form>`;
    $('#issue-form').onsubmit = async e => { e.preventDefault(); const form = e.currentTarget; const updated = { ...editedIssue }; for (const key of ['title', 'volume', 'month', 'cover', 'description']) updated[key] = form.elements[key].value; updated.isDemo = form.elements.isDemo.checked; updated.articleIds = [...form.querySelectorAll('[name=articleIds]:checked')].map(el => el.value); const next = structuredClone(content); const index = next.issues.findIndex(i => i.id === updated.id); if (index < 0) next.issues.push(updated); else next.issues[index] = updated; for (const a of next.articles) { if (updated.articleIds.includes(a.id)) a.issueId = updated.id; else if (a.issueId === updated.id) a.issueId = ''; } try { await commit(next); renderIssues(); } catch(err) { notice(err.message, true); } };
    $('#cancel-issue').onclick = renderIssues;
    if (id) $('#delete-issue').onclick = async () => { if (!confirm('발행호를 삭제할까요? 기사는 남습니다.')) return; const next = structuredClone(content); next.issues = next.issues.filter(i => i.id !== id); for (const a of next.articles) if (a.issueId === id) a.issueId = ''; try { await commit(next); renderIssues(); } catch(err) { notice(err.message, true); } };
    $('#issue-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderSettings() {
    const s = content.settings;
    $('#panel').innerHTML = `<h1>홈 · 사이트 설정</h1><form id="settings-form"><fieldset><legend>기본 정보</legend><div class="grid">${['name', 'englishName', 'tagline', 'email', 'singlePrice', 'annualPrice'].map(key => field(key, ({ name: '매체명', englishName: '영문 매체명', tagline: '소개 문구', email: '문의 이메일', singlePrice: '단권 가격', annualPrice: '연간 구독 가격' })[key], s[key], key === 'email' ? 'email' : 'text', key === 'name')).join('')}</div></fieldset><fieldset><legend>메인 히어로 기사</legend><p class="muted">선택 순서는 기존 기사 목록 순서입니다. 목록 자체의 순서는 기사 관리에서 유지합니다.</p>${articleChecks('heroArticleIds', s.heroArticleIds || [])}</fieldset><fieldset><legend>추천 기사</legend>${articleChecks('featuredArticleIds', s.featuredArticleIds || [])}</fieldset>${area('heroImages', '히어로 이미지 경로 (한 줄에 하나)', (s.heroImages || []).map(v => typeof v === 'string' ? v : v.src).join('\n'))}${field('sectionOrder', '섹션 순서 (카테고리 주소를 쉼표로 구분)', (s.sectionOrder || []).join(', '))}<fieldset><legend>발행 정보</legend><div class="grid">${Object.entries({ publisher: '발행인', editor: '편집인', address: '주소', businessNumber: '사업자등록번호', registrationNumber: '정기간행물 등록번호', issn: 'ISSN', phone: '전화' }).map(([key, label]) => field(`footer_${key}`, label, s.footer?.[key])).join('')}</div></fieldset><fieldset><legend>SNS</legend>${['instagram', 'youtube', 'facebook'].map(key => field(`social_${key}`, key, s.social?.[key], 'url')).join('')}</fieldset><fieldset><legend>카테고리</legend><p class="muted">카테고리 주소는 기존 기사 연결에 사용됩니다. 사용 중인 주소를 바꾸면 저장이 거절됩니다.</p><div id="category-rows">${content.categories.map(c => categoryRow(c)).join('')}</div><button type="button" id="add-category" class="secondary">카테고리 추가</button></fieldset><button>설정 저장</button></form>`;
    $('#add-category').onclick = () => $('#category-rows').insertAdjacentHTML('beforeend', categoryRow({ slug: '', name: '', description: '' }));
    $('#settings-form').addEventListener('click', e => { if (e.target.matches('[data-remove-category]')) e.target.closest('[data-category]').remove(); });
    $('#settings-form').onsubmit = async e => {
      e.preventDefault(); const form = e.currentTarget; const next = structuredClone(content); const set = next.settings;
      for (const key of ['name', 'englishName', 'tagline', 'email', 'singlePrice', 'annualPrice']) set[key] = form.elements[key].value;
      for (const key of ['heroArticleIds', 'featuredArticleIds']) set[key] = [...form.querySelectorAll(`[name=${key}]:checked`)].map(el => el.value);
      set.heroImages = form.elements.heroImages.value.split('\n').map(v => v.trim()).filter(Boolean); set.sectionOrder = form.elements.sectionOrder.value.split(',').map(v => v.trim()).filter(Boolean);
      for (const key of Object.keys(set.footer)) set.footer[key] = form.elements[`footer_${key}`].value;
      for (const key of ['instagram', 'youtube', 'facebook']) set.social[key] = form.elements[`social_${key}`].value;
      next.categories = [...form.querySelectorAll('[data-category]')].map(row => Object.fromEntries(['slug', 'name', 'description'].map(key => [key, row.querySelector(`[name=category_${key}]`).value])));
      try { await commit(next); renderSettings(); } catch(err) { notice(err.message, true); }
    };
  }
  function categoryRow(c) { return `<div class="card" data-category><div class="grid">${field('category_slug', '주소', c.slug, 'text', true)}${field('category_name', '이름', c.name, 'text', true)}${field('category_description', '설명', c.description)}</div><button type="button" data-remove-category class="secondary">카테고리 제거</button></div>`; }
  async function renderInquiries() {
    $('#panel').innerHTML = '<h1>문의 관리</h1><p role="status">문의 불러오는 중…</p>';
    const result = await request(`/admin/inquiries?offset=${offset}&limit=30`);
    if (tab !== 'inquiries') return;
    $('#panel').innerHTML = `<h1>문의 관리</h1><p>총 ${result.total}건 · 개인정보가 포함됩니다. 실제 문의를 공개 저장소에 올리지 마세요.</p><div class="toolbar"><button id="inquiry-refresh" class="secondary">새로 고침</button><button id="previous" class="secondary"${offset === 0 ? ' disabled' : ''}>이전</button><button id="next" class="secondary"${offset + 30 >= result.total ? ' disabled' : ''}>다음</button></div>${result.inquiries.length ? result.inquiries.map(row => `<article class="card"><h3>${esc(row.reference)} <span class="status">${esc(({ personal: '개인 구독', institution: '기관 구독', advertising: '광고', contact: '일반 문의' })[row.type])}</span></h3><p>${esc(new Date(row.created_at).toLocaleString('ko-KR'))} · 알림 ${esc(({ sent: '전송됨', failed: '전송 실패 (문의는 저장됨)', pending: '처리 대기', disabled: '미설정' })[row.notification_status])}</p>${row.notification_error ? `<p class="note">${esc(row.notification_error)}</p>` : ''}<label>처리 상태<select data-inquiry-status="${esc(row.id)}">${options(Object.entries({ new: '신규', reviewing: '검토 중', contacted: '연락 완료', closed: '처리 완료', spam: '스팸' }).map(([value, label]) => ({ value, label })), row.status)}</select></label><details><summary>문의 내용 · 개인정보 보기</summary><dl>${Object.entries(row.payload).map(([key, value]) => `<dt>${esc(({ type: '유형', consent: '개인정보 동의', name: '이름', organization: '기관·회사', department: '부서', phone: '전화', email: '이메일', address: '주소', startMonth: '시작 월', notes: '메모', copies: '부수', duration: '기간', quotation: '견적서', adType: '광고 유형', budget: '예산', message: '내용' })[key] || key)}</dt><dd>${esc(typeof value === 'boolean' ? (value ? '예' : '아니오') : value)}</dd>`).join('')}</dl></details><button type="button" data-delete-inquiry="${esc(row.id)}" class="danger">문의 영구 삭제</button></article>`).join('') : '<div class="empty">접수된 문의가 없습니다.</div>'}`;
    $('#previous').onclick = () => { offset = Math.max(0, offset - 30); renderInquiries().catch(e => notice(e.message, true)); }; $('#next').onclick = () => { offset += 30; renderInquiries().catch(e => notice(e.message, true)); }; $('#inquiry-refresh').onclick = () => renderInquiries().catch(e => notice(e.message, true));
    document.querySelectorAll('[data-delete-inquiry]').forEach(button => button.onclick = async () => { if (!confirm('개인정보를 포함한 문의를 영구 삭제할까요? 기존 백업은 별도 삭제해야 합니다.')) return; try { await request('/admin/inquiries/' + button.dataset.deleteInquiry, { method: 'DELETE' }); await renderInquiries(); notice('문의를 삭제했습니다.'); } catch(e) { notice(e.message, true); } });
    document.querySelectorAll('[data-inquiry-status]').forEach(select => select.onchange = async () => { select.disabled = true; try { await request(`/admin/inquiries/${select.dataset.inquiryStatus}`, { method: 'PATCH', data: { status: select.value } }); notice('문의 처리 상태를 저장했습니다.'); } catch(e) { notice(e.message, true); await renderInquiries(); } finally { select.disabled = false; } });
  }
  function renderExports() { $('#panel').innerHTML = `<section id="exports"><h1>내보내기</h1><div class="card"><h2>공개 콘텐츠 JSON</h2><p>공개 기사와 발행 시각이 지난 예약 기사만 포함됩니다. 문의·초안은 제외됩니다. WordPress 이관 및 정적 빌드에 사용할 수 있습니다.</p><a class="button" href="${apiBase}/admin/export/content" download>공개 콘텐츠 다운로드</a></div><div class="card"><h2>비공개 백업</h2><p>모든 초안과 문의 개인정보를 포함합니다. 관리자 로그인 상태에서만 내려받을 수 있습니다. 안전한 비공개 저장소에 보관하세요.</p><a class="button" href="${apiBase}/admin/export/private" download>비공개 백업 다운로드</a><p class="muted">이미지 파일은 JSON에 포함되지 않습니다. 서버 DATA_DIR/uploads와 원본 public/images도 별도로 백업하세요. 관리자 비밀번호와 세션은 백업에서 제외됩니다.</p></div></section>`; }
  $('#login-form').onsubmit = async e => { e.preventDefault(); const form = e.currentTarget; const button = form.querySelector('button'); button.disabled = true; try { const session = await request('/admin/session', { method: 'POST', data: { email: form.elements.email.value.trim(), password: form.elements.password.value } }); form.elements.password.value = ''; await ready(session); notice(); } catch(err) { notice(err.message, true); } finally { button.disabled = false; } };
  $('#logout').onclick = async () => { try { await request('/admin/session', { method: 'DELETE' }); showLogin(); notice('로그아웃했습니다.'); } catch(e) { notice(e.message, true); } };
  document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { tab = button.dataset.tab; notice(); renderTab(); });
  request('/admin/session').then(ready).catch(() => showLogin());
})();
