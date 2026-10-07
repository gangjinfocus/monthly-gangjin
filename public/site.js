(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const focusable = root => $$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',root).filter(el => !el.hidden && el.getClientRects().length > 0);
  const announce = message => { const node = $('.global-status'); if (node) node.textContent = message; };

  // Reveal content only after the observer is ready; absence of JS never hides it.
  if ('IntersectionObserver' in window && !reduced.matches) {
    document.documentElement.classList.add('js');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
    }),{rootMargin:'0px 0px -35px 0px',threshold:0.05});
    $$('[data-reveal]').forEach(node => observer.observe(node));
  }
  const menu = $('#mobile-menu');
  const menuToggle = $('.menu-toggle');
  let menuReturn = null;
  const menuInert = new Map();
  const closeMenu = () => {
    if (!menu || menu.hidden) return;
    menu.hidden = true; menuToggle?.setAttribute('aria-expanded','false');
    menuInert.forEach((wasInert,node) => { node.inert = wasInert; }); menuInert.clear();
    document.body.classList.remove('locked');
    menuReturn?.focus();
  };
  menuToggle?.addEventListener('click',() => {
    if (!menu) return;
    if (!menu.hidden) return closeMenu();
    menuReturn = document.activeElement; menu.hidden = false;
    menuToggle.setAttribute('aria-expanded','true'); document.body.classList.add('locked');
    $$('.site-header,main,.site-footer').forEach(node => { menuInert.set(node,node.inert); node.inert = true; });
    $('.menu-close',menu)?.focus();
  });
  $('.menu-close',menu || document)?.addEventListener('click',closeMenu);
  menu?.addEventListener('keydown',event => {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); }
    if (event.key === 'Tab') {
      const nodes = focusable(menu), first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });

  const carousel = $('[data-carousel]');
  if (carousel) {
    let heroVisible = true, parallaxFrame = null;
    const updateParallax = () => {
      parallaxFrame = null;
      if (reduced.matches) { carousel.style.setProperty('--hero-parallax','0px'); return; }
      const bounds = carousel.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
      const shift = Math.max(0,Math.min(36,-bounds.top * 0.08));
      carousel.style.setProperty('--hero-parallax',`${shift.toFixed(2)}px`);
    };
    const scheduleParallax = () => { if (heroVisible && !reduced.matches && parallaxFrame === null) parallaxFrame = window.requestAnimationFrame(updateParallax); };
    if ('IntersectionObserver' in window) {
      const heroObserver = new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; if (heroVisible) scheduleParallax(); });
      heroObserver.observe(carousel);
    }
    window.addEventListener('scroll',scheduleParallax,{passive:true});
    window.addEventListener('resize',scheduleParallax,{passive:true});
    reduced.addEventListener('change',() => { window.cancelAnimationFrame(parallaxFrame); parallaxFrame = null; updateParallax(); });
    scheduleParallax();
    const slides = $$('[data-slide]',carousel), pause = $('[data-slide-pause]',carousel);
    let current = 0, timer = null, manualPause = false, hoverPause = false, focusPause = false;
    const syncTimer = () => {
      window.clearInterval(timer); timer = null;
      const paused = manualPause || reduced.matches;
      if (!paused && !hoverPause && !focusPause && !document.hidden && slides.length > 1) timer = window.setInterval(() => show(current + 1),8500);
      pause?.setAttribute('aria-pressed',String(paused));
      pause?.setAttribute('aria-label',reduced.matches ? '동작 줄이기 설정으로 자동 전환 정지' : paused ? '자동 전환 재생' : '자동 전환 일시 정지');
      if (pause) { pause.textContent = paused ? '▶' : 'Ⅱ'; pause.disabled = reduced.matches || slides.length < 2; }
    };
    const show = index => {
      if (!slides.length) return;
      current = (index + slides.length) % slides.length;
      slides.forEach((slide,i) => {
        slide.classList.toggle('is-active',i === current); slide.setAttribute('aria-hidden',String(i !== current));
        $$('a',slide).forEach(link => { link.tabIndex = i === current ? 0 : -1; });
      });
      const count = $('[data-slide-current]',carousel); if (count) count.textContent = String(current + 1).padStart(2,'0');
    };
    $('[data-slide-prev]',carousel)?.addEventListener('click',() => { show(current - 1); syncTimer(); });
    $('[data-slide-next]',carousel)?.addEventListener('click',() => { show(current + 1); syncTimer(); });
    pause?.addEventListener('click',() => { manualPause = !manualPause; syncTimer(); });
    carousel.addEventListener('mouseenter',() => { hoverPause = true; syncTimer(); });
    carousel.addEventListener('mouseleave',() => { hoverPause = false; syncTimer(); });
    carousel.addEventListener('focusin',() => { focusPause = true; syncTimer(); });
    carousel.addEventListener('focusout',event => { if (!carousel.contains(event.relatedTarget)) { focusPause = false; syncTimer(); } });
    carousel.addEventListener('keydown',event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); show(current + (event.key === 'ArrowLeft' ? -1 : 1)); syncTimer(); }
    });
    document.addEventListener('visibilitychange',syncTimer);
    reduced.addEventListener('change',syncTimer);
    show(0); syncTimer();
    if (slides.length < 2) $$('.carousel-controls button',carousel).forEach(button => { button.disabled = true; });
  }
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches && !reduced.matches) {
    $$('.card-photo').forEach(photo => {
      let frame = null;
      photo.addEventListener('pointermove',event => {
        if (window.innerWidth <= 700 || reduced.matches) return;
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          const box = photo.getBoundingClientRect();
          photo.style.setProperty('--tilt-y',`${((event.clientX-box.left)/box.width-.5)*2.2}deg`);
          photo.style.setProperty('--tilt-x',`${(.5-(event.clientY-box.top)/box.height)*2.2}deg`);
        });
      });
      photo.addEventListener('pointerleave',() => { window.cancelAnimationFrame(frame); photo.style.removeProperty('--tilt-x'); photo.style.removeProperty('--tilt-y'); });
    });
  }

  const gallery = $('.gallery-dialog');
  const triggers = $$('.gallery-trigger[data-gallery-src]').filter(node => node.dataset.gallerySrc);
  if (gallery && triggers.length) {
    let current = 0, returnFocus = null, startX = 0, startY = 0;
    const show = index => {
      current = (index + triggers.length) % triggers.length;
      const trigger = triggers[current], image = $('[data-gallery-image]',gallery);
      image.src = trigger.dataset.gallerySrc; image.alt = trigger.dataset.galleryAlt || '';
      $('[data-gallery-caption]',gallery).textContent = trigger.dataset.galleryCaption || '';
      $('[data-gallery-number]',gallery).textContent = `${String(current+1).padStart(2,'0')} / ${String(triggers.length).padStart(2,'0')}`;
      $$('[data-gallery-prev],[data-gallery-next]',gallery).forEach(button => { button.hidden = triggers.length < 2; });
    };
    const close = () => { if (gallery.open) gallery.close(); };
    triggers.forEach((trigger,index) => trigger.addEventListener('click',() => {
      returnFocus = trigger; show(index); gallery.showModal(); document.body.classList.add('locked'); $('[data-gallery-close]',gallery).focus();
    }));
    $('[data-gallery-close]',gallery)?.addEventListener('click',close);
    $('[data-gallery-prev]',gallery)?.addEventListener('click',() => show(current-1));
    $('[data-gallery-next]',gallery)?.addEventListener('click',() => show(current+1));
    gallery.addEventListener('close',() => { document.body.classList.remove('locked'); returnFocus?.focus(); });
    gallery.addEventListener('click',event => { if (event.target === gallery) close(); });
    gallery.addEventListener('keydown',event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); show(current + (event.key === 'ArrowLeft' ? -1 : 1)); }
      if (event.key === 'Tab') {
        const nodes = focusable(gallery), first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    gallery.addEventListener('touchstart',event => { startX = event.changedTouches[0].clientX; startY = event.changedTouches[0].clientY; },{passive:true});
    gallery.addEventListener('touchend',event => {
      const dx = event.changedTouches[0].clientX-startX, dy = event.changedTouches[0].clientY-startY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)*1.3) show(current+(dx < 0 ? 1 : -1));
    },{passive:true});
  }
  const copyLink = async () => {
    const url = $('link[rel="canonical"]')?.href || window.location.href;
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); return; }
    const node = document.createElement('textarea'); node.value = url; node.style.position = 'fixed'; node.style.top = '-9999px'; document.body.append(node); node.select();
    const ok = document.execCommand('copy'); node.remove(); if (!ok) throw new Error('복사할 수 없습니다. 주소창의 링크를 복사해 주세요.');
  };
  $$('[data-share]').forEach(button => button.addEventListener('click',async () => {
    const status = $('[data-share-status]');
    try {
      const url = $('link[rel="canonical"]')?.href || window.location.href;
      if (button.dataset.share === 'native' && navigator.share) { await navigator.share({title:button.dataset.title || document.title,url}); if (status) status.textContent = '공유 창을 열었습니다.'; }
      else { await copyLink(); if (status) status.textContent = '이야기 링크를 복사했습니다.'; }
    } catch (error) { if (error.name !== 'AbortError' && status) status.textContent = error.message || '공유할 수 없습니다. 주소창의 링크를 복사해 주세요.'; }
  }));

  const search = $('[data-search]');
  if (search) {
    const input = $('input[name="q"]',search), items = $$('[data-search-item]');
    let filter = 'all', debounce = null;
    const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase('ko-KR').trim();
    const update = (updateUrl = true) => {
      const query = normalize(input.value), terms = query.split(/\s+/).filter(Boolean);
      let count = 0;
      items.forEach(item => {
        const matches = (filter === 'all' || item.dataset.category === filter) && terms.every(term => normalize(item.dataset.keywords).includes(term));
        item.hidden = !matches; if (matches) { count++; $$('[data-reveal]',item).forEach(n => n.classList.add('revealed')); }
      });
      $('[data-search-count]').textContent = query ? `“${input.value.trim()}” 검색 결과 ${count}편` : `이야기 ${count}편`;
      $('[data-search-empty]').hidden = count > 0;
      $$('[data-filter]').forEach(button => { const active = button.dataset.filter === filter; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)); });
      if (updateUrl) { const url = new URL(window.location.href); if (input.value.trim()) url.searchParams.set('q',input.value.trim()); else url.searchParams.delete('q'); if (filter !== 'all') url.searchParams.set('category',filter); else url.searchParams.delete('category'); history.replaceState(null,'',url); }
    };
    const params = new URLSearchParams(window.location.search); input.value = (params.get('q') || '').slice(0,100);
    const initialFilter = params.get('category'); if ($$('[data-filter]').some(button => button.dataset.filter === initialFilter)) filter = initialFilter;
    search.addEventListener('submit',event => { event.preventDefault(); update(); });
    input.addEventListener('input',() => { window.clearTimeout(debounce); debounce = window.setTimeout(update,180); });
    $$('[data-filter]').forEach(button => button.addEventListener('click',() => { filter = button.dataset.filter; update(); }));
    $('[data-search-reset]')?.addEventListener('click',() => { input.value = ''; filter = 'all'; update(); input.focus(); });
    update(false);
  }

  const uuid = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes,n => n.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  };
  $$('[data-inquiry]').forEach(form => {
    const status = $('[data-form-status]',form), submit = $('button[type="submit"]',form), label = $('span',submit);
    const originalLabel = label?.textContent || submit.textContent;
    const startedAt = Date.now();
    const idempotencyKey = uuid();
    let pending = false, completed = false;
    const display = (text,type = '') => { status.textContent = text; status.className = `form-status ${type}`; };
    form.addEventListener('submit',async event => {
      event.preventDefault();
      if (pending || completed || !form.reportValidity()) return;
      const fields = new FormData(form), payload = {type:form.dataset.inquiry,startedAt,idempotencyKey};
      for (const [name,value] of fields.entries()) payload[name] = typeof value === 'string' ? value.trim() : value;
      payload.consent = fields.get('consent') === 'on'; payload.website = fields.get('website') || '';
      if (payload.type === 'institution') { payload.copies = Number(payload.copies); payload.quotation = fields.get('quotation') === 'on'; }
      if (document.body.dataset.mode !== 'live') {
        display('현재 정적 미리보기이므로 신청 내용은 전송되거나 저장되지 않았습니다. 아래 링크로 메일 앱을 열어 직접 보내주세요.');
        const mail = document.createElement('a'), labels = {personal:'정기 구독 문의',institution:'기관 구독 문의',advertising:'광고·협업 문의',contact:'편집부 문의'};
        const fieldLabels = {name:'이름',phone:'연락처',email:'이메일',address:'주소',startMonth:'시작 희망 월',notes:'요청 사항',organization:'기관·회사',department:'부서',copies:'부수',duration:'구독 기간(개월)',quotation:'견적서 요청',adType:'광고 유형',budget:'예산',message:'문의 내용'};
        const text = Object.entries(payload).filter(([key]) => fieldLabels[key]).map(([key,val]) => `${fieldLabels[key]}: ${typeof val === 'boolean' ? val ? '예' : '아니오' : val}`).join('\n');
        const mailBody = `${labels[payload.type]}\n\n${text}\n\n개인정보 수집·이용 동의: 예`;
        mail.href = `mailto:${form.dataset.contactEmail}?subject=${encodeURIComponent(`[월간 강진] ${labels[payload.type]}`)}&body=${encodeURIComponent(mailBody)}`;
        mail.textContent = '메일 앱에서 문의 내용 확인 후 보내기 ↗'; status.append(document.createElement('br'),mail);
        return;
      }
      pending = true; submit.disabled = true; form.setAttribute('aria-busy','true'); if (label) label.textContent = '보내는 중…'; display('신청 내용을 전송하고 있습니다.');
      const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(),20000);
      try {
        const api = (document.body.dataset.apiBase || '/api').replace(/\/$/,'');
        const response = await fetch(`${api}/inquiries`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',body:JSON.stringify(payload),signal:controller.signal});
        let data; try { data = await response.json(); } catch { throw new Error('서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도하거나 편집부에 문의해 주세요.'); }
        if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : '접수하지 못했습니다. 입력 내용을 확인해 주세요.');
        if (!data.id || !data.reference || typeof data.message !== 'string') throw new Error('접수 확인 정보가 없습니다. 중복 전송 전에 편집부에 문의해 주세요.');
        completed = true; display(`${data.message} 접수 번호: ${data.reference}`,'success'); if (label) label.textContent = '접수 완료';
        $$('input,select,textarea',form).forEach(input => { input.disabled = true; }); announce('신청 내용이 접수되었습니다.');
      } catch (error) {
        display(error.name === 'AbortError' ? '응답 시간이 초과되었습니다. 접수 여부가 확인되지 않았습니다. 다시 시도하면 같은 접수 번호로 처리하거나 편집부에 문의해 주세요.' : error.message,'error');
        // Keep the same key when retrying a lost response so the server can prevent duplicates.
      } finally {
        window.clearTimeout(timeout); pending = false; form.removeAttribute('aria-busy'); submit.disabled = completed;
        if (!completed && label) label.textContent = originalLabel;
      }
    });
  });
})();
