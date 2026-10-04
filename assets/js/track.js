/* Invitinity visitor stats + error log (public pages only; the CMS doesn't load this).
   - One page_views row per page load: page, referrer host, device/browser/OS, language,
     and city/country from an IP geolocation lookup (the IP itself is never stored).
   - Uncaught errors, failed resources and Supabase errors go to error_logs.
   Bots, headless browsers, datacenter and VPN networks are skipped: views and errors are only sent after a
   real (trusted) interaction from a normal ISP network.
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
  // Crawlers, link previews, SEO/uptime tools and headless browsers (they run JS, so they'd count as visits).
  const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|phantom|selenium|puppeteer|playwright|google-inspectiontool|chrome-lighthouse/i;
  const isBot = BOT.test(navigator.userAgent) || navigator.webdriver || !(navigator.languages && navigator.languages.length);
  const disabled = !sb || local || isBot || ls.get('inv_notrack') === '1';

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
  const path = location.pathname.replace(/^\/invitinity(?=\/)/, '').replace(/\/index\.html$/, '/') + (params.get('slug') ? `?slug=${params.get('slug')}` : '');
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
    try { const c = JSON.parse(ls.get('inv_geo2') || 'null'); if (c && Date.now() - c.t < GEO_TTL) return c.g; } catch { /* corrupt cache */ }
    let g = null;
    const a = await fetchJson('https://get.geojs.io/v1/ip/geo.json');
    if (a && (a.country || a.city)) g = { city: a.city, region: a.region, country: a.country, country_code: a.country_code, org: a.organization_name || a.organization };
    if (!g) {
      const b = await fetchJson('https://ipwho.is/');
      if (b && b.success !== false) g = { city: b.city, region: b.region, country: b.country, country_code: b.country_code, org: b.connection?.org || b.connection?.isp };
    }
    if (g) ls.set('inv_geo2', JSON.stringify({ t: Date.now(), g }));
    return g || {};
  }

  // Cloud/hosting networks: visits from here are servers (crawlers, scanners, headless bots), not people.
  // Cloudflare & Akamai are left out on purpose: iCloud Private Relay (real iPhone users) exits through them.
  // VPN exit networks are included too: their location is the VPN server's, not the visitor's.
  const DATACENTER = new RegExp([
    'amazon', 'aws', 'google', 'microsoft', 'azure', 'digitalocean', 'linode', 'ovh', 'hetzner', 'vultr', 'choopa', 'constant company',
    'oracle', 'alibaba', 'tencent', 'huawei cloud', 'contabo', 'scaleway', 'online s\.a\.s', 'leaseweb', 'hostinger', 'ionos', 'godaddy',
    'rackspace', 'softlayer', 'ibm cloud', 'datacamp', 'zenlayer', 'cogent', 'hurricane electric', 'psychz', 'quadranet', 'colocrossing',
    'm247', 'packethub', 'tzulo', 'clouvider', 'g-core', 'gcore', 'stark industries', 'pq hosting', 'aeza', 'frantech', 'buyvm',
    'servers\.com', 'latitude\.sh', 'equinix', 'hydra communications', 'cdn77', 'datapacket', 'nforce', 'worldstream', 'serverius',
    'i3d', 'hostkey', 'selectel', 'timeweb', 'melbicom', 'sharktech', 'ponynet', 'zscaler', 'fastly', 'hostwinds', 'ionos',
  ].join('|'), 'i');

  // Country fallback from the device time zone when the geolocation service is blocked (e.g. by an ad blocker).
  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const TZ_COUNTRY = {
    'Asia/Jakarta': ['Indonesia', 'ID'], 'Asia/Pontianak': ['Indonesia', 'ID'], 'Asia/Makassar': ['Indonesia', 'ID'], 'Asia/Jayapura': ['Indonesia', 'ID'],
    'Asia/Kuala_Lumpur': ['Malaysia', 'MY'], 'Asia/Kuching': ['Malaysia', 'MY'], 'Asia/Singapore': ['Singapore', 'SG'], 'Asia/Brunei': ['Brunei', 'BN'],
  };

  /* ---------- Human gate ----------
     Resolves once with the geo data when a real person is here: a trusted interaction (not script-generated,
     and not an automatic scroll right after load) from a non-datacenter network. Resolves null for bots. */
  const loadedAt = performance.now();
  const human = disabled ? Promise.resolve(null) : new Promise((resolve) => {
    const EVENTS = ['scroll', 'pointermove', 'pointerdown', 'touchstart', 'keydown'];
    const once = (e) => {
      if (!e.isTrusted || (e.type === 'scroll' && performance.now() - loadedAt < 1200)) return;
      EVENTS.forEach(ev => removeEventListener(ev, once, true));
      geo().then(g => resolve(g.org && DATACENTER.test(g.org) ? null : g), () => resolve({}));
    };
    EVENTS.forEach(ev => addEventListener(ev, once, { capture: true, passive: true }));
  });

  async function recordView() {
    const g = await human;
    if (!g) return;
    const fallback = !g.country && TZ_COUNTRY[TZ];
    const row = {
      visitor_id: visitorId, session_id: sessionId, path: cut(path, 300), referrer: cut(referrer, 200),
      lang: cut(window.INV?.lang || document.documentElement.lang, 8), device, browser, os,
      country: cut(g.country || (fallback && fallback[0]), 80),
      country_code: cut((g.country_code || (fallback && fallback[1]) || '').toUpperCase(), 2) || null,
      region: cut(g.region, 80), city: cut(g.city, 80), timezone: cut(TZ, 60), org: cut(g.org, 100),
    };
    const { error } = await sb.from('page_views').insert(row);
    // Older databases without the "org" column: save the visit without it.
    if (error && /org/.test(error.message || '')) { delete row.org; await sb.from('page_views').insert(row); }
  }

  /* ---------- Error log ---------- */
  // Errors wait for the human gate, so bots (which often block images on purpose) don't fill the log.
  const seen = new Set(); let sent = 0;
  function logError(kind, message, extra = {}) {
    if (disabled || !message || sent >= 10) return;
    const key = kind + message + (extra.source || '');
    if (seen.has(key)) return;
    seen.add(key); sent++;
    human.then(g => g && sb.from('error_logs').insert({
      kind, message: cut(message, 1000), path: cut(path, 300), source: cut(extra.source, 300),
      line: extra.line ?? null, col: extra.col ?? null, stack: cut(extra.stack, 4000),
      browser, os, device, visitor_id: visitorId,
    })).then(() => {}, () => {});
  }
  if (window.INV) window.INV.logError = logError;

  let leaving = false;
  addEventListener('pagehide', () => { leaving = true; });
  addEventListener('error', (e) => {
    const el = e.target;
    if (el && el !== window && (el.src || el.href)) {
      if (leaving || !el.isConnected) return; // load aborted by navigation or a re-render, not a broken file
      const src = el.src || el.href;
      // Images get one automatic retry (helps visitors on flaky networks); only a second failure is logged.
      if (el.tagName === 'IMG' && !el.dataset.retried) {
        el.dataset.retried = '1';
        setTimeout(() => { if (el.isConnected) el.src = src + (src.includes('?') ? '&' : '?') + 'retry=1'; }, 1500);
        return;
      }
      return logError('resource', `Gagal memuat ${el.tagName.toLowerCase()}`, { source: src.replace(/[?&]retry=1$/, '') });
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
