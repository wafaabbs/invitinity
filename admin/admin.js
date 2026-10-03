/* Invitinity CMS — portfolio, articles and appearance, backed by Supabase. */
(() => {
  const { sb, esc, design, markdown } = INV;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const LANGS = [['id', 'ID'], ['en', 'EN'], ['ms', 'MS']];
  const CAT_LABEL = { wedding: 'Wedding', birthday: 'Ulang tahun', corporate: 'Korporat', minimalist: 'Minimalis', luxury: 'Luxury' };
  const BUCKET = INV.cfg.mediaBucket || 'media';
  const MAX_UPLOAD = 5 * 1024 * 1024;

  const idText = (v) => (v && (v.id || v.en || v.ms)) || '';
  const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

  let toastTimer;
  function toast(msg, isErr = false) {
    const t = $('#toast');
    t.textContent = msg; t.classList.toggle('err', isErr); t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), isErr ? 6000 : 2600);
  }

  /* ================= AUTH ================= */
  function showLogin(msg = '') {
    $('#appView').hidden = true; $('#loginView').hidden = false;
    $('#loginMsg').textContent = msg;
  }
  async function boot() {
    if (!sb) return showLogin('Supabase belum terhubung. Cek assets/js/config.js.');
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showLogin();
    const { data: isAdmin, error } = await sb.rpc('is_admin');
    if (error) return showLogin(`Database belum siap — jalankan supabase/schema.sql di SQL Editor. (${error.message})`);
    if (!isAdmin) { await sb.auth.signOut(); return showLogin('Akun ini belum terdaftar di tabel admins.'); }
    $('#loginView').hidden = true; $('#appView').hidden = false;
    $('#who').textContent = session.user.email;
    loadPortfolio(); loadArticles(); loadSettings();
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    $('#loginMsg').textContent = 'Memproses…';
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    if (error) return showLogin(error.message === 'Invalid login credentials' ? 'Email atau password salah.' : error.message);
    boot();
  });
  $('#logout').addEventListener('click', async () => { await sb.auth.signOut(); showLogin(); });

  /* ================= TABS ================= */
  $$('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
    $$('.tabs [data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== b.dataset.tab; });
  }));

  /* ================= LANGUAGE FIELDS ================= */
  // name="title.id" etc. Only the active language is visible.
  function i18nField(name, label, values = {}, { type = 'input', cls = '', ph = '' } = {}) {
    return LANGS.map(([l, L]) => {
      let v = values?.[l] ?? '';
      if (Array.isArray(v)) v = v.join('\n');
      const control = type === 'textarea'
        ? `<textarea name="${name}.${l}" class="${cls}" placeholder="${esc(ph)}">${esc(v)}</textarea>`
        : `<input name="${name}.${l}" value="${esc(v)}" placeholder="${esc(ph)}">`;
      return `<label data-lang-field="${l}">${label} <small>(${L})</small>${control}</label>`;
    }).join('');
  }
  function mountLangTabs(scope, statusField) {
    const tabs = $('[data-langtabs]', scope);
    const set = (l) => {
      $$('[data-lang-field]', scope).forEach(el => { el.hidden = el.dataset.langField !== l; });
      $$('button', tabs).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.l === l)));
      scope.dataset.lang = l;
      scope.dispatchEvent(new Event('langchange'));
    };
    const dots = () => {
      if (!statusField) return;
      $$('button', tabs).forEach(b => {
        const filled = !!scope.querySelector(`[name="${statusField}.${b.dataset.l}"]`)?.value.trim();
        $('.dot', b).classList.toggle('ok', filled);
      });
    };
    tabs.innerHTML = LANGS.map(([l, L]) => `<button type="button" data-l="${l}">${L}${statusField ? '<span class="dot"></span>' : ''}</button>`).join('');
    tabs.onclick = (e) => { const b = e.target.closest('button'); if (b) set(b.dataset.l); };
    if (scope._dots) scope.removeEventListener('input', scope._dots);
    scope._dots = dots; scope.addEventListener('input', dots);
    set('id'); dots();
  }
  const readI18n = (form, name, asList = false) => Object.fromEntries(LANGS.map(([l]) => {
    const v = form.elements[`${name}.${l}`]?.value.trim() || '';
    return [l, asList ? v.split('\n').map(s => s.trim()).filter(Boolean) : v];
  }));

  /* ================= UPLOAD ================= */
  async function upload(file, folder) {
    if (!file) return null;
    if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');
    if (file.size > MAX_UPLOAD) throw new Error('Ukuran gambar maksimal 5 MB.');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${folder}/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, '')) || 'image'}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false });
    if (error) throw error;
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  function bindUpload(form, urlName, folder, onDone) {
    const input = $('input[type="file"]', form);
    input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      toast('Mengunggah gambar…');
      try {
        form.elements[urlName].value = await upload(file, folder);
        toast('Gambar terunggah ✓'); onDone();
      } catch (err) { toast(err.message, true); }
      input.value = '';
    });
  }

  /* ================= GENERIC LIST + EDITOR ================= */
  const state = { portfolio: [], articles: [] };
  let editing = null; // { kind, row }

  function emptyState(kind, error) {
    if (error) return `<div class="empty-state">Gagal memuat data: ${esc(error.message)}<br>Pastikan <code>supabase/schema.sql</code> sudah dijalankan.</div>`;
    return `<div class="empty-state">Belum ada ${kind === 'portfolio' ? 'karya' : 'artikel'}. Klik tombol tambah di kanan atas.</div>`;
  }

  async function loadPortfolio() {
    const { data, error } = await sb.from('portfolio').select('*').order('sort_order').order('created_at');
    state.portfolio = data || [];
    $('#portfolioList').innerHTML = error || !data.length ? emptyState('portfolio', error) : data.map(w => `
      <div class="row-item" data-edit="portfolio" data-id="${w.id}">
        <div class="thumb">${w.image_url ? `<img src="${esc(w.image_url)}" alt="">` : design(w)}</div>
        <div><h4>${esc(idText(w.title)) || '(tanpa judul)'}</h4><p>${esc((w.categories || []).map(c => CAT_LABEL[c] || c).join(' · '))} · urutan ${w.sort_order}</p></div>
        <span class="pill ${w.published ? '' : 'off'}">${w.published ? 'Tayang' : 'Draft'}</span>
      </div>`).join('');
  }
  async function loadArticles() {
    const { data, error } = await sb.from('articles').select('*').order('published_at', { ascending: false });
    state.articles = data || [];
    $('#articlesList').innerHTML = error || !data.length ? emptyState('articles', error) : data.map(a => `
      <div class="row-item" data-edit="articles" data-id="${a.id}">
        <div class="thumb wide">${a.cover_url ? `<img src="${esc(a.cover_url)}" alt="">` : ''}</div>
        <div><h4>${esc(idText(a.title)) || '(tanpa judul)'}</h4><p>/${esc(a.slug)} · ${a.published_at ? new Date(a.published_at).toLocaleDateString('id-ID') : '-'}</p></div>
        <span class="pill ${a.published ? '' : 'off'}">${a.published ? 'Tayang' : 'Draft'}</span>
      </div>`).join('');
  }

  document.addEventListener('click', (e) => {
    const row = e.target.closest('[data-edit]');
    if (row) openEditor(row.dataset.edit, state[row.dataset.edit].find(x => x.id === row.dataset.id));
    const nw = e.target.closest('[data-new]');
    if (nw) openEditor(nw.dataset.new, null);
    if (e.target.closest('[data-close-drawer]')) closeEditor();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#drawer').hidden) closeEditor(); });

  function closeEditor() { $('#drawer').hidden = true; editing = null; document.body.style.overflow = ''; }

  function openEditor(kind, row) {
    editing = { kind, row };
    const form = $('#editor');
    $('#editorTitle').textContent = `${row ? 'Edit' : 'Tambah'} ${kind === 'portfolio' ? 'karya' : 'artikel'}`;
    $('#deleteBtn').hidden = !row;
    $('#editorBody').innerHTML = kind === 'portfolio' ? portfolioForm(row || {}) : articleForm(row || {});
    $('#drawer').hidden = false; document.body.style.overflow = 'hidden';
    mountLangTabs(form, 'title');
    (kind === 'portfolio' ? wirePortfolio : wireArticle)(form, row);
    $('#editorBody').scrollTop = 0;
  }

  /* ---------- Portfolio form ---------- */
  function portfolioForm(w) {
    const cats = w.categories || [];
    return `
      <div class="editor-preview">
        <div class="card-preview" id="pv"></div>
        <div class="box"><b>Konten</b>
          ${i18nField('title', 'Judul', w.title)}
          ${i18nField('description', 'Deskripsi', w.description, { type: 'textarea' })}
          ${i18nField('features', 'Fitur', w.features, { type: 'textarea', ph: 'Satu fitur per baris' })}
        </div>
      </div>
      <div class="box"><b>Kategori</b>
        <div class="checks">${window.PORTFOLIO_CATEGORIES.map(c => `<label><input type="checkbox" name="cat" value="${c}" ${cats.includes(c) ? 'checked' : ''}> ${CAT_LABEL[c]}</label>`).join('')}</div>
      </div>
      <div class="box"><b>Gambar</b>
        <p class="hint">Unggah foto/mockup desain (rasio 4:5 ideal). Jika kosong, kartu otomatis dibuat dari data “Kartu otomatis”.</p>
        <div class="upload"><input type="file" accept="image/*"></div>
        <label>atau URL gambar<input name="image_url" value="${esc(w.image_url || '')}" placeholder="https://…"></label>
      </div>
      <div class="box"><b>Kartu otomatis</b>
        <div class="grid2">
          <label>Tema<select name="theme">${window.PORTFOLIO_THEMES.map(t => `<option ${t === (w.theme || 'ivory') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label>Teks kecil atas<input name="kicker" value="${esc(w.kicker || '')}" placeholder="The Wedding of"></label>
          <label>Nama<input name="names" value="${esc(w.names || '')}" placeholder="Alya & Raka"></label>
          <label>Tanggal<input name="event_date" value="${esc(w.event_date || '')}" placeholder="12 · 12 · 2026"></label>
          <label>Lokasi<input name="place" value="${esc(w.place || '')}" placeholder="Bandung"></label>
        </div>
      </div>
      <div class="box"><b>Lainnya</b>
        <div class="grid2">
          <label>Slug (URL unik)<input name="slug" value="${esc(w.slug || '')}" placeholder="otomatis dari judul"></label>
          <label>Link demo undangan<input name="demo_url" value="${esc(w.demo_url || '')}" placeholder="https://alyaraka.com"></label>
          <label>Urutan<input name="sort_order" type="number" value="${w.sort_order ?? (state.portfolio.length + 1)}"></label>
          <label style="align-self:end;display:flex;gap:8px;align-items:center"><input type="checkbox" name="published" ${w.published !== false ? 'checked' : ''}> Tayang di website</label>
        </div>
      </div>`;
  }
  function wirePortfolio(form, row) {
    const preview = () => {
      const f = form.elements;
      $('#pv').innerHTML = f.image_url.value.trim()
        ? `<img src="${esc(f.image_url.value.trim())}" alt="">`
        : design({ theme: f.theme.value, kicker: f.kicker.value, names: f.names.value, event_date: f.event_date.value, place: f.place.value });
    };
    if (form._md) { form.removeEventListener('langchange', form._md); form._md = null; }
    form.oninput = preview; preview();
    bindUpload(form, 'image_url', 'portfolio', preview);
    autoSlug(form, row);
  }

  /* ---------- Article form ---------- */
  function articleForm(a) {
    const date = (a.published_at || new Date().toISOString()).slice(0, 10);
    return `
      <div class="box"><b>Konten</b>
        ${i18nField('title', 'Judul', a.title)}
        ${i18nField('excerpt', 'Ringkasan', a.excerpt, { type: 'textarea' })}
        ${i18nField('content', 'Isi artikel', a.content, { type: 'textarea', cls: 'tall', ph: 'Tulis dengan format Markdown…' })}
        <div class="md-help"><b>Format:</b> <code>## Subjudul</code> · <code>**tebal**</code> · <code>*miring*</code> · <code>- daftar</code> · <code>[teks](https://link)</code> · <code>![alt](url-gambar)</code> · <code>&gt; kutipan</code></div>
        <div><button type="button" class="btn btn--ghost btn--sm" id="togglePreview">Pratinjau</button></div>
        <div class="preview-pane prose" id="mdPreview" hidden></div>
      </div>
      <div class="box"><b>Cover</b>
        <div class="cover-preview" id="cv"></div>
        <div class="upload"><input type="file" accept="image/*"></div>
        <label>atau URL gambar<input name="cover_url" value="${esc(a.cover_url || '')}" placeholder="https://…"></label>
      </div>
      <div class="box"><b>Publikasi</b>
        <div class="grid2">
          <label>Slug (URL)<input name="slug" value="${esc(a.slug || '')}" placeholder="otomatis dari judul"></label>
          <label>Tanggal terbit<input name="published_at" type="date" value="${date}"></label>
          <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="published" ${a.published ? 'checked' : ''}> Tayang di website</label>
        </div>
      </div>`;
  }
  function wireArticle(form, row) {
    const cover = () => {
      const u = form.elements.cover_url.value.trim();
      $('#cv').innerHTML = u ? `<img src="${esc(u)}" alt="">` : 'Belum ada cover';
    };
    const md = () => {
      const pane = $('#mdPreview'); if (pane.hidden) return;
      pane.innerHTML = markdown(form.elements[`content.${form.dataset.lang}`].value) || '<p class="hint">Kosong</p>';
    };
    form.oninput = () => { cover(); md(); };
    if (form._md) form.removeEventListener('langchange', form._md);
    form._md = md; form.addEventListener('langchange', md);
    $('#togglePreview').onclick = () => { const p = $('#mdPreview'); p.hidden = !p.hidden; md(); };
    cover();
    bindUpload(form, 'cover_url', 'articles', cover);
    autoSlug(form, row);
  }

  function autoSlug(form, row) {
    const slug = form.elements.slug, title = form.elements['title.id'];
    let manual = !!row?.slug;
    slug.addEventListener('input', () => { manual = !!slug.value; });
    title.addEventListener('input', () => { if (!manual) slug.value = slugify(title.value); });
  }

  /* ---------- Save / delete ---------- */
  $('#editor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target, f = form.elements, { kind, row } = editing;
    const title = readI18n(form, 'title');
    if (!title.id && !title.en && !title.ms) return toast('Judul wajib diisi minimal satu bahasa.', true);
    const slug = slugify(f.slug.value || idText(title));
    if (!slug) return toast('Slug tidak valid.', true);

    let payload;
    if (kind === 'portfolio') {
      payload = {
        slug, title,
        description: readI18n(form, 'description'),
        features: readI18n(form, 'features', true),
        categories: $$('input[name="cat"]:checked', form).map(c => c.value),
        theme: f.theme.value, kicker: f.kicker.value.trim(), names: f.names.value.trim(),
        event_date: f.event_date.value.trim(), place: f.place.value.trim(),
        image_url: f.image_url.value.trim() || null, demo_url: f.demo_url.value.trim() || null,
        sort_order: Number(f.sort_order.value) || 0, published: f.published.checked,
      };
    } else {
      payload = {
        slug, title,
        excerpt: readI18n(form, 'excerpt'),
        content: readI18n(form, 'content'),
        cover_url: f.cover_url.value.trim() || null,
        published_at: f.published_at.value ? new Date(f.published_at.value).toISOString() : new Date().toISOString(),
        published: f.published.checked,
      };
    }
    const q = row ? sb.from(kind).update(payload).eq('id', row.id) : sb.from(kind).insert(payload);
    const { error } = await q;
    if (error) return toast(error.code === '23505' ? 'Slug sudah dipakai, ganti slug lain.' : error.message, true);
    toast('Tersimpan ✓');
    closeEditor();
    kind === 'portfolio' ? loadPortfolio() : loadArticles();
  });

  $('#deleteBtn').addEventListener('click', async () => {
    const { kind, row } = editing;
    if (!row || !confirm(`Hapus "${idText(row.title)}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const { error } = await sb.from(kind).delete().eq('id', row.id);
    if (error) return toast(error.message, true);
    toast('Dihapus');
    closeEditor();
    kind === 'portfolio' ? loadPortfolio() : loadArticles();
  });

  /* ================= APPEARANCE ================= */
  const sForm = $('#settingsForm');
  $('#fontChoices').innerHTML = Object.entries(window.FONT_PRESETS).map(([key, p]) => `
    <label class="font-opt">
      <input type="radio" name="font" value="${key}">
      <span class="s" style="font-family:${esc(p.serif)}">Alya &amp; <em>Raka</em></span>
      <span class="b" style="font-family:${esc(p.sans)}">Undangan elegan untuk momen spesial.</span>
      <small>${esc(p.label)}</small>
    </label>`).join('');
  $$('[data-swatch]').forEach(b => b.addEventListener('click', () => { $('#accent').value = b.dataset.swatch; }));
  const heroGroups = () => {
    $('[data-i18n-group="hero_title"]', sForm).innerHTML = i18nField('hero_title', 'Judul hero', current.hero_title, { ph: 'Kosong = teks bawaan' });
    $('[data-i18n-group="hero_subtitle"]', sForm).innerHTML = i18nField('hero_subtitle', 'Deskripsi hero', current.hero_subtitle, { type: 'textarea', ph: 'Kosong = teks bawaan' });
  };
  let current = structuredClone(window.DEFAULT_SETTINGS);

  async function loadSettings() {
    const { data, error } = await sb.from('settings').select('value').eq('key', 'site').maybeSingle();
    if (error) toast('Gagal memuat tampilan: ' + error.message, true);
    const v = data?.value || {};
    current = { ...window.DEFAULT_SETTINGS, ...v, sections: { ...window.DEFAULT_SETTINGS.sections, ...(v.sections || {}) } };
    const f = sForm.elements;
    (sForm.querySelector(`input[name="font"][value="${current.font}"]`) || sForm.querySelector('input[name="font"]')).checked = true;
    f.accent.value = current.accent || '#C9A45C';
    f.wa_number.value = current.wa_number || '';
    f.instagram.value = current.instagram || '';
    Object.entries(current.sections).forEach(([k, on]) => { if (f[`sec_${k}`]) f[`sec_${k}`].checked = on; });
    heroGroups();
    mountLangTabs(sForm);
  }
  $('#saveSettings').addEventListener('click', async () => {
    const f = sForm.elements;
    const value = {
      font: f.font.value || 'modern',
      accent: f.accent.value,
      wa_number: f.wa_number.value.replace(/\D/g, ''),
      instagram: f.instagram.value.trim().replace(/^@/, ''),
      hero_title: readI18n(sForm, 'hero_title'),
      hero_subtitle: readI18n(sForm, 'hero_subtitle'),
      sections: Object.fromEntries(Object.keys(window.DEFAULT_SETTINGS.sections).map(k => [k, !!f[`sec_${k}`]?.checked])),
    };
    const { error } = await sb.from('settings').upsert({ key: 'site', value });
    if (error) return toast(error.message, true);
    current = value;
    toast('Tampilan tersimpan ✓ — refresh website untuk melihat perubahan');
  });

  boot();
})();
