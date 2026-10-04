-- =====================================================================
-- INVITINITY — Template demo (karya asli Invitinity) → Portofolio
-- Jalankan di: Supabase Dashboard → SQL Editor → New query → Run.
-- Aman dijalankan ulang: template yang sudah ada diperbarui, tidak dobel.
-- Demo & cover ada di repo: demo/<slug>/index.html dan demo/<slug>/cover.jpg
-- =====================================================================

insert into public.portfolio (slug, title, description, features, categories, theme, kicker, names, event_date, place, image_url, demo_url, sort_order, published)
values
(
  'maharani',
  '{"id":"Maharani","en":"Maharani","ms":"Maharani"}'::jsonb,
  '{"id":"Wedding elegan bernuansa plum dan ivory dengan ornamen botanikal yang anggun.","en":"An elegant plum-and-ivory wedding invitation with graceful botanical ornaments.","ms":"Jemputan perkahwinan elegan bertema plum dan ivori dengan hiasan botani yang anggun."}'::jsonb,
  '{"id":["Halaman pembuka dengan nama tamu","Hitung mundur & simpan ke kalender","Love story, galeri & amplop digital","RSVP & ucapan via WhatsApp"],"en":["Opening page with guest name","Countdown & add to calendar","Love story, gallery & digital gift","RSVP & wishes via WhatsApp"],"ms":["Halaman pembuka dengan nama tetamu","Kiraan detik & simpan ke kalendar","Kisah cinta, galeri & salam kaut digital","RSVP & ucapan melalui WhatsApp"]}'::jsonb,
  array['wedding','luxury']::text[], 'velvet', 'The Wedding of', 'Salsabila & Arya', '15 · 05 · 2027', 'Bandung',
  'https://invitinity.my.id/demo/maharani/cover.jpg', 'https://invitinity.my.id/demo/maharani/', -3, true
),
(
  'raudhah',
  '{"id":"Raudhah","en":"Raudhah","ms":"Raudhah"}'::jsonb,
  '{"id":"Pernikahan islami bernuansa hijau zamrud dan krem, lengkap dengan bismillah dan QS. Ar-Rum: 21.","en":"An Islamic wedding invitation in emerald and cream, with the bismillah and QS. Ar-Rum: 21.","ms":"Jemputan perkahwinan Islamik bertema hijau zamrud dan krim, lengkap dengan bismillah dan QS. Ar-Rum: 21."}'::jsonb,
  '{"id":["Akad nikah & walimatul ‘ursy","Ayat Al-Qur’an & terjemahan","Hitung mundur & lokasi","Amplop digital, doa & ucapan"],"en":["Akad nikah & walimatul ‘ursy","Qur’anic verse & translation","Countdown & venue","Digital gift, prayers & wishes"],"ms":["Akad nikah & walimatul ‘urus","Ayat Al-Quran & terjemahan","Kiraan detik & lokasi","Salam kaut digital, doa & ucapan"]}'::jsonb,
  array['wedding','minimalist']::text[], 'sakinah', 'Walimatul ‘Ursy', 'Hana & Faris', '17 · 04 · 2027', 'Yogyakarta',
  'https://invitinity.my.id/demo/raudhah/cover.jpg', 'https://invitinity.my.id/demo/raudhah/', -2, true
),
(
  'langit-biru',
  '{"id":"Langit Biru","en":"Langit Biru","ms":"Langit Biru"}'::jsonb,
  '{"id":"Undangan tasyakuran khitan bernuansa biru langit dengan ornamen awan dan bintang yang ceria.","en":"A sky-blue circumcision celebration invitation with cheerful cloud and star ornaments.","ms":"Jemputan majlis berkhatan bertema biru langit dengan hiasan awan dan bintang yang ceria."}'::jsonb,
  '{"id":["Profil anak & orang tua","Pengajian & ramah tamah","Hitung mundur & lokasi","Doa & ucapan via WhatsApp"],"en":["Child & parents profile","Prayer gathering & reception","Countdown & venue","Prayers & wishes via WhatsApp"],"ms":["Profil anak & ibu bapa","Majlis doa & jamuan","Kiraan detik & lokasi","Doa & ucapan melalui WhatsApp"]}'::jsonb,
  array['family']::text[], 'star', 'Tasyakuran Khitan', 'Muhammad Rayyan', '04 · 07 · 2027', 'Malang',
  'https://invitinity.my.id/demo/langit-biru/cover.jpg', 'https://invitinity.my.id/demo/langit-biru/', -1, true
)
on conflict (slug) do update set
  title = excluded.title, description = excluded.description, features = excluded.features,
  categories = excluded.categories, theme = excluded.theme, kicker = excluded.kicker, names = excluded.names,
  event_date = excluded.event_date, place = excluded.place, image_url = excluded.image_url,
  demo_url = excluded.demo_url, sort_order = excluded.sort_order, published = excluded.published;
