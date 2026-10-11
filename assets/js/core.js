/* Invitinity core — shared by index.html and article.html.
   Language switching, CMS settings (font, accent, contacts, sections),
   Supabase client, and small helpers. Exposes window.INV. */
window.INV = (() => {
  const cfg = window.INVITINITY_CONFIG || {};
  const LANGS = ['id', 'en', 'ms'];
  const LOCALES = { id: 'id-ID', en: 'en-GB', ms: 'ms-MY' };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };

  let sb = null;
  try {
    if (cfg.supabaseUrl && cfg.supabaseKey && window.supabase) sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  } catch (e) { console.warn('Supabase init failed', e); }

  /* ---------- Language ---------- */
  const urlLang = new URLSearchParams(location.search).get('lang');
  let lang = [urlLang, store.get('inv_lang'), (navigator.language || '').slice(0, 2)].find(l => LANGS.includes(l)) || cfg.defaultLang || 'id';

  // Indonesian source text is captured from the DOM so it never has to be duplicated.
  const base = new Map();       // element -> original Indonesian HTML/text
  const baseAttr = new Map();   // element -> { attr: original value }
  const usesText = el => el.tagName === 'TITLE' || el.tagName === 'OPTION';
  function capture(root = document) {
    $$('[data-i18n]', root).forEach(el => { if (!base.has(el)) base.set(el, usesText(el) ? el.textContent : el.innerHTML); });
    $$('[data-i18n-attr]', root).forEach(el => {
      if (baseAttr.has(el)) return;
      const orig = {};
      el.dataset.i18nAttr.split(';').forEach(pair => { const [attr] = pair.split(':'); orig[attr] = el.getAttribute(attr) || ''; });
      baseAttr.set(el, orig);
    });
  }
  function tr(key, fallback) { return lang === 'id' ? fallback : (window.I18N?.[lang]?.[key] ?? fallback); }
  function applyStatic() {
    base.forEach((orig, el) => {
      const v = tr(el.dataset.i18n, orig);
      if (usesText(el)) el.textContent = v; else el.innerHTML = v;
    });
    baseAttr.forEach((orig, el) => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':');
        el.setAttribute(attr, tr(key, orig[attr]));
      });
    });
  }
  const listeners = [];
  function setLang(l, { persist = true } = {}) {
    if (!LANGS.includes(l)) return;
    lang = l;
    if (persist) store.set('inv_lang', l);
    document.documentElement.lang = l;
    applyStatic();
    applySettingsText();
    $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    $$('[data-lang-current]').forEach(el => { el.textContent = l.toUpperCase(); });
    refreshWaLinks();
    listeners.forEach(fn => fn(l));
  }
  const onLang = fn => listeners.push(fn);
  const ui = (key, vars = {}) => {
    const s = window.I18N_UI?.[lang]?.[key] ?? window.I18N_UI?.id?.[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  };
  // Pick the right language from a {id,en,ms} object (CMS content).
  const pick = (v) => {
    if (v == null) return '';
    if (typeof v !== 'object' || Array.isArray(v)) return v;
    return v[lang] || v.id || v.en || v.ms || '';
  };
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };

  /* ---------- Settings (from CMS) ---------- */
  let settings = structuredClone(window.DEFAULT_SETTINGS);
  const merge = (s) => ({ ...window.DEFAULT_SETTINGS, ...s, sections: { ...window.DEFAULT_SETTINGS.sections, ...(s?.sections || {}) } });

  function applyFont(key) {
    const p = window.FONT_PRESETS[key] || window.FONT_PRESETS.system;
    const root = document.documentElement.style;
    root.setProperty('--font-serif', p.serif);
    root.setProperty('--font-sans', p.sans);
    const link = $('#fontLink');
    if (link && !p.href) link.removeAttribute('href');
    else if (link && link.href !== p.href) link.href = p.href;
  }
  function applySettings() {
    applyFont(settings.font);
    if (/^#[0-9a-f]{6}$/i.test(settings.accent || '')) document.documentElement.style.setProperty('--accent', settings.accent);
    Object.entries(settings.sections).forEach(([name, on]) => {
      $$(`[data-section="${name}"], [data-section-link="${name}"]`).forEach(el => { el.hidden = !on; });
    });
    const ig = (settings.instagram || 'invitinity').replace(/^@/, '');
    $$('[data-ig-link]').forEach(a => {
      a.href = `https://www.instagram.com/${encodeURIComponent(ig)}`;
      if (a.classList.contains('handle')) a.textContent = '@' + ig;
    });
    applySettingsText();
    refreshWaLinks();
    applyComingSoon();
  }
  function applySettingsText() {
    const t = settings.hero_title?.[lang], d = settings.hero_subtitle?.[lang];
    if (t && $('#heroTitle')) $('#heroTitle').textContent = t;
    if (d && $('#heroDesc')) $('#heroDesc').textContent = d;
  }
  async function loadSettings() {
    const cached = store.get('inv_settings');
    if (cached) { try { settings = merge(JSON.parse(cached)); applySettings(); } catch { /* ignore bad cache */ } }
    if (!sb) { document.documentElement.classList.remove('cs-wait'); return settings; }
    const { data, error } = await sb.from('settings').select('value').eq('key', 'site').maybeSingle();
    if (error) window.INV?.logError?.('supabase', `settings: ${error.message}`);
    if (!error && data?.value) {
      settings = merge(data.value);
      store.set('inv_settings', JSON.stringify(data.value));
      applySettings();
    } else {
      document.documentElement.classList.remove('cs-wait');
    }
    return settings;
  }

  /* ---------- Coming Soon mode (CMS → topbar toggle) ----------
     Visitors get a full-screen Coming Soon page; a signed-in admin still sees the site, with a banner.
     The real HTML still ships to the browser, so this hides the site — it doesn't make it secret. */
  let adminSession = null;
  const isAdmin = () => (adminSession ??= sb ? sb.auth.getSession().then(r => !!r.data.session).catch(() => false) : Promise.resolve(false));
  async function applyComingSoon() {
    const root = document.documentElement;
    if (!settings.coming_soon) {
      root.classList.remove('cs-on', 'cs-wait'); $('#csPage')?.remove(); $('#csBanner')?.remove();
      return;
    }
    if (await isAdmin()) {
      root.classList.remove('cs-on', 'cs-wait'); $('#csPage')?.remove();
      if (!$('#csBanner')) document.body.insertAdjacentHTML('afterbegin', `<div class="cs-banner" id="csBanner" role="status"></div>`);
      $('#csBanner').textContent = ui('cs.admin');
      return;
    }
    renderComingSoon();
    root.classList.add('cs-on'); root.classList.remove('cs-wait');
  }
  function renderComingSoon() {
    const ig = (settings.instagram || 'invitinity').replace(/^@/, '');
    const wa = (settings.wa_number || '').replace(/\D/g, '');
    let page = $('#csPage');
    if (!page) { page = document.createElement('main'); page.className = 'cs'; page.id = 'csPage'; document.body.prepend(page); }
    page.innerHTML = `
      <div class="cs__inner">
        <div class="wordmark wordmark--light"><span class="wordmark__name">Invitinity</span><span class="wordmark__tag">Invitation Studio</span></div>
        <span class="cs__rule" aria-hidden="true"></span>
        <h1 class="cs__title">Coming Soon</h1>
        <p class="cs__text">${esc(ui('cs.text'))}</p>
        <div class="cs__links">
          <a href="https://www.instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener">@${esc(ig)}</a>
          ${wa ? `<a href="${esc(waLink(ui('wa.hello')))}" target="_blank" rel="noopener">${esc(ui('cs.contact'))}</a>` : ''}
        </div>
        <div class="cs__lang">${LANGS.map(l => `<button type="button" data-cs-lang="${l}" aria-pressed="${l === lang}">${l.toUpperCase()}</button>`).join('')}</div>
      </div>`;
    page.querySelectorAll('[data-cs-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.csLang)));
    document.title = 'Invitinity · Invitation Studio — Coming Soon';
  }
  onLang(() => {
    if ($('#csPage')) renderComingSoon();
    if ($('#csBanner')) $('#csBanner').textContent = ui('cs.admin');
  });

  /* ---------- WhatsApp ---------- */
  const waLink = (msg) => `https://wa.me/${(settings.wa_number || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  function refreshWaLinks() {
    $$('[data-wa]').forEach(a => { a.href = waLink(ui(a.dataset.wa)); a.target = '_blank'; a.rel = 'noopener'; });
  }

  /* ---------- Safe text / markdown ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => /^(https?:\/\/|mailto:|\/|#|[\w-]+\.html)/i.test(u) ? u : '#';
  function inline(s) {
    return s
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, u) => `<img src="${safeUrl(u)}" alt="${alt}" loading="lazy">`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${safeUrl(u)}" ${/^https?:/.test(u) ? 'target="_blank" rel="noopener"' : ''}>${t}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  }
  // Minimal Markdown: ## / ### headings, - and 1. lists, > quotes, images, links, bold, italic.
  function markdown(src) {
    const lines = esc(src).replace(/\r/g, '').split('\n');
    const out = []; let para = [], list = null;
    const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
    const flushL = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
    for (const raw of lines) {
      const line = raw.trim();
      let m;
      if (!line) { flushP(); flushL(); continue; }
      if ((m = line.match(/^(#{2,3})\s+(.*)$/))) { flushP(); flushL(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
      if ((m = line.match(/^&gt;\s?(.*)$/))) { flushP(); flushL(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
      if ((m = line.match(/^[-*]\s+(.*)$/)) || (m = line.match(/^\d+\.\s+(.*)$/))) {
        flushP(); const tag = /^\d/.test(line) ? 'ol' : 'ul';
        if (!list || list.tag !== tag) { flushL(); list = { tag, items: [] }; }
        list.items.push(m[1]); continue;
      }
      flushL(); para.push(line);
    }
    flushP(); flushL();
    return out.join('\n');
  }

  /* ---------- Invitation design renderer (portfolio items without image) ---------- */
  function design(w) {
    const names = esc(w.names || '').replace(/\s*&amp;\s*/, '<b>&amp;</b>');
    const ornament = ['gala', 'launch'].includes(w.theme) ? '<span class="dz-rule"></span>' : '';
    return `<div class="dz dz--${esc(w.theme || 'ivory')}"><span class="dz-frame"></span>
      <span class="dz-k">${esc(w.kicker || '')}</span>${ornament}
      <span class="dz-t">${names}</span>
      <span class="dz-d">${esc(w.event_date || '')}</span>
      <span class="dz-p">${esc(w.place || '')}</span></div>`;
  }
  const media = (w) => w.image_url ? `<img src="${esc(w.image_url)}" alt="${esc(pick(w.title))}" loading="lazy">` : design(w);

  function productUrl(raw) {
    let value = String(raw || '').trim();
    if (!value) return null;
    if (/^\/(?!\/)/.test(value)) value = `${location.origin}${value}`;
    else if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    try {
      const url = new URL(value, location.href);
      if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin) return null;
      return url.href;
    } catch { return null; }
  }
  function demoPreviewSource(raw) {
    const href = productUrl(raw);
    if (!href) return null;
    const url = new URL(href);
    url.searchParams.set('inv_preview', '1');
    return url.href;
  }
  function demoPreview(w) {
    const src = demoPreviewSource(w.demo_url);
    if (!src) return media(w);
    return `<div class="demo-preview" data-demo-preview data-src="${esc(src)}">
      <div class="demo-preview__fallback">${media(w)}</div>
      <iframe title="Pratinjau ${esc(pick(w.title))}" aria-hidden="true" tabindex="-1"></iframe>
    </div>`;
  }

  const previewReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const previewScrollDuration = 15000;
  function stopDemoPreview(host) {
    host._demoPreviewVisible = false;
    if (host._demoPreviewRaf) cancelAnimationFrame(host._demoPreviewRaf);
    if (host._demoPreviewRestart) clearTimeout(host._demoPreviewRestart);
    host._demoPreviewRaf = host._demoPreviewRestart = 0;
    host._demoPreviewStartedAt = null;
  }
  function runDemoPreview(host) {
    if (!host._demoPreviewVisible || host._demoPreviewRaf || host._demoPreviewRestart) return;
    const frame = $('iframe', host);
    let doc, win;
    try { doc = frame.contentDocument; win = frame.contentWindow; } catch { return; }
    if (!doc?.body || !win) return;

    // Open invitation templates so the preview starts at the actual page content.
    doc.documentElement.classList.remove('is-locked');
    doc.documentElement.style.scrollBehavior = 'auto';
    doc.body.classList.add('is-open');
    doc.body.style.scrollBehavior = 'auto';
    const cover = doc.querySelector('#cover, .cover, [data-invitation-cover]');
    if (cover) { cover.hidden = true; cover.style.display = 'none'; }
    doc.querySelectorAll('.rv').forEach(el => el.classList.add('in'));
    doc.querySelectorAll('audio, video').forEach(el => { try { el.pause(); } catch {} });
    host.classList.add('is-ready');
    if (previewReducedMotion) return;

    const animate = (now) => {
      host._demoPreviewRaf = 0;
      if (!host._demoPreviewVisible || !host.isConnected) return;
      const scroll = doc.scrollingElement || doc.documentElement;
      const max = Math.max(0, scroll.scrollHeight - win.innerHeight);
      if (!max) return;
      if (host._demoPreviewStartedAt == null) {
        host._demoPreviewStartedAt = now;
        win.scrollTo(0, 0);
      }
      const progress = Math.min(1, (now - host._demoPreviewStartedAt) / previewScrollDuration);
      const smoothProgress = 0.5 - Math.cos(Math.PI * progress) / 2;
      win.scrollTo(0, max * smoothProgress);
      if (progress >= 1) {
        host._demoPreviewRestart = setTimeout(() => {
          host._demoPreviewRestart = 0;
          host._demoPreviewStartedAt = null;
          win.scrollTo(0, 0);
          if (host._demoPreviewVisible) host._demoPreviewRaf = requestAnimationFrame(animate);
        }, 850);
      } else {
        host._demoPreviewRaf = requestAnimationFrame(animate);
      }
    };
    host._demoPreviewRaf = requestAnimationFrame(animate);
  }
  function visibleDemoPreview(host) {
    const work = host.closest('.work');
    return !work || getComputedStyle(work).visibility !== 'hidden';
  }
  const demoPreviewObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(({ target: host, isIntersecting }) => {
      if (!host.isConnected) {
        demoPreviewObserver.unobserve(host);
        host._demoPreviewResize?.disconnect();
        stopDemoPreview(host);
        return;
      }
      const visible = isIntersecting && visibleDemoPreview(host);
      if (!visible) { stopDemoPreview(host); return; }
      host._demoPreviewVisible = true;
      const frame = $('iframe', host);
      if (!frame.dataset.started) {
        frame.dataset.started = '1';
        frame.addEventListener('load', () => runDemoPreview(host), { once: true });
        frame.src = host.dataset.src;
      } else runDemoPreview(host);
    });
  }, { threshold: 0.05 }) : null;
  function mountDemoPreviews(root = document) {
    const hosts = $$('[data-demo-preview]', root);
    hosts.forEach(host => {
      if (!host._demoPreviewResize && 'ResizeObserver' in window) {
        host._demoPreviewResize = new ResizeObserver(() => {
          host.style.setProperty('--preview-scale', String(host.clientWidth / 390));
        });
        host._demoPreviewResize.observe(host);
      }
      host.style.setProperty('--preview-scale', String(host.clientWidth / 390));
    });
    if (!demoPreviewObserver) {
      hosts.forEach(host => {
        host._demoPreviewVisible = true;
        const frame = $('iframe', host);
        if (!frame.dataset.started) {
          frame.dataset.started = '1';
          frame.addEventListener('load', () => runDemoPreview(host), { once: true });
          frame.src = host.dataset.src;
        }
      });
      return;
    }
    hosts.forEach(host => {
      // Re-observing refreshes visibility after a hidden signature slide becomes active.
      demoPreviewObserver.unobserve(host);
      demoPreviewObserver.observe(host);
    });
  }

  const postCard = (p) => `
    <a class="post" href="article.html?slug=${encodeURIComponent(p.slug)}" data-reveal>
      <div class="post__cover">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="" loading="lazy">` : '<span class="ph">Invitinity</span>'}</div>
      <div class="post__body">
        <time datetime="${esc(p.published_at || '')}">${esc(p.published_at ? fmtDate(p.published_at) : '')}</time>
        <h3>${esc(pick(p.title))}</h3>
        <p>${esc(pick(p.excerpt))}</p>
        <span class="link-more">${esc(ui('readMore'))}</span>
      </div>
    </a>`;

  // Render static invitation mockups declared as data-dz='{"theme":..}'.
  function renderMocks(root = document) {
    $$('[data-dz]', root).forEach(el => {
      try { el.innerHTML = design(JSON.parse(el.dataset.dz)); } catch { /* bad JSON — leave empty */ }
    });
  }

  // Wordmark: split letters for the one-time typing reveal.
  function typeLogo() {
    $$('.typing [data-type]').forEach(el => {
      const text = el.textContent.trim();
      el.setAttribute('aria-label', text);
      el.innerHTML = [...text].map((c, i) => `<span class="ch" style="--i:${i}" aria-hidden="true">${esc(c)}</span>`).join('')
        + `<span class="caret" style="--n:${text.length}" aria-hidden="true"></span>`;
    });
  }

  /* ---------- Page chrome: header, drawer, language menu, reveal ---------- */
  function initChrome() {
    const header = $('#nav');
    if (header) {
      const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 10);
      addEventListener('scroll', onScroll, { passive: true }); onScroll();
    }
    const drawer = $('#drawerNav');
    if (drawer) {
      const setOpen = (open) => {
        drawer.classList.toggle('is-open', open); drawer.setAttribute('aria-hidden', String(!open));
        document.body.style.overflow = open ? 'hidden' : '';
      };
      $('#menuOpen')?.addEventListener('click', () => setOpen(true));
      $$('[data-close-menu], a', drawer).forEach(el => el.addEventListener('click', () => setOpen(false)));
      addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    }
    const ls = $('#langsel');
    if (ls) {
      const btn = $('.langsel__btn', ls);
      const set = (open) => { ls.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); };
      btn.addEventListener('click', (e) => { e.stopPropagation(); set(!ls.classList.contains('is-open')); });
      document.addEventListener('click', () => set(false));
    }
    $$('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
    $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
    renderMocks();
    typeLogo();
  }
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .1 })
    : null;
  const reveal = (root = document) => $$('[data-reveal]:not(.is-in)', root).forEach(el => io ? io.observe(el) : el.classList.add('is-in'));

  function init() {
    capture();
    initChrome();
    setLang(lang, { persist: false });
    reveal();
    loadSettings();
    setTimeout(() => document.documentElement.classList.remove('cs-wait'), 2500); // never stay blank if Supabase is slow
  }

  return { sb, cfg, $, $$, esc, pick, ui, fmtDate, markdown, design, media, productUrl, demoPreviewSource, demoPreview, mountDemoPreviews, postCard, renderMocks, waLink, reveal, onLang, init,
    get lang() { return lang; }, get settings() { return settings; } };
})();
