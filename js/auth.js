// ==================== AUTH (Supabase) ====================
// Login pakai username -> dikonversi ke email internal <username>@inventory.local
// Password dikelola Supabase Auth (ter-hash, tidak disimpan di browser).

function authEmailFromUsername(username){
  var domain = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.EMAIL_DOMAIN) || "inventory.local";
  return String(username || "").trim().toLowerCase() + "@" + domain;
}

// Login. Mengembalikan { ok:true, profile } atau { ok:false, error }
async function authLogin(username, password){
  var sb = supabaseClient();
  if(!sb) return { ok:false, error:"Supabase belum dikonfigurasi." };
  var email = authEmailFromUsername(username);
  var res = await sb.auth.signInWithPassword({ email: email, password: password });
  if(res.error){
    return { ok:false, error: res.error.message || "Login gagal." };
  }
  var profile = await authFetchProfile(res.data.user.id);
  if(!profile){
    // Auth sukses tapi profil belum ada / tidak diizinkan
    return { ok:false, error:"Profil user tidak ditemukan. Hubungi Admin." };
  }
  if(profile.aktif === false){
    await sb.auth.signOut();
    return { ok:false, error:"Akun ini dinonaktifkan. Hubungi Admin." };
  }
  return { ok:true, profile: profile };
}

// Ambil profil dari tabel `profiles` berdasarkan id (auth user id).
async function authFetchProfile(userId){
  var sb = supabaseClient();
  if(!sb) return null;
  var res = await sb.from("profiles").select("*").eq("id", userId).single();
  if(res.error){ return null; }
  return res.data;
}

// Ambil user yang sedang login (dari sesi Supabase), beserta profil.
async function authGetCurrent(){
  var sb = supabaseClient();
  if(!sb) return null;
  var res = await sb.auth.getUser();
  if(res.error || !res.data || !res.data.user) return null;
  var user = res.data.user;
  var profile = await authFetchProfile(user.id);
  return { user: user, profile: profile };
}

async function authLogout(){
  var sb = supabaseClient();
  if(!sb) return;
  try{ await sb.auth.signOut(); }catch(e){}
}
