# Invitinity

Website premium invitation studio — **invitinity.my.id**
Static site (HTML/CSS/JS, tanpa build) + **Supabase** sebagai database & CMS.

- 3 bahasa: Indonesia (default), English, Bahasa Melayu
- CMS di `/admin`: portofolio, artikel, pelanggan newsletter, statistik pengunjung (termasuk kota/negara), riwayat error, dan tampilan (font, warna, kontak, teks hero, section)
- Desain: plum `#701c45` & putih, font sistem, logo berupa wordmark
- Gambar disimpan di Supabase Storage (bucket `media`)

## Struktur

```
index.html            Halaman utama
article.html          Daftar artikel & detail (article.html?slug=...)
admin/                CMS (login Supabase Auth)
assets/css/style.css  Styling
assets/js/config.js   URL & publishable key Supabase
assets/js/i18n.js     Terjemahan EN & MS (teks ID ada langsung di HTML)
assets/js/defaults.js Pilihan font, setting default, contoh portofolio
assets/js/core.js     Bahasa, setting CMS, helper
assets/js/site.js     Logika halaman utama
assets/js/article.js  Logika halaman artikel
assets/js/track.js    Statistik pengunjung & pencatat error (halaman publik)
supabase/schema.sql   Tabel, RLS, storage, data awal
```

## Setup Supabase (sekali saja)

1. Buka **Supabase Dashboard → SQL Editor → New query**.
2. Salin isi `supabase/schema.sql`, **ganti `GANTI_DENGAN_EMAIL_ADMIN@gmail.com`** (baris paling bawah) dengan email admin, lalu **Run**.
3. **Authentication → Users → Add user** → buat user dengan email yang sama + password (centang *Auto Confirm User*).
4. **Authentication → Sign In / Providers** → matikan *Allow new users to sign up* agar orang lain tidak bisa mendaftar.
5. Buka `/admin`, login, dan mulai kelola konten.

> Sudah pernah menjalankan schema.sql? Jalankan ulang file terbaru — aman (idempotent), menambah tabel yang belum ada (`subscribers`, `page_views`, `error_logs`) dan fungsi `visitor_stats`.

> Menambah admin lain: `insert into public.admins (email) values ('email@domain.com');` lalu buat user-nya di Authentication.

## Menjalankan lokal

Cukup buka `index.html`, atau jalankan server statis:

```bash
npx serve .
```

## Deploy

Semua file statis — bisa di GitHub Pages, Netlify, Vercel, atau Cloudflare Pages tanpa build command (publish directory: root).

## Catatan konten

- Isi **nomor WhatsApp** di CMS → Tampilan. Sebelum diisi, tombol WhatsApp akan meminta pengunjung memilih kontak.
- Testimoni di `index.html` masih contoh — ganti dengan review asli klien.
- Tambahkan `og-image.jpg` (1200×630) di root untuk preview link di media sosial.
- Format artikel memakai Markdown sederhana: `## Subjudul`, `**tebal**`, `*miring*`, `- daftar`, `[teks](url)`, `![alt](gambar)`, `> kutipan`.
