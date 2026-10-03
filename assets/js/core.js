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
  const base = new Map();
  const usesText = el => el.tagName === 'TITLE' || el.tagName === 'OPTION';
  function capture(root = document) {
    $$('[data-i18n]', root).forEach(el => { if (!base.has(el)) base.set(el, usesText(el) ? el.textContent : el.innerHTML); });
    $$('[data-i18n-attr]', root).forEach(el => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr] = pair.split(':');
        if (!el.dataset[`base_${attr}`]) el.dataset[`base_${attr}`] = el.getAttribute(attr) || '';
      });
    });
  }
  function tr(key, fallback) { return lang === 'id' ? fallback : (window.I18N?.[lang]?.[key] ?? fallback); }
  function applyStatic() {
    base.forEach((orig, el) => {
      const v = tr(el.dataset.i18n, orig);
      if (usesText(el)) el.textContent = v; else el.innerHTML = v;
    });
    $$('[data-i18n-attr]').forEach(el => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':');
        el.setAttribute(attr, tr(key, el.dataset[`base_${attr}`]));
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
    const p = window.FONT_PRESETS[key] || window.FONT_PRESETS.modern;
    const root = document.documentElement.style;
    root.setProperty('--font-serif', p.serif);
    root.setProperty('--font-sans', p.sans);
    const link = $('#fontLink');
    if (link && link.href !== p.href) link.href = p.href;
  }
  function applySettings() {
    applyFont(settings.font);
    if (/^#[0-9a-f]{6}$/i.test(settings.accent || '')) document.documentElement.style.setProperty('--gold', settings.accent);
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
  }
  function applySettingsText() {
    const t = settings.hero_title?.[lang], d = settings.hero_subtitle?.[lang];
    if (t && $('#heroTitle')) $('#heroTitle').textContent = t;
    if (d && $('#heroDesc')) $('#heroDesc').textContent = d;
  }
  async function loadSettings() {
    const cached = store.get('inv_settings');
    if (cached) { try { settings = merge(JSON.parse(cached)); applySettings(); } catch { /* ignore bad cache */ } }
    if (!sb) return settings;
    const { data, error } = await sb.from('settings').select('value').eq('key', 'site').maybeSingle();
    if (!error && data?.value) {
      settings = merge(data.value);
      store.set('inv_settings', JSON.stringify(data.value));
      applySettings();
    }
    return settings;
  }

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

  const postCard = (p) => `
    <a class="post" href="article.html?slug=${encodeURIComponent(p.slug)}" data-reveal>
      <div class="post__cover">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="" loading="lazy">` : '<svg viewBox="0 0 24 24"><use href="#i-infinity"/></svg>'}</div>
      <time datetime="${esc(p.published_at || '')}">${esc(p.published_at ? fmtDate(p.published_at) : '')}</time>
      <h3>${esc(pick(p.title))}</h3>
      <p>${esc(pick(p.excerpt))}</p>
      <span class="link">${esc(ui('readMore'))}</span>
    </a>`;

  /* ---------- Page chrome: nav, mobile menu, reveal ---------- */
  function initChrome() {
    const nav = $('#nav'), toggle = $('#navToggle');
    if (nav && !nav.classList.contains('nav--solid')) {
      const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 30);
      addEventListener('scroll', onScroll, { passive: true }); onScroll();
    }
    if (toggle) {
      const setOpen = (open) => { nav.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', open); document.body.style.overflow = open ? 'hidden' : ''; };
      toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
      $$('#mobileMenu a').forEach(a => a.addEventListener('click', () => setOpen(false)));
      addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    }
    $$('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
    $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
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
  }

  return { sb, cfg, $, $$, esc, pick, ui, fmtDate, markdown, design, media, postCard, waLink, reveal, onLang, init,
    get lang() { return lang; }, get settings() { return settings; } };
})();
