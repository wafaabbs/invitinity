/* Invitinity demo invitations — shared behaviour:
   opening cover with guest name (?to=Nama), countdown, calendar link, copy account number,
   RSVP that composes a WhatsApp message, guest wishes (kept in this browser), reveal on scroll. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  /* Guest name from the link: .../maharani/?to=Budi%20Santoso */
  const guest = (new URLSearchParams(location.search).get('to') || '').trim().slice(0, 60);
  $$('[data-guest]').forEach(el => { el.textContent = guest || el.dataset.guest; });

  /* Opening cover */
  document.documentElement.classList.add('is-locked');
  $('#openInvite')?.addEventListener('click', () => {
    document.body.classList.add('is-open');
    document.documentElement.classList.remove('is-locked');
    scrollTo(0, 0);
    setTimeout(() => { $('#cover').hidden = true; }, 1000);
  });

  /* Countdown */
  const cd = $('[data-countdown]');
  if (cd) {
    const target = new Date(cd.dataset.countdown).getTime();
    const parts = $$('b', cd);
    const tick = () => {
      let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
      const v = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
      parts.forEach((b, i) => { b.textContent = String(v[i]).padStart(2, '0'); });
      if (!s) { clearInterval(timer); cd.insertAdjacentHTML('afterend', '<p class="muted">Acara telah berlangsung. Terima kasih atas doa restunya.</p>'); }
    };
    const timer = setInterval(tick, 1000); tick();
  }

  /* Google Calendar link */
  $$('[data-cal]').forEach(a => {
    const d = a.dataset;
    const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const q = new URLSearchParams({ action: 'TEMPLATE', text: d.cal, dates: `${fmt(d.calStart)}/${fmt(d.calEnd)}`, location: d.calPlace || '', details: location.href.split('?')[0] });
    a.href = `https://calendar.google.com/calendar/render?${q}`;
    a.target = '_blank'; a.rel = 'noopener';
  });

  /* Copy account number */
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const label = b.textContent;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Tersalin ✓'; }
    catch { b.textContent = b.dataset.copy; }
    setTimeout(() => { b.textContent = label; }, 1800);
  }));

  /* Wishes (demo: stored only in this browser) */
  const wishList = $('#wishes');
  const KEY = `inv_demo_wishes_${location.pathname}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wishHtml = (w) => `<div class="wish"><b>${esc(w.name)}</b><small>${esc(w.att)}</small><p>${esc(w.msg)}</p></div>`;
  if (wishList) (store.get(KEY) || []).forEach(w => wishList.insertAdjacentHTML('afterbegin', wishHtml(w)));

  /* RSVP → WhatsApp */
  const form = $('#rsvp');
  if (form && guest && !form.elements.name.value) form.elements.name.value = guest;
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form.elements;
    const name = f.name.value.trim(), att = f.attend.value, pax = f.pax?.value || '1', msg = f.msg.value.trim();
    if (!name) return f.name.focus();
    const host = form.dataset.host || 'mempelai';
    const text = `Halo ${host}, saya ${name}.\nKonfirmasi kehadiran: ${att}${att === 'Hadir' ? ` (${pax} orang)` : ''}.${msg ? `\n\nUcapan: ${msg}` : ''}`;
    if (msg && wishList) {
      const w = { name, att, msg };
      wishList.insertAdjacentHTML('afterbegin', wishHtml(w));
      store.set(KEY, [...(store.get(KEY) || []), w].slice(-20));
    }
    open(`https://wa.me/${(form.dataset.wa || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    f.msg.value = '';
  });

  /* Reveal on scroll */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 })
    : null;
  $$('.rv').forEach(el => io ? io.observe(el) : el.classList.add('in'));
})();
