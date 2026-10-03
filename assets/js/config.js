/* Invitinity — public config.
   The Supabase publishable key is safe to expose in the browser; access is
   controlled by Row Level Security (see supabase/schema.sql). Never put the
   secret / service_role key here. */
window.INVITINITY_CONFIG = {
  supabaseUrl: 'https://pffgubeyuslkzueoxnzf.supabase.co',
  supabaseKey: 'sb_publishable_4LEZiWgAbCv5Sl1iExzDuw_WdX2OhiZ',
  defaultLang: 'id',          // 'id' | 'en' | 'ms'
  mediaBucket: 'media',
};
