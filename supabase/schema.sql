-- =====================================================================
-- INVITINITY — Supabase schema
-- Jalankan sekali di: Supabase Dashboard → SQL Editor → New query → Run.
-- Aman dijalankan ulang (idempotent).
--
-- SEBELUM RUN: ganti email admin di bagian "ADMIN" paling bawah.
-- =====================================================================

-- ---------- Admins ----------
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins
  for select to authenticated using (public.is_admin());

-- ---------- Settings (tampilan website) ----------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;

drop policy if exists "settings public read" on public.settings;
create policy "settings public read" on public.settings for select using (true);
drop policy if exists "settings admin write" on public.settings;
create policy "settings admin write" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Portfolio ----------
create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title jsonb not null default '{}'::jsonb,        -- {"id": "...", "en": "...", "ms": "..."}
  description jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,     -- {"id": ["..."], "en": [...], "ms": [...]}
  categories text[] not null default '{}',         -- wedding | birthday | corporate | minimalist | luxury
  theme text not null default 'ivory',             -- tampilan kartu jika tidak ada gambar
  kicker text, names text, event_date text, place text,
  image_url text,
  demo_url text,
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.portfolio enable row level security;

drop policy if exists "portfolio public read" on public.portfolio;
create policy "portfolio public read" on public.portfolio for select
  using (published or public.is_admin());
drop policy if exists "portfolio admin write" on public.portfolio;
create policy "portfolio admin write" on public.portfolio for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Articles ----------
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title jsonb not null default '{}'::jsonb,
  excerpt jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,      -- Markdown per bahasa
  cover_url text,
  published boolean not null default false,
  published_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.articles enable row level security;

drop policy if exists "articles public read" on public.articles;
create policy "articles public read" on public.articles for select
  using (published or public.is_admin());
drop policy if exists "articles admin write" on public.articles;
create policy "articles admin write" on public.articles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- updated_at trigger ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_settings on public.settings;
create trigger trg_touch_settings before update on public.settings for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_portfolio on public.portfolio;
create trigger trg_touch_portfolio before update on public.portfolio for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_articles on public.articles;
create trigger trg_touch_articles before update on public.articles for each row execute function public.touch_updated_at();

-- ---------- Storage: bucket "media" untuk gambar portfolio & artikel ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media admin insert" on storage.objects;
create policy "media admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media admin update" on storage.objects;
create policy "media admin update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- ---------- Newsletter subscribers ----------
-- Pengunjung boleh mendaftar (insert), tapi hanya admin yang bisa melihat/menghapus.
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  lang text check (lang in ('id', 'en', 'ms')),
  created_at timestamptz not null default now()
);
alter table public.subscribers enable row level security;

drop policy if exists "subscribers public insert" on public.subscribers;
create policy "subscribers public insert" on public.subscribers for insert to anon, authenticated
  with check (true);
drop policy if exists "subscribers admin read" on public.subscribers;
create policy "subscribers admin read" on public.subscribers for select to authenticated using (public.is_admin());
drop policy if exists "subscribers admin delete" on public.subscribers;
create policy "subscribers admin delete" on public.subscribers for delete to authenticated using (public.is_admin());

-- ---------- Statistik pengunjung ----------
-- Dicatat oleh assets/js/track.js (halaman publik saja). Pengunjung hanya boleh insert;
-- membaca & menghapus khusus admin. IP tidak disimpan — hanya kota/negara hasil geolokasi.
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  visitor_id text not null check (length(visitor_id) <= 64),
  session_id text check (length(session_id) <= 64),
  path text not null check (length(path) <= 300),
  referrer text check (length(referrer) <= 200),
  lang text check (length(lang) <= 8),
  device text check (device in ('mobile', 'tablet', 'desktop')),
  browser text check (length(browser) <= 40),
  os text check (length(os) <= 40),
  country text check (length(country) <= 80),
  country_code text check (length(country_code) <= 2),
  region text check (length(region) <= 80),
  city text check (length(city) <= 80),
  timezone text check (length(timezone) <= 60)
);
create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
alter table public.page_views enable row level security;

drop policy if exists "page_views public insert" on public.page_views;
create policy "page_views public insert" on public.page_views for insert to anon, authenticated with check (true);
drop policy if exists "page_views admin read" on public.page_views;
create policy "page_views admin read" on public.page_views for select to authenticated using (public.is_admin());
drop policy if exists "page_views admin delete" on public.page_views;
create policy "page_views admin delete" on public.page_views for delete to authenticated using (public.is_admin());

-- ---------- Riwayat error website ----------
create table if not exists public.error_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('error', 'promise', 'resource', 'supabase')),
  message text not null check (length(message) <= 1000),
  path text check (length(path) <= 300),
  source text check (length(source) <= 300),
  line int,
  col int,
  stack text check (length(stack) <= 4000),
  browser text check (length(browser) <= 40),
  os text check (length(os) <= 40),
  device text check (device in ('mobile', 'tablet', 'desktop')),
  visitor_id text check (length(visitor_id) <= 64)
);
create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);
alter table public.error_logs enable row level security;

drop policy if exists "error_logs public insert" on public.error_logs;
create policy "error_logs public insert" on public.error_logs for insert to anon, authenticated with check (true);
drop policy if exists "error_logs admin read" on public.error_logs;
create policy "error_logs admin read" on public.error_logs for select to authenticated using (public.is_admin());
drop policy if exists "error_logs admin delete" on public.error_logs;
create policy "error_logs admin delete" on public.error_logs for delete to authenticated using (public.is_admin());

-- Ringkasan untuk dashboard CMS (dihitung di database, waktu WIB).
create or replace function public.visitor_stats(p_days int default 30)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  tz constant text := 'Asia/Jakarta';
  n int := greatest(1, least(coalesce(p_days, 30), 365));
  first_day date := (now() at time zone tz)::date - (n - 1);
  since timestamptz := first_day::timestamp at time zone tz;
  today timestamptz := (now() at time zone tz)::date::timestamp at time zone tz;
  result jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  with v as (select * from public.page_views where created_at >= since)
  select jsonb_build_object(
    'views',          (select count(*) from v),
    'visitors',       (select count(distinct visitor_id) from v),
    'sessions',       (select count(distinct session_id) from v),
    'today_views',    (select count(*) from v where created_at >= today),
    'today_visitors', (select count(distinct visitor_id) from v where created_at >= today),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'views', d.views, 'visitors', d.visitors) order by d.day), '[]'::jsonb)
      from (
        select g::date as day, count(v.id) as views, count(distinct v.visitor_id) as visitors
        from generate_series(first_day, (now() at time zone tz)::date, interval '1 day') g
        left join v on (v.created_at at time zone tz)::date = g::date
        group by g
      ) d
    ),
    'pages',     (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select path as label, count(*) as views, count(distinct visitor_id) as visitors from v group by path order by 2 desc limit 10) x),
    'referrers', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select referrer as label, count(*) as views, count(distinct visitor_id) as visitors from v where referrer is not null group by referrer order by 2 desc limit 10) x),
    'countries', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select coalesce(country, 'Tidak diketahui') as label, country_code as code, count(*) as views, count(distinct visitor_id) as visitors from v group by country, country_code order by 4 desc limit 10) x),
    'cities',    (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select concat_ws(', ', city, nullif(region, city), country) as label, count(*) as views, count(distinct visitor_id) as visitors from v where city is not null group by city, region, country order by 3 desc limit 15) x),
    'devices',   (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select coalesce(device, 'lainnya') as label, count(*) as views, count(distinct visitor_id) as visitors from v group by device order by 3 desc) x),
    'browsers',  (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select coalesce(browser, 'Lainnya') as label, count(*) as views, count(distinct visitor_id) as visitors from v group by browser order by 3 desc limit 8) x),
    'langs',     (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select coalesce(upper(lang), '-') as label, count(*) as views, count(distinct visitor_id) as visitors from v group by lang order by 3 desc) x)
  ) into result;
  return result;
end;
$$;
revoke all on function public.visitor_stats(int) from public, anon;
grant execute on function public.visitor_stats(int) to authenticated;

-- =====================================================================
-- SEED DATA
-- =====================================================================

-- Settings
insert into public.settings (key, value) values ('site', '{"font":"system","accent":"#701c45","wa_number":"","instagram":"invitinity","hero_title":{"id":"","en":"","ms":""},"hero_subtitle":{"id":"","en":"","ms":""},"sections":{"testimonials":true,"packages":true,"articles":true,"instagram":true,"faq":true}}'::jsonb) on conflict (key) do nothing;

-- Upgrade: pindahkan setting lama (Playfair + gold) ke tema Warm Boutique (Cormorant + Jost, cokelat).
-- Hanya berlaku jika setting belum pernah diubah dari bawaan lama.
update public.settings
set value = value || '{"font":"warm","accent":"#6B4A35"}'::jsonb
where key = 'site' and value->>'font' = 'modern' and value->>'accent' = '#C9A45C';

-- Upgrade: Warm Boutique (cokelat) → plum + putih, font sistem (logo tetap Cormorant).
-- Hanya berlaku jika setting belum pernah diubah dari bawaan Warm Boutique.
update public.settings
set value = value || '{"font":"system","accent":"#701c45"}'::jsonb
where key = 'site' and value->>'font' = 'warm' and value->>'accent' = '#6B4A35';

-- Portfolio
insert into public.portfolio (slug,title,description,features,categories,theme,kicker,names,event_date,place,sort_order,published) values ('ethereal-bloom','{"id":"Ethereal Bloom","en":"Ethereal Bloom","ms":"Ethereal Bloom"}'::jsonb,'{"id":"Nuansa romantis dengan bingkai lengkung, palet blush dan aksen champagne gold.","en":"A romantic feel with an arch frame, blush palette and champagne gold accents.","ms":"Suasana romantik dengan bingkai melengkung, palet merah jambu lembut dan aksen emas champagne."}'::jsonb,'{"id":["Animasi pembuka amplop","Love story timeline","RSVP & ucapan tamu"],"en":["Envelope opening animation","Love story timeline","RSVP & guest wishes"],"ms":["Animasi pembukaan sampul","Garis masa kisah cinta","RSVP & ucapan tetamu"]}'::jsonb,array['wedding','luxury']::text[],'bloom','The Wedding of','Alya & Raka','12 · 12 · 2026','Bandung',1,true) on conflict (slug) do nothing;
insert into public.portfolio (slug,title,description,features,categories,theme,kicker,names,event_date,place,sort_order,published) values ('noir-gold','{"id":"Noir Gold","en":"Noir Gold","ms":"Noir Gold"}'::jsonb,'{"id":"Hitam pekat dan emas untuk resepsi malam yang dramatis dan berkelas.","en":"Deep black and gold for a dramatic, refined evening reception.","ms":"Hitam pekat dan emas untuk majlis resepsi malam yang dramatik dan berkelas."}'::jsonb,'{"id":["Tema dark luxury","Countdown & Google Maps","Amplop digital"],"en":["Dark luxury theme","Countdown & Google Maps","Digital gift"],"ms":["Tema mewah gelap","Kiraan detik & Google Maps","Salam kaut digital"]}'::jsonb,array['wedding','luxury']::text[],'noir','Save the Date','Kirana & Bima','07 · 03 · 2027','Jakarta',2,true) on conflict (slug) do nothing;
insert into public.portfolio (slug,title,description,features,categories,theme,kicker,names,event_date,place,sort_order,published) values ('pure-line','{"id":"Pure Line","en":"Pure Line","ms":"Pure Line"}'::jsonb,'{"id":"Minimalis, bersih, dan editorial. Tipografi menjadi pusat perhatian.","en":"Minimal, clean and editorial. Typography takes centre stage.","ms":"Minimalis, bersih dan editorial. Tipografi menjadi tumpuan."}'::jsonb,'{"id":["Layout editorial","RSVP & daftar tamu","Musik latar"],"en":["Editorial layout","RSVP & guest list","Background music"],"ms":["Susun atur editorial","RSVP & senarai tetamu","Muzik latar"]}'::jsonb,array['wedding','minimalist']::text[],'line','We are getting married','Laras & Yoga','18 · 04 · 2027','Yogyakarta',3,true) on conflict (slug) do nothing;
insert into public.portfolio (slug,title,description,features,categories,theme,kicker,names,event_date,place,sort_order,published) values ('sweet-seventeen','{"id":"Sweet Seventeen","en":"Sweet Seventeen","ms":"Sweet Seventeen"}'::jsonb,'{"id":"Lembut, feminin, dan playful untuk pesta ulang tahun yang berkesan.","en":"Soft, feminine and playful for a memorable birthday party.","ms":"Lembut, feminin dan ceria untuk parti hari jadi yang bermakna."}'::jsonb,'{"id":["Tema pastel elegan","Dress code & rundown","RSVP via link"],"en":["Elegant pastel theme","Dress code & rundown","RSVP by link"],"ms":["Tema pastel elegan","Kod pakaian & aturcara","RSVP melalui pautan"]}'::jsonb,array['birthday']::text[],'blush','You’re invited to','Anisa’s Sweet Seventeen','21 · 06 · 2026','Surabaya',4,true) on conflict (slug) do nothing;
insert into public.portfolio (slug,title,description,features,categories,theme,kicker,names,event_date,place,sort_order,published) values ('annual-gala','{"id":"Annual Gala","en":"Annual Gala","ms":"Annual Gala"}'::jsonb,'{"id":"Undangan korporat premium untuk gala dinner dan awarding night.","en":"Premium corporate invitation for gala dinners and awarding nights.","ms":"Jemputan korporat premium untuk makan malam gala dan malam anugerah."}'::jsonb,'{"id":["Branding perusahaan","Registrasi tamu","Rundown acara"],"en":["Company branding","Guest registration","Event rundown"],"ms":["Penjenamaan syarikat","Pendaftaran tetamu","Aturcara majlis"]}'::jsonb,array['corporate','luxury']::text[],'gala','An evening of celebration','Annual Gala Night','15 · 11 · 2026','The Grand Ballroom',5,true) on conflict (slug) do nothing;
insert into public.portfolio (slug,title,description,features,categories,theme,kicker,names,event_date,place,sort_order,published) values ('velvet-burgundy','{"id":"Velvet Burgundy","en":"Velvet Burgundy","ms":"Velvet Burgundy"}'::jsonb,'{"id":"Burgundy yang hangat dan intim dengan aksen emas. Mewah tanpa berlebihan.","en":"Warm, intimate burgundy with gold accents. Luxurious without excess.","ms":"Burgundy yang hangat dan intim dengan aksen emas. Mewah tanpa berlebihan."}'::jsonb,'{"id":["Palet burgundy & gold","Opening sinematik","Kartu cetak serasi"],"en":["Burgundy & gold palette","Cinematic opening","Matching printed card"],"ms":["Palet burgundy & emas","Pembukaan sinematik","Kad bercetak sepadan"]}'::jsonb,array['wedding','luxury']::text[],'velvet','Together with their families','Nadia & Fikri','20 · 02 · 2027','Kuala Lumpur',6,true) on conflict (slug) do nothing;
insert into public.portfolio (slug,title,description,features,categories,theme,kicker,names,event_date,place,sort_order,published) values ('little-star','{"id":"Little Star","en":"Little Star","ms":"Little Star"}'::jsonb,'{"id":"Ulang tahun pertama si kecil dengan sentuhan minimalis dan hangat.","en":"A little one’s first birthday with a warm, minimal touch.","ms":"Hari jadi pertama si kecil dengan sentuhan minimalis dan hangat."}'::jsonb,'{"id":["Desain clean & hangat","Lokasi & waktu","Galeri foto"],"en":["Clean, warm design","Venue & time","Photo gallery"],"ms":["Reka bentuk bersih & hangat","Lokasi & masa","Galeri foto"]}'::jsonb,array['birthday','minimalist']::text[],'star','Join us to celebrate','Arka turns One','09 · 08 · 2026','Malang',7,true) on conflict (slug) do nothing;
insert into public.portfolio (slug,title,description,features,categories,theme,kicker,names,event_date,place,sort_order,published) values ('product-launch','{"id":"Product Launch","en":"Product Launch","ms":"Product Launch"}'::jsonb,'{"id":"Undangan peluncuran produk yang modern dan on-brand.","en":"A modern, on-brand product launch invitation.","ms":"Jemputan pelancaran produk yang moden dan selari dengan jenama."}'::jsonb,'{"id":["Layout sesuai brand","Registrasi tamu","Agenda & pembicara"],"en":["Brand-consistent layout","Guest registration","Agenda & speakers"],"ms":["Susun atur ikut jenama","Pendaftaran tetamu","Agenda & penceramah"]}'::jsonb,array['corporate','minimalist']::text[],'launch','Exclusive invitation','The New Collection','02 · 10 · 2026','Senayan, Jakarta',8,true) on conflict (slug) do nothing;
insert into public.portfolio (slug,title,description,features,categories,theme,kicker,names,event_date,place,sort_order,published) values ('sakinah','{"id":"Sakinah","en":"Sakinah","ms":"Sakinah"}'::jsonb,'{"id":"Elegan dan teduh untuk akad & resepsi, dengan ruang untuk ayat dan doa.","en":"Elegant and serene for the akad & reception, with space for verses and prayers.","ms":"Elegan dan tenang untuk akad nikah & resepsi, dengan ruang untuk ayat dan doa."}'::jsonb,'{"id":["Akad & resepsi terpisah","Ayat & doa pilihan","RSVP & ucapan"],"en":["Separate akad & reception","Selected verses & prayers","RSVP & wishes"],"ms":["Akad & resepsi berasingan","Ayat & doa pilihan","RSVP & ucapan"]}'::jsonb,array['wedding','minimalist']::text[],'sakinah','Walimatul ‘Ursy','Zahra & Hanif','14 · 01 · 2027','Johor Bahru',9,true) on conflict (slug) do nothing;

-- Articles
insert into public.articles (slug,title,excerpt,content,published,published_at) values ('tips-memilih-undangan-digital','{"id":"5 Tips Memilih Undangan Digital yang Elegan","en":"5 Tips for Choosing an Elegant Digital Invitation","ms":"5 Tip Memilih Kad Jemputan Digital yang Elegan"}'::jsonb,'{"id":"Undangan digital adalah kesan pertama acaramu. Ini lima hal yang perlu diperhatikan sebelum memilih desain.","en":"A digital invitation is your event’s first impression. Here are five things to consider before choosing a design.","ms":"Kad jemputan digital ialah tanggapan pertama majlis anda. Berikut lima perkara yang perlu diberi perhatian sebelum memilih reka bentuk."}'::jsonb,'{"id":"Undangan digital bukan sekadar link berisi tanggal dan lokasi. Ia adalah kesan pertama tamu terhadap acaramu.\n\n## 1. Sesuaikan dengan karakter acara\nPilih palet warna dan tipografi yang mencerminkan suasana acara: klasik, modern, atau intimate.\n\n## 2. Utamakan keterbacaan\nDesain yang indah tetap harus mudah dibaca di layar ponsel. Pastikan ukuran huruf dan kontras cukup.\n\n## 3. Pilih fitur yang benar-benar dibutuhkan\n- RSVP untuk menghitung tamu\n- Peta lokasi\n- Galeri foto dan love story\n\n## 4. Gunakan nama domain sendiri\nLink seperti **alyaraka.com** terasa lebih personal dan mudah diingat. Di Invitinity, custom domain sudah **gratis** di setiap paket.\n\n## 5. Siapkan data lebih awal\nNama lengkap, jadwal acara, dan foto terbaik akan mempercepat proses desain.","en":"A digital invitation is more than a link with a date and a venue. It is your guests’ first impression of your event.\n\n## 1. Match the character of your event\nChoose a colour palette and typography that reflect the mood: classic, modern or intimate.\n\n## 2. Prioritise readability\nA beautiful design should still be easy to read on a phone screen. Make sure the type size and contrast are sufficient.\n\n## 3. Choose the features you really need\n- RSVP to count guests\n- Location map\n- Photo gallery and love story\n\n## 4. Use your own domain name\nA link like **alyaraka.com** feels more personal and is easy to remember. At Invitinity, a custom domain is **free** with every package.\n\n## 5. Prepare your details early\nFull names, the schedule and your best photos will speed up the design process.","ms":"Kad jemputan digital bukan sekadar pautan berisi tarikh dan lokasi. Ia ialah tanggapan pertama tetamu terhadap majlis anda.\n\n## 1. Sesuaikan dengan karakter majlis\nPilih palet warna dan tipografi yang mencerminkan suasana majlis: klasik, moden atau intim.\n\n## 2. Utamakan kebolehbacaan\nReka bentuk yang cantik tetap perlu mudah dibaca di skrin telefon. Pastikan saiz huruf dan kontras mencukupi.\n\n## 3. Pilih ciri yang benar-benar diperlukan\n- RSVP untuk mengira tetamu\n- Peta lokasi\n- Galeri foto dan kisah cinta\n\n## 4. Gunakan nama domain sendiri\nPautan seperti **alyaraka.com** terasa lebih peribadi dan mudah diingati. Di Invitinity, domain tersuai adalah **percuma** untuk setiap pakej.\n\n## 5. Sediakan maklumat lebih awal\nNama penuh, jadual majlis dan foto terbaik akan mempercepatkan proses reka bentuk."}'::jsonb,true,'2026-09-20') on conflict (slug) do nothing;
insert into public.articles (slug,title,excerpt,content,published,published_at) values ('digital-atau-cetak','{"id":"Undangan Digital atau Cetak? Ini Bedanya","en":"Digital or Printed Invitations? Here’s the Difference","ms":"Kad Jemputan Digital atau Bercetak? Ini Bezanya"}'::jsonb,'{"id":"Masing-masing punya kelebihan. Banyak pasangan kini memilih keduanya dengan satu identitas visual.","en":"Each has its strengths. Many couples now choose both, with one consistent visual identity.","ms":"Setiap satu ada kelebihannya. Ramai pasangan kini memilih kedua-duanya dengan satu identiti visual."}'::jsonb,'{"id":"## Undangan digital\nPraktis, cepat dibagikan, dan dilengkapi fitur seperti RSVP, peta, dan galeri.\n\n## Undangan cetak\nMemberi pengalaman fisik yang berkesan: kertas premium, amplop, hingga wax seal. Cocok untuk keluarga dan tamu VIP.\n\n## Kenapa tidak keduanya?\nDengan satu identitas visual, undangan digital dan cetak terasa serasi. Tamu menerima kesan yang sama, di mana pun mereka melihatnya.\n\n> Undangan terbaik adalah yang paling sesuai dengan ceritamu.","en":"## Digital invitations\nPractical, quick to share, and equipped with features like RSVP, maps and galleries.\n\n## Printed invitations\nA memorable physical experience: premium paper, envelopes, even a wax seal. Perfect for family and VIP guests.\n\n## Why not both?\nWith one visual identity, your digital and printed invitations feel like a set. Guests get the same impression wherever they see it.\n\n> The best invitation is the one that fits your story.","ms":"## Kad jemputan digital\nPraktikal, pantas dikongsi dan dilengkapi ciri seperti RSVP, peta dan galeri.\n\n## Kad jemputan bercetak\nMemberi pengalaman fizikal yang bermakna: kertas premium, sampul, malah cop lilin. Sesuai untuk keluarga dan tetamu VIP.\n\n## Kenapa tidak kedua-duanya?\nDengan satu identiti visual, jemputan digital dan bercetak terasa sepadan. Tetamu menerima tanggapan yang sama di mana sahaja mereka melihatnya.\n\n> Kad jemputan terbaik ialah yang paling sesuai dengan kisah anda."}'::jsonb,true,'2026-09-05') on conflict (slug) do nothing;

-- =====================================================================
-- ADMIN — ganti dengan email akun admin CMS kamu (huruf kecil semua).
-- Buat juga user dengan email yang sama di: Authentication → Users → Add user.
-- =====================================================================
insert into public.admins (email) values ('GANTI_DENGAN_EMAIL_ADMIN@gmail.com') on conflict do nothing;
