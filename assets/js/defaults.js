/* Shared defaults for the site and the CMS.
   DEFAULT_PORTFOLIO is shown only when Supabase can't be reached (e.g. before
   supabase/schema.sql has been run). The same items are seeded into the DB. */

window.FONT_PRESETS = {
  warm: {
    label: 'Warm Boutique — Cormorant Garamond + Jost',
    serif: '"Cormorant Garamond", Georgia, serif', sans: '"Jost", system-ui, sans-serif',
    href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500;600&display=swap',
  },
  modern: {
    label: 'Modern — Playfair Display + Inter',
    serif: '"Playfair Display", Georgia, serif', sans: '"Inter", system-ui, sans-serif',
    href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap',
  },
  classic: {
    label: 'Classic — Cormorant Garamond + Plus Jakarta Sans',
    serif: '"Cormorant Garamond", Georgia, serif', sans: '"Plus Jakarta Sans", system-ui, sans-serif',
    href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap',
  },
  editorial: {
    label: 'Editorial — Libre Baskerville + Montserrat',
    serif: '"Libre Baskerville", Georgia, serif', sans: '"Montserrat", system-ui, sans-serif',
    href: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@300;400;500;600&display=swap',
  },
  clean: {
    label: 'Clean — DM Serif Display + DM Sans',
    serif: '"DM Serif Display", Georgia, serif', sans: '"DM Sans", system-ui, sans-serif',
    href: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap',
  },
};

window.DEFAULT_SETTINGS = {
  font: 'warm',
  accent: '#6B4A35',
  wa_number: '',
  instagram: 'invitinity',
  hero_title: { id: '', en: '', ms: '' },
  hero_subtitle: { id: '', en: '', ms: '' },
  sections: { testimonials: true, packages: true, articles: true, instagram: true, faq: true },
};

window.PORTFOLIO_THEMES = ['bloom', 'noir', 'line', 'velvet', 'blush', 'gala', 'ivory', 'star', 'launch', 'sakinah'];
window.PORTFOLIO_CATEGORIES = ['wedding', 'birthday', 'corporate', 'minimalist', 'luxury'];

window.DEFAULT_PORTFOLIO = [
  { slug: 'ethereal-bloom', theme: 'bloom', categories: ['wedding', 'luxury'], kicker: 'The Wedding of', names: 'Alya & Raka', event_date: '12 · 12 · 2026', place: 'Bandung', sort_order: 1,
    title: { id: 'Ethereal Bloom', en: 'Ethereal Bloom', ms: 'Ethereal Bloom' },
    description: { id: 'Nuansa romantis dengan bingkai lengkung, palet blush dan aksen champagne gold.', en: 'A romantic feel with an arch frame, blush palette and champagne gold accents.', ms: 'Suasana romantik dengan bingkai melengkung, palet merah jambu lembut dan aksen emas champagne.' },
    features: { id: ['Animasi pembuka amplop', 'Love story timeline', 'RSVP & ucapan tamu'], en: ['Envelope opening animation', 'Love story timeline', 'RSVP & guest wishes'], ms: ['Animasi pembukaan sampul', 'Garis masa kisah cinta', 'RSVP & ucapan tetamu'] } },
  { slug: 'noir-gold', theme: 'noir', categories: ['wedding', 'luxury'], kicker: 'Save the Date', names: 'Kirana & Bima', event_date: '07 · 03 · 2027', place: 'Jakarta', sort_order: 2,
    title: { id: 'Noir Gold', en: 'Noir Gold', ms: 'Noir Gold' },
    description: { id: 'Hitam pekat dan emas untuk resepsi malam yang dramatis dan berkelas.', en: 'Deep black and gold for a dramatic, refined evening reception.', ms: 'Hitam pekat dan emas untuk majlis resepsi malam yang dramatik dan berkelas.' },
    features: { id: ['Tema dark luxury', 'Countdown & Google Maps', 'Amplop digital'], en: ['Dark luxury theme', 'Countdown & Google Maps', 'Digital gift'], ms: ['Tema mewah gelap', 'Kiraan detik & Google Maps', 'Salam kaut digital'] } },
  { slug: 'pure-line', theme: 'line', categories: ['wedding', 'minimalist'], kicker: 'We are getting married', names: 'Laras & Yoga', event_date: '18 · 04 · 2027', place: 'Yogyakarta', sort_order: 3,
    title: { id: 'Pure Line', en: 'Pure Line', ms: 'Pure Line' },
    description: { id: 'Minimalis, bersih, dan editorial. Tipografi menjadi pusat perhatian.', en: 'Minimal, clean and editorial. Typography takes centre stage.', ms: 'Minimalis, bersih dan editorial. Tipografi menjadi tumpuan.' },
    features: { id: ['Layout editorial', 'RSVP & daftar tamu', 'Musik latar'], en: ['Editorial layout', 'RSVP & guest list', 'Background music'], ms: ['Susun atur editorial', 'RSVP & senarai tetamu', 'Muzik latar'] } },
  { slug: 'sweet-seventeen', theme: 'blush', categories: ['birthday'], kicker: 'You’re invited to', names: 'Anisa’s Sweet Seventeen', event_date: '21 · 06 · 2026', place: 'Surabaya', sort_order: 4,
    title: { id: 'Sweet Seventeen', en: 'Sweet Seventeen', ms: 'Sweet Seventeen' },
    description: { id: 'Lembut, feminin, dan playful untuk pesta ulang tahun yang berkesan.', en: 'Soft, feminine and playful for a memorable birthday party.', ms: 'Lembut, feminin dan ceria untuk parti hari jadi yang bermakna.' },
    features: { id: ['Tema pastel elegan', 'Dress code & rundown', 'RSVP via link'], en: ['Elegant pastel theme', 'Dress code & rundown', 'RSVP by link'], ms: ['Tema pastel elegan', 'Kod pakaian & aturcara', 'RSVP melalui pautan'] } },
  { slug: 'annual-gala', theme: 'gala', categories: ['corporate', 'luxury'], kicker: 'An evening of celebration', names: 'Annual Gala Night', event_date: '15 · 11 · 2026', place: 'The Grand Ballroom', sort_order: 5,
    title: { id: 'Annual Gala', en: 'Annual Gala', ms: 'Annual Gala' },
    description: { id: 'Undangan korporat premium untuk gala dinner dan awarding night.', en: 'Premium corporate invitation for gala dinners and awarding nights.', ms: 'Jemputan korporat premium untuk makan malam gala dan malam anugerah.' },
    features: { id: ['Branding perusahaan', 'Registrasi tamu', 'Rundown acara'], en: ['Company branding', 'Guest registration', 'Event rundown'], ms: ['Penjenamaan syarikat', 'Pendaftaran tetamu', 'Aturcara majlis'] } },
  { slug: 'velvet-burgundy', theme: 'velvet', categories: ['wedding', 'luxury'], kicker: 'Together with their families', names: 'Nadia & Fikri', event_date: '20 · 02 · 2027', place: 'Kuala Lumpur', sort_order: 6,
    title: { id: 'Velvet Burgundy', en: 'Velvet Burgundy', ms: 'Velvet Burgundy' },
    description: { id: 'Burgundy yang hangat dan intim dengan aksen emas. Mewah tanpa berlebihan.', en: 'Warm, intimate burgundy with gold accents. Luxurious without excess.', ms: 'Burgundy yang hangat dan intim dengan aksen emas. Mewah tanpa berlebihan.' },
    features: { id: ['Palet burgundy & gold', 'Opening sinematik', 'Kartu cetak serasi'], en: ['Burgundy & gold palette', 'Cinematic opening', 'Matching printed card'], ms: ['Palet burgundy & emas', 'Pembukaan sinematik', 'Kad bercetak sepadan'] } },
  { slug: 'little-star', theme: 'star', categories: ['birthday', 'minimalist'], kicker: 'Join us to celebrate', names: 'Arka turns One', event_date: '09 · 08 · 2026', place: 'Malang', sort_order: 7,
    title: { id: 'Little Star', en: 'Little Star', ms: 'Little Star' },
    description: { id: 'Ulang tahun pertama si kecil dengan sentuhan minimalis dan hangat.', en: 'A little one’s first birthday with a warm, minimal touch.', ms: 'Hari jadi pertama si kecil dengan sentuhan minimalis dan hangat.' },
    features: { id: ['Desain clean & hangat', 'Lokasi & waktu', 'Galeri foto'], en: ['Clean, warm design', 'Venue & time', 'Photo gallery'], ms: ['Reka bentuk bersih & hangat', 'Lokasi & masa', 'Galeri foto'] } },
  { slug: 'product-launch', theme: 'launch', categories: ['corporate', 'minimalist'], kicker: 'Exclusive invitation', names: 'The New Collection', event_date: '02 · 10 · 2026', place: 'Senayan, Jakarta', sort_order: 8,
    title: { id: 'Product Launch', en: 'Product Launch', ms: 'Product Launch' },
    description: { id: 'Undangan peluncuran produk yang modern dan on-brand.', en: 'A modern, on-brand product launch invitation.', ms: 'Jemputan pelancaran produk yang moden dan selari dengan jenama.' },
    features: { id: ['Layout sesuai brand', 'Registrasi tamu', 'Agenda & pembicara'], en: ['Brand-consistent layout', 'Guest registration', 'Agenda & speakers'], ms: ['Susun atur ikut jenama', 'Pendaftaran tetamu', 'Agenda & penceramah'] } },
  { slug: 'sakinah', theme: 'sakinah', categories: ['wedding', 'minimalist'], kicker: 'Walimatul ‘Ursy', names: 'Zahra & Hanif', event_date: '14 · 01 · 2027', place: 'Johor Bahru', sort_order: 9,
    title: { id: 'Sakinah', en: 'Sakinah', ms: 'Sakinah' },
    description: { id: 'Elegan dan teduh untuk akad & resepsi, dengan ruang untuk ayat dan doa.', en: 'Elegant and serene for the akad & reception, with space for verses and prayers.', ms: 'Elegan dan tenang untuk akad nikah & resepsi, dengan ruang untuk ayat dan doa.' },
    features: { id: ['Akad & resepsi terpisah', 'Ayat & doa pilihan', 'RSVP & ucapan'], en: ['Separate akad & reception', 'Selected verses & prayers', 'RSVP & wishes'], ms: ['Akad & resepsi berasingan', 'Ayat & doa pilihan', 'RSVP & ucapan'] } },
];
