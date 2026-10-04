/* Invitinity article page: article.html (list) and article.html?slug=... (detail). */
(() => {
  const { sb, $, esc, pick, ui, fmtDate, markdown, reveal, onLang } = INV;
  const slug = new URLSearchParams(location.search).get('slug');
  let data = null;

  async function load() {
    if (!sb) return slug ? null : [];
    if (slug) {
      const { data: row, error } = await sb.from('articles').select('*').eq('slug', slug).eq('published', true).maybeSingle();
      if (error) INV.logError?.('supabase', `article: ${error.message}`);
      return error ? null : row;
    }
    const { data: rows, error } = await sb.from('articles').select('slug,title,excerpt,cover_url,published_at')
      .eq('published', true).order('published_at', { ascending: false });
    if (error) INV.logError?.('supabase', `articles: ${error.message}`);
    return error ? [] : rows;
  }

  function render() {
    if (slug) {
      $('#detailView').hidden = false;
      $('#backLabel').textContent = ui('back');
      $('#ctaTitle').textContent = ui('ctaTitle');
      $('#ctaBtn').textContent = ui('ctaBtn');
      if (!data) { $('#aTitle').textContent = ui('notFound'); return; }
      const title = pick(data.title);
      document.title = `${title} | Invitinity`;
      document.querySelector('meta[name="description"]')?.setAttribute('content', pick(data.excerpt));
      $('#aDate').textContent = data.published_at ? fmtDate(data.published_at) : '';
      $('#aTitle').textContent = title;
      $('#aExcerpt').textContent = pick(data.excerpt);
      $('#aCover').hidden = !data.cover_url;
      $('#aCover').innerHTML = data.cover_url ? `<img src="${esc(data.cover_url)}" alt="">` : '';
      $('#aBody').innerHTML = markdown(pick(data.content));
    } else {
      $('#listView').hidden = false;
      $('#allPosts').innerHTML = data?.length ? data.map(INV.postCard).join('') : `<p class="empty">${esc(ui('noArticles'))}</p>`;
      reveal($('#allPosts'));
    }
  }

  INV.init();
  onLang(render);
  load().then(d => { data = d; render(); });
})();
