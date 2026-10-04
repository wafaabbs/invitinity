/* Invitinity visitor stats + error log (public pages only; the CMS doesn't load this).
   - One page_views row per page load: page, referrer host, device/browser/OS, language,
     and city/country from an IP geolocation lookup (the IP itself is never stored).
   - Uncaught errors, failed resources and Supabase errors go to error_logs.
   Opt-out: the CMS sets localStorage inv_notrack=1 for admins so their visits don't count. */
(() => {
  const sb = window.INV?.sb;
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };
  const disabled = !sb || local || navigator.webdriver || ls.get('inv_notrack') === '1';

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const visitorId = ls.get('inv_vid') || uid(); ls.set('inv_vid', visitorId);
  const sessionId = ss.get('inv_sid') || uid(); ss.set('inv_sid', sessionId);
  const cut = (s, n) => (s == null ? null : String(s).slice(0, n));

  /* ---------- Device / browser / OS ---------- */
  const ua = navigator.userAgent;
  const device = /iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || (/Android/.test(ua) && !/Mobile/.test(ua))
    ? 'tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /FBAN|FBAV|Instagram|Line\//.test(ua) ? 'In-app (FB/IG)' : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Lainnya';
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iOS'
    : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Lainnya';

  /* ---------- Page + referrer ---------- */
  const params = new URLSearchParams(location.search);
  const path = location.pathname.replace(/\/index\.html$/, '/') + (params.get('slug') ? `?slug=${params.get('slug')}` : '');
  let referrer = params.get('utm_source') || null;
  if (!referrer && document.referrer) {
    try { const h = new URL(document.referrer).hostname; if (h && h !== location.hostname) referrer = h.replace(/^www\./, ''); } catch { /* bad referrer */ }
  }

  /* ---------- Geolocation (cached 12h per browser) ---------- */
  const GEO_TTL = 12 * 3600 * 1000;
  async function fetchJson(url, ms = 3500) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetch(url, { signal: ctl.signal }); return r.ok ? await r.json() : null; }
    catch { return null; } finally { clearTimeout(t); }
  }
  async function geo() {
    try { const c = JSON.parse(ls.get('inv_geo') || 'null'); if (c && Date.now() - c.t < GEO_TTL) return c.g; } catch { /* corrupt cache */ }
    let g = null;
    const a = await fetchJson('https://get.geojs.io/v1/ip/geo.json');
    if (a && (a.country || a.city)) g = { city: a.city, region: a.region, country: a.country, country_code: a.country_code };
    if (!g) {
      const b = await fetchJson('https://ipwho.is/');
      if (b && b.success !== false) g = { city: b.city, region: b.region, country: b.country, country_code: b.country_code };
    }
    if (g) ls.set('inv_geo', JSON.stringify({ t: Date.now(), g }));
    return g || {};
  }

  async function recordView() {
    const g = await geo();
    await sb.from('page_views').insert({
      visitor_id: visitorId, session_id: sessionId, path: cut(path, 300), referrer: cut(referrer, 200),
      lang: cut(window.INV?.lang || document.documentElement.lang, 8), device, browser, os,
      country: cut(g.country, 80), country_code: cut((g.country_code || '').toUpperCase(), 2) || null,
      region: cut(g.region, 80), city: cut(g.city, 80),
      timezone: cut(Intl.DateTimeFormat().resolvedOptions().timeZone, 60),
    });
  }

  /* ---------- Error log ---------- */
  const seen = new Set(); let sent = 0;
  function logError(kind, message, extra = {}) {
    if (disabled || !message || sent >= 10) return;
    const key = kind + message + (extra.source || '');
    if (seen.has(key)) return;
    seen.add(key); sent++;
    sb.from('error_logs').insert({
      kind, message: cut(message, 1000), path: cut(path, 300), source: cut(extra.source, 300),
      line: extra.line ?? null, col: extra.col ?? null, stack: cut(extra.stack, 4000),
      browser, os, device, visitor_id: visitorId,
    }).then(() => {}, () => {});
  }
  if (window.INV) window.INV.logError = logError;

  addEventListener('error', (e) => {
    const el = e.target;
    if (el && el !== window && (el.src || el.href)) {
      return logError('resource', `Gagal memuat ${el.tagName.toLowerCase()}`, { source: el.src || el.href });
    }
    if (/^Script error\.?$/.test(e.message) || /extension:\/\//.test(e.filename || '')) return; // cross-origin / browser extensions
    logError('error', e.message, { source: e.filename, line: e.lineno, col: e.colno, stack: e.error?.stack });
  }, true);
  addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    logError('promise', r?.message || String(r), { stack: r?.stack });
  });

  if (!disabled) recordView().catch(() => {});
})();
