/* Invitinity home page: portfolio + articles from the CMS, modal, brief form. */
(() => {
  const { sb, $, $$, esc, pick, ui, fmtDate, media, waLink, reveal, onLang } = INV;

  /* ---------- Portfolio ---------- */
  let works = [];
  let filter = 'all';
  const worksEl = $('#works');

  async function loadWorks() {
    if (sb) {
      const { data, error } = await sb.from('portfolio').select('*').eq('published', true).order('sort_order', { ascending: true });
      if (!error) return data;
      console.info('Portfolio: using built-in samples (', error.message, ')');
    }
    return window.DEFAULT_PORTFOLIO;
  }

  function renderWorks() {
    const list = works.filter(w => filter === 'all' || (w.categories || []).includes(filter));
    if (!list.length) { worksEl.innerHTML = `<p class="empty">${esc(ui('noWorks'))}</p>`; return; }
    worksEl.innerHTML = list.map(w => `
      <article class="work" tabindex="0" role="button" data-slug="${esc(w.slug)}" data-reveal aria-label="${esc(pick(w.title))}">
        <div class="work__media">${media(w)}<span class="work__view">${esc(ui('view'))}</span></div>
        <div class="work__meta"><h3>${esc(pick(w.title))}</h3><small>${esc((w.categories || []).map(c => labelFor(c)).join(' · '))}</small></div>
      </article>`).join('');
    reveal(worksEl);
  }
  const labelFor = (c) => $(`#filters [data-filter="${c}"]`)?.textContent || c;

  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.filter'); if (!b) return;
    filter = b.dataset.filter;
    $$('#filters .filter').forEach(x => x.classList.toggle('is-active', x === b));
    renderWorks();
  });

  /* ---------- Modal ---------- */
  const modal = $('#modal');
  let lastFocus = null, openSlug = null;
  function fillModal(w) {
    $('#modalMedia').innerHTML = `<div>${media(w)}</div>`;
    $('#modalTags').innerHTML = (w.categories || []).map(c => `<span>${esc(labelFor(c))}</span>`).join('');
    $('#modalTitle').textContent = pick(w.title);
    $('#modalDesc').textContent = pick(w.description);
    $('#modalList').innerHTML = (pick(w.features) || []).map(f => `<li>${esc(f)}</li>`).join('');
    const demo = w.demo_url ? `<a class="btn btn--ghost" href="${esc(w.demo_url)}" target="_blank" rel="noopener">${esc(ui('liveDemo'))}</a>` : '';
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
  worksEl.addEventListener('click', e => { const w = e.target.closest('.work'); if (w) openModal(w.dataset.slug); });
  worksEl.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.work')) { e.preventDefault(); openModal(e.target.dataset.slug); } });
  $$('[data-close]', modal).forEach(el => el.addEventListener('click', closeModal));
  addEventListener('keydown', e => { if (e.key === 'Escape' && openSlug) closeModal(); });

  /* ---------- Articles ---------- */
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
    if (!posts.length) { postEl.innerHTML = `<p class="empty">${esc(ui('noArticles'))}</p>`; return; }
    postEl.innerHTML = posts.map(INV.postCard).join('');
    reveal(postEl);
  }

  /* ---------- Brief form → WhatsApp ---------- */
  $$('[data-package]').forEach(a => a.addEventListener('click', () => { $('#briefPackage').value = a.dataset.package; }));
  $('#briefForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const name = f.name.value.trim();
    if (!name) { f.name.focus(); f.name.setCustomValidity(ui('nameRequired')); f.name.reportValidity(); f.name.setCustomValidity(''); return; }
    const pkg = f.package.value === '?' ? f.package.selectedOptions[0].textContent : f.package.value;
    const msg = ui('wa.brief', {
      name, event: f.event.selectedOptions[0].textContent,
      date: f.date.value ? fmtDate(f.date.value) : ui('tbd'),
      domain: f.domain.value.trim() || '-', package: pkg,
    });
    window.open(waLink(msg), '_blank', 'noopener');
  });

  /* ---------- Boot ---------- */
  INV.init();
  onLang(() => {
    renderWorks(); renderPosts();
    if (openSlug) fillModal(works.find(x => x.slug === openSlug));
  });
  loadWorks().then(d => { works = d || []; renderWorks(); });
  loadPosts().then(d => { posts = d; renderPosts(); });
})();
