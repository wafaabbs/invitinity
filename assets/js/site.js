/* Invitinity home page: hero slider, collection rail + signature slider
   (CMS portfolio), articles, Instagram tiles, modal, forms. */
(() => {
  const { sb, $, $$, esc, pick, ui, fmtDate, media, design, waLink, reveal, onLang } = INV;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Hero slider ---------- */
  const hero = $('#hero');
  const slides = $$('.slide', hero);
  const dots = $('#heroDots');
  let current = 0, timer = null;
  dots.innerHTML = slides.map((_, i) => `<button type="button" aria-label="Slide ${i + 1}"></button>`).join('');
  function go(i) {
    current = (i + slides.length) % slides.length;
    slides.forEach((s, k) => { s.classList.toggle('is-active', k === current); s.setAttribute('aria-hidden', String(k !== current)); });
    $$('button', dots).forEach((d, k) => d.setAttribute('aria-current', String(k === current)));
    hero.classList.toggle('on-dark', slides[current].dataset.tone === 'dark');
  }
  const play = () => { if (!reduceMotion) { clearInterval(timer); timer = setInterval(() => go(current + 1), 6500); } };
  $$('[data-slide]', hero).forEach(b => b.addEventListener('click', () => { go(current + Number(b.dataset.slide)); play(); }));
  $$('button', dots).forEach((d, k) => d.addEventListener('click', () => { go(k); play(); }));
  hero.addEventListener('mouseenter', () => clearInterval(timer));
  hero.addEventListener('mouseleave', play);
  go(0); play();

  /* ---------- Portfolio data ---------- */
  let works = [];
  async function loadWorks() {
    if (sb) {
      const { data, error } = await sb.from('portfolio').select('*').eq('published', true).order('sort_order', { ascending: true });
      if (!error) return data;
      console.info('Portfolio: using built-in samples (', error.message, ')');
    }
    return window.DEFAULT_PORTFOLIO;
  }
  const labelFor = (c) => $(`#filters [data-filter="${c}"]`)?.textContent || c;

  /* ---------- Collection rail ---------- */
  const rail = $('#works');
  let filter = 'all';
  function renderRail() {
    const list = works.filter(w => filter === 'all' || (w.categories || []).includes(filter));
    rail.innerHTML = list.length ? list.map(w => `
      <article class="work" tabindex="0" role="button" data-slug="${esc(w.slug)}" aria-label="${esc(pick(w.title))}">
        <div class="work__media">${media(w)}<span class="work__quick">${esc(ui('view'))}</span></div>
        <h3>${esc(pick(w.title))}</h3>
        <small>${esc((w.categories || []).map(labelFor).join(' · '))}</small>
      </article>`).join('') : `<p class="empty">${esc(ui('noWorks'))}</p>`;
    rail.scrollLeft = 0;
    updateRailButtons();
  }
  function updateRailButtons() {
    const max = rail.scrollWidth - rail.clientWidth - 2;
    $('.rail-btn.prev', rail.parentElement).disabled = rail.scrollLeft <= 2;
    $('.rail-btn.next', rail.parentElement).disabled = rail.scrollLeft >= max;
  }
  rail.addEventListener('scroll', updateRailButtons, { passive: true });
  addEventListener('resize', updateRailButtons);
  $$('[data-rail]').forEach(b => b.addEventListener('click', () => {
    const card = rail.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 20 : rail.clientWidth;
    rail.scrollBy({ left: Number(b.dataset.rail) * step, behavior: reduceMotion ? 'auto' : 'smooth' });
  }));
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.filter'); if (!b) return;
    filter = b.dataset.filter;
    $$('#filters .filter').forEach(x => x.classList.toggle('is-active', x === b));
    renderRail();
  });

  /* ---------- Signature (single-item slider of luxury pieces) ---------- */
  const stage = $('#soloStage');
  let soloIdx = 0;
  function soloItems() {
    const lux = works.filter(w => (w.categories || []).includes('luxury'));
    return lux.length ? lux : works;
  }
  function renderSolo() {
    const items = soloItems();
    soloIdx = Math.min(soloIdx, Math.max(0, items.length - 1));
    stage.innerHTML = items.map((w, i) => `
      <div class="work ${i === soloIdx ? 'is-active' : ''}" data-slug="${esc(w.slug)}" role="button" tabindex="${i === soloIdx ? 0 : -1}" aria-label="${esc(pick(w.title))}">
        <div class="work__media">${media(w)}<span class="work__quick">${esc(ui('view'))}</span></div>
        <h3>${esc(pick(w.title))}</h3>
        <small>${esc((w.categories || []).map(labelFor).join(' · '))}</small>
      </div>`).join('');
  }
  $$('[data-solo]').forEach(b => b.addEventListener('click', () => {
    const n = soloItems().length; if (!n) return;
    soloIdx = (soloIdx + Number(b.dataset.solo) + n) % n;
    $$('.work', stage).forEach((el, i) => { el.classList.toggle('is-active', i === soloIdx); el.tabIndex = i === soloIdx ? 0 : -1; });
  }));

  /* ---------- Modal ---------- */
  const modal = $('#modal');
  let lastFocus = null, openSlug = null;
  function fillModal(w) {
    $('#modalMedia').innerHTML = `<div>${media(w)}</div>`;
    $('#modalTags').innerHTML = (w.categories || []).map(c => `<span>${esc(labelFor(c))}</span>`).join('');
    $('#modalTitle').textContent = pick(w.title);
    $('#modalDesc').textContent = pick(w.description);
    $('#modalList').innerHTML = (pick(w.features) || []).map(f => `<li>${esc(f)}</li>`).join('');
    const demo = w.demo_url ? `<a class="btn btn--outline" href="${esc(w.demo_url)}" target="_blank" rel="noopener">${esc(ui('liveDemo'))}</a>` : '';
    $('#modalActions').innerHTML = `<a class="btn" href="${esc(waLink(ui('wa.design', { title: pick(w.title) })))}" target="_blank" rel="noopener">${esc(ui('useDesign'))}</a>${demo}`;
  }
  function openModal(slug) {
    const w = works.find(x => x.slug === slug); if (!w) return;
    lastFocus = document.activeElement; openSlug = slug;
    fillModal(w);
    modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('.modal__close', modal).focus();
  }
  function closeModal() {
    modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; openSlug = null;
    lastFocus?.focus();
  }
  [rail, stage].forEach(el => {
    el.addEventListener('click', e => { const w = e.target.closest('.work'); if (w) openModal(w.dataset.slug); });
    el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.work')) { e.preventDefault(); openModal(e.target.dataset.slug); } });
  });
  $$('[data-close]', modal).forEach(el => el.addEventListener('click', closeModal));
  addEventListener('keydown', e => { if (e.key === 'Escape' && openSlug) closeModal(); });

  /* ---------- Articles (stories) ---------- */
  let posts = null;
  const postEl = $('#postList');
  async function loadPosts() {
    if (!sb) return [];
    const { data, error } = await sb.from('articles').select('slug,title,excerpt,cover_url,published_at')
      .eq('published', true).order('published_at', { ascending: false }).limit(3);
    return error ? [] : data;
  }
  function renderPosts() {
    if (!posts) return;
    postEl.innerHTML = posts.length ? posts.map(INV.postCard).join('') : `<p class="empty">${esc(ui('noArticles'))}</p>`;
    reveal(postEl);
  }

  /* ---------- Instagram tiles ---------- */
  const IG_BG = ['#f8eef3', '#701c45', '#ffffff', '#e3bfd0', '#f1dde7', '#4a1230'];
  function renderIg() {
    const pool = works.length ? works : window.DEFAULT_PORTFOLIO;
    $('#igGrid').innerHTML = IG_BG.map((bg, i) => {
      const w = pool[i % pool.length];
      return `<a class="ig-tile" data-ig-link href="https://www.instagram.com/${encodeURIComponent((INV.settings.instagram || 'invitinity').replace(/^@/, ''))}" target="_blank" rel="noopener" aria-label="Instagram" style="background:radial-gradient(70% 70% at 50% 40%, ${bg}, color-mix(in srgb, ${bg} 75%, #000))">
        <div class="mini" style="transform:rotate(${i % 2 ? 4 : -4}deg)">${w.image_url ? `<img src="${esc(w.image_url)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">` : design(w)}</div></a>`;
    }).join('');
  }

  /* ---------- Forms ---------- */
  $$('[data-package]').forEach(a => a.addEventListener('click', () => { $('#briefPackage').value = a.dataset.package; }));
  $$('[data-event]').forEach(a => a.addEventListener('click', () => { $('#briefEvent').value = a.dataset.event; }));

  $('#briefForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const name = f.name.value.trim();
    if (!name) { f.name.setCustomValidity(ui('nameRequired')); f.name.reportValidity(); f.name.setCustomValidity(''); return; }
    const pkg = f.package.value === '?' ? f.package.selectedOptions[0].textContent : f.package.value;
    const msg = ui('wa.brief', {
      name, event: f.event.selectedOptions[0].textContent,
      date: f.date.value ? fmtDate(f.date.value) : ui('tbd'),
      domain: f.domain.value.trim() || '-', package: pkg,
    });
    window.open(waLink(msg), '_blank', 'noopener');
  });

  $('#newsletter').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.elements.email, msg = $('#newsletterMsg');
    const email = input.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { input.setCustomValidity(ui('subInvalid')); input.reportValidity(); input.setCustomValidity(''); return; }
    if (!sb) { msg.textContent = ui('subErr'); return; }
    const { error } = await sb.from('subscribers').insert({ email, lang: INV.lang });
    msg.textContent = !error ? ui('subOk') : error.code === '23505' ? ui('subDup') : ui('subErr');
    if (!error) input.value = '';
  });

  /* ---------- Boot ---------- */
  INV.init();
  onLang(() => {
    renderRail(); renderSolo(); renderPosts();
    if (openSlug) fillModal(works.find(x => x.slug === openSlug));
  });
  loadWorks().then(d => { works = d || []; renderRail(); renderSolo(); renderIg(); });
  loadPosts().then(d => { posts = d; renderPosts(); });
})();
