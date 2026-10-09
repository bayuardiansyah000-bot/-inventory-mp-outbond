// ==================== KONEKSI SUPABASE ====================
// Placeholder. Akan diisi pada Tahap 1-2 (integrasi).
//
// Rencana: muat Supabase JS SDK via CDN di index.html, lalu:
//   const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
//
// Fungsi yang akan disediakan di sini:
//   - supabaseClient()  -> mengembalikan instance client
//   - isConfigured()    -> true jika URL & key sudah diisi
//
// Selama config belum diisi, aplikasi tetap jalan dengan mode lokal (localStorage).

function isSupabaseConfigured(){
  var c = window.SUPABASE_CONFIG || {};
  return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY);
}

var _sbClient = null;
function supabaseClient(){
  if(!isSupabaseConfigured()){
    console.warn("[Supabase] Belum dikonfigurasi. Isi js/config.js dulu.");
    return null;
  }
  if(!_sbClient && window.supabase && window.supabase.createClient){
    _sbClient = window.supabase.createClient(
      window.SUPABASE_CONFIG.SUPABASE_URL,
      window.SUPABASE_CONFIG.SUPABASE_ANON_KEY
    );
  }
  return _sbClient;
}
