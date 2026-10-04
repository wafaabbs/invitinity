/* Invitinity CMS — visitor dashboard and error history (data from assets/js/track.js). */
(() => {
  const { sb, esc } = INV;
  const $ = (s, el = document) => el.querySelector(s);
  const TZ = 'Asia/Jakarta';
  const nf = new Intl.NumberFormat('id-ID');
  const fmtTime = (d) => new Date(d).toLocaleString('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fmtDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const DEVICE = { mobile: 'HP', tablet: 'Tablet', desktop: 'Desktop', lainnya: 'Lainnya' };
  const notReady = (error) => `<div class="empty-state">Gagal memuat: ${esc(error.message)}<br>Pastikan <code>supabase/schema.sql</code> versi terbaru sudah dijalankan.</div>`;
  let toast = () => {};

  function pageLabel(p) {
    if (!p || p === '/') return 'Beranda';
    const slug = /[?&]slug=([^&]+)/.exec(p)?.[1];
    if (/article\.html/.test(p)) return slug ? `Artikel: ${decodeURIComponent(slug)}` : 'Daftar artikel';
    return p;
  }
  const place = (r) => [r.city, r.region && r.region !== r.city ? r.region : null, r.country].filter(Boolean).join(', ') || 'Tidak diketahui';

  /* ================= DASHBOARD ================= */
  function tile(label, value, sub = '') {
    return `<div class="stat-tile"><span>${label}</span><strong>${nf.format(value || 0)}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;
  }

  function niceMax(v) {
    const p = 10 ** Math.floor(Math.log10(v));
    return [1, 2, 2.5, 5, 10].map(m => m * p).find(m => m >= v);
  }
  function dailyChart(daily) {
    if (daily.length < 2) return '';
    const top = niceMax(Math.max(4, ...daily.map(d => d.views)));
    const mid = Math.floor(daily.length / 2);
    const total = daily.reduce((a, d) => a + d.views, 0);
    return `
      <div class="box chart-box">
        <b>Kunjungan per hari</b>
        <div class="chart" role="img" aria-label="Grafik kunjungan per hari, total ${total} kunjungan">
          <div class="chart__y"><span>${nf.format(top)}</span><span>${nf.format(top / 2)}</span><span>0</span></div>
          <div class="chart__plot">
            <div class="chart__grid"><i></i><i></i><i></i></div>
            <div class="chart__bars">${daily.map(d => `
              <div class="bar-col" tabindex="0" data-day="${d.day}" data-views="${d.views}" data-visitors="${d.visitors}">
                <span class="bar" style="height:${(d.views / top) * 100}%"></span>
              </div>`).join('')}
            </div>
          </div>
          <div class="chart__x"><span>${fmtDay(daily[0].day)}</span><span>${fmtDay(daily[mid].day)}</span><span>${fmtDay(daily.at(-1).day)}</span></div>
        </div>
      </div>`;
  }

  function rankList(title, rows, label = (r) => esc(r.label), empty = 'Belum ada data.') {
    const max = Math.max(1, ...rows.map(r => r.visitors));
    return `
      <div class="box rank">
        <b>${title}</b>
        ${rows.length ? `<div class="rank__head"><span></span><span>Pengunjung</span></div>` + rows.map(r => `
          <div class="rank__row" title="${nf.format(r.visitors)} pengunjung · ${nf.format(r.views)} kunjungan">
            <span class="rank__label">${label(r)}</span>
            <span class="rank__num">${nf.format(r.visitors)}</span>
            <span class="rank__bar"><i style="width:${Math.max(2, (r.visitors / max) * 100)}%"></i></span>
          </div>`).join('') : `<p class="hint">${empty}</p>`}
      </div>`;
  }

  async function loadStats() {
    const days = Number($('#statsRange').value);
    const body = $('#statsBody');
    const [{ data: s, error }, { data: recent }] = await Promise.all([
      sb.rpc('visitor_stats', { p_days: days }),
      sb.from('page_views').select('created_at,path,city,region,country,device,browser,os,referrer').order('created_at', { ascending: false }).limit(30),
    ]);
    if (error) { body.innerHTML = notReady(error); return; }
    const range = days === 1 ? 'hari ini' : `${days} hari terakhir`;
    body.innerHTML = `
      <div class="stat-tiles">
        ${tile('Pengunjung hari ini', s.today_visitors, `${nf.format(s.today_views)} kunjungan`)}
        ${tile('Pengunjung unik', s.visitors, range)}
        ${tile('Total kunjungan', s.views, range)}
        ${tile('Sesi', s.sessions, s.sessions ? `${(s.views / s.sessions).toFixed(1).replace('.', ',')} halaman / sesi` : range)}
      </div>
      ${dailyChart(s.daily || [])}
      <div class="rank-grid">
        ${rankList('Kota', s.cities, undefined, 'Belum ada data lokasi.')}
        ${rankList('Negara', s.countries, r => `${r.code ? `<span class="cc">${esc(r.code)}</span>` : ''}${esc(r.label)}`)}
        ${rankList('Halaman', s.pages, r => esc(pageLabel(r.label)))}
        ${rankList('Sumber kunjungan', s.referrers, undefined, 'Semua langsung (ketik URL / bookmark).')}
        ${rankList('Perangkat', s.devices, r => esc(DEVICE[r.label] || r.label))}
        ${rankList('Browser', s.browsers)}
        ${rankList('Bahasa', s.langs)}
      </div>
      <div class="box">
        <b>Akses terbaru</b>
        ${recent?.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Waktu (WIB)</th><th>Halaman</th><th>Lokasi</th><th>Perangkat</th><th>Sumber</th></tr></thead>
          <tbody>${recent.map(r => `<tr>
            <td>${fmtTime(r.created_at)}</td><td>${esc(pageLabel(r.path))}</td><td>${esc(place(r))}</td>
            <td>${esc([DEVICE[r.device] || r.device, r.browser, r.os].filter(Boolean).join(' · '))}</td><td>${esc(r.referrer || 'Langsung')}</td>
          </tr>`).join('')}</tbody></table></div>` : '<p class="hint">Belum ada kunjungan tercatat.</p>'}
      </div>`;
  }
  $('#statsRange').addEventListener('change', loadStats);
  $('#statsRefresh').addEventListener('click', loadStats);

  /* Chart tooltip (hover + keyboard focus) */
  const tip = $('#chartTip');
  function showTip(col) {
    const d = col.dataset;
    tip.innerHTML = `<b>${new Date(`${d.day}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long' })}</b>
      <span>${nf.format(d.views)} kunjungan</span><span>${nf.format(d.visitors)} pengunjung</span>`;
    tip.hidden = false;
    const r = col.getBoundingClientRect(), t = tip.getBoundingClientRect();
    const x = Math.min(innerWidth - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2));
    tip.style.left = `${x}px`; tip.style.top = `${Math.max(8, r.top - t.height - 8)}px`;
    col.classList.add('is-hover');
  }
  const hideTip = (col) => { tip.hidden = true; col?.classList.remove('is-hover'); };
  ['mouseover', 'focusin'].forEach(ev => $('#statsBody').addEventListener(ev, e => { const c = e.target.closest('.bar-col'); if (c) showTip(c); }));
  ['mouseout', 'focusout'].forEach(ev => $('#statsBody').addEventListener(ev, e => { const c = e.target.closest('.bar-col'); if (c) hideTip(c); }));

  /* ================= ERRORS ================= */
  const KIND = { error: 'JavaScript', promise: 'Promise', resource: 'File gagal dimuat', supabase: 'Supabase' };
  async function loadErrors() {
    const { data, error } = await sb.from('error_logs').select('*').order('created_at', { ascending: false }).limit(500);
    const list = $('#errorList');
    if (error) { list.innerHTML = notReady(error); return; }
    const dayAgo = Date.now() - 864e5;
    const recent = data.filter(r => new Date(r.created_at) > dayAgo).length;
    $('#errBadge').hidden = !recent; $('#errBadge').textContent = recent;
    if (!data.length) { list.innerHTML = '<div class="empty-state">Tidak ada error tercatat 🎉</div>'; return; }

    const groups = new Map();
    data.forEach(r => {
      const k = `${r.kind}|${r.message}|${r.source || ''}`;
      if (!groups.has(k)) groups.set(k, { ...r, count: 0, paths: new Set(), browsers: new Set(), visitors: new Set(), first: r.created_at });
      const g = groups.get(k);
      g.count++; g.first = r.created_at;
      if (r.path) g.paths.add(pageLabel(r.path));
      g.browsers.add([r.browser, r.os].filter(Boolean).join(' / '));
      if (r.visitor_id) g.visitors.add(r.visitor_id);
    });
    list.innerHTML = `<p class="hint">${nf.format(data.length)} kejadian · ${groups.size} jenis error${data.length === 500 ? ' (500 terbaru)' : ''}</p>` +
      [...groups.values()].map(g => `
        <details class="err">
          <summary>
            <span class="pill err-kind err-kind--${g.kind}">${KIND[g.kind] || g.kind}</span>
            <span class="err__msg">${esc(g.message)}</span>
            <span class="err__meta">${nf.format(g.count)}× · ${g.visitors.size} pengunjung · terakhir ${fmtTime(g.created_at)}</span>
          </summary>
          <dl>
            <dt>Halaman</dt><dd>${esc([...g.paths].join(', ') || '-')}</dd>
            ${g.source ? `<dt>Sumber</dt><dd class="mono">${esc(g.source)}${g.line ? `:${g.line}:${g.col ?? 0}` : ''}</dd>` : ''}
            <dt>Browser</dt><dd>${esc([...g.browsers].join(', ') || '-')}</dd>
            <dt>Pertama</dt><dd>${fmtTime(g.first)}</dd>
          </dl>
          ${g.stack ? `<pre class="mono">${esc(g.stack)}</pre>` : ''}
        </details>`).join('');
  }
  $('#errRefresh').addEventListener('click', loadErrors);
  $('#errClear').addEventListener('click', async () => {
    if (!confirm('Hapus semua riwayat error? Tindakan ini tidak bisa dibatalkan.')) return;
    const { error } = await sb.from('error_logs').delete().gt('id', 0);
    if (error) return toast(error.message, true);
    toast('Riwayat error dihapus'); loadErrors();
  });

  function init(ctx) { toast = ctx.toast || toast; loadStats(); loadErrors(); }
  if (window.CMS_READY) init(window.CMS_READY);
  document.addEventListener('cms:ready', e => init(e.detail));
})();
