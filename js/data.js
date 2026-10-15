// ==================== DATA LAYER (Supabase) ====================
// Semua akses database untuk master data (items, vendors).
// Aplikasi (app.js) tetap memakai bentuk lama: items[] dengan properti
// {kode,nama,kategori,satuan,stokAwal,minimum} dan vendors{ kode:{...} }.
// Konversi nama kolom (stok_awal <-> stokAwal) dilakukan di sini.

// ---------- ITEMS ----------
async function dbLoadItems(){
  var sb = supabaseClient();
  if(!sb) return [];
  var res = await sb.from("items").select("*").order("kode");
  if(res.error){ console.error("dbLoadItems:", res.error); return []; }
  return (res.data||[]).map(r=>({
    kode:r.kode, nama:r.nama, kategori:r.kategori, satuan:r.satuan,
    stokAwal:r.stok_awal, minimum:r.minimum
  }));
}

async function dbSaveItem(it, isEdit){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  var row = {
    kode:it.kode, nama:it.nama, kategori:it.kategori, satuan:it.satuan,
    stok_awal:it.stokAwal, minimum:it.minimum
  };
  return await sb.from("items").upsert(row, { onConflict:"kode" });
}

async function dbDeleteItem(kode){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("items").delete().eq("kode", kode);
}

// ---------- VENDORS ----------
async function dbLoadVendors(){
  var sb = supabaseClient();
  if(!sb) return {};
  var res = await sb.from("vendors").select("*").order("kode");
  if(res.error){ console.error("dbLoadVendors:", res.error); return {}; }
  var map = {};
  (res.data||[]).forEach(r=>{
    map[r.kode] = { kode:r.kode, nama:r.nama, pic:r.pic, hp:r.hp, alamat:r.alamat, keterangan:r.keterangan };
  });
  return map;
}

async function dbSaveVendor(v){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  var row = {
    kode:v.kode, nama:v.nama, pic:v.pic, hp:v.hp, alamat:v.alamat, keterangan:v.keterangan
  };
  return await sb.from("vendors").upsert(row, { onConflict:"kode" });
}

async function dbDeleteVendor(kode){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("vendors").delete().eq("kode", kode);
}

// ---------- VENDOR <-> BARANG ----------
// Kembalikan map: vendor -> [ {kode, ukuran} ]
async function dbLoadVendorItems(){
  var sb = supabaseClient();
  if(!sb) return {};
  var res = await sb.from("vendor_items").select("vendor,kode_barang,ukuran");
  if(res.error){ console.error("dbLoadVendorItems:", res.error); return {}; }
  var map = {};
  (res.data||[]).forEach(r=>{
    (map[r.vendor] = map[r.vendor] || []).push({ kode:r.kode_barang, ukuran:r.ukuran||"" });
  });
  return map;
}

// list = [ {kode, ukuran} ]
async function dbSetVendorItems(vendor, list){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  // hapus relasi lama, lalu insert ulang
  var del = await sb.from("vendor_items").delete().eq("vendor", vendor);
  if(del.error) return { error:del.error };
  if(!list || list.length===0) return { data:true };
  var rows = list.map(x=>({ vendor:vendor, kode_barang:x.kode, ukuran:(x.ukuran||null) }));
  return await sb.from("vendor_items").insert(rows);
}

// ---------- PIC ----------
async function dbLoadPic(){
  var sb = supabaseClient();
  if(!sb) return [];
  var res = await sb.from("pic").select("*").order("nama");
  if(res.error){ console.error("dbLoadPic:", res.error); return []; }
  return (res.data||[]).map(r=>({
    id:r.id, nama:r.nama, divisi:r.divisi, posisi:r.posisi, aktif:r.aktif
  }));
}

async function dbInsertPic(p){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("pic").insert({ nama:p.nama, divisi:p.divisi, posisi:p.posisi, aktif:p.aktif!==false });
}

async function dbUpdatePic(id, p){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("pic").update({ nama:p.nama, divisi:p.divisi, posisi:p.posisi, aktif:p.aktif!==false }).eq("id", id);
}

async function dbDeletePic(id){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("pic").delete().eq("id", id);
}

// ---------- BAGIAN ----------
async function dbLoadBagian(){
  var sb = supabaseClient();
  if(!sb) return [];
  var res = await sb.from("bagian").select("*").order("nama");
  if(res.error){ console.error("dbLoadBagian:", res.error); return []; }
  return (res.data||[]).map(r=>({ id:r.id, nama:r.nama }));
}

async function dbInsertBagian(nama){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("bagian").insert({ nama:nama });
}

async function dbRenameBagian(id, nama){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("bagian").update({ nama:nama }).eq("id", id);
}

async function dbDeleteBagian(id){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("bagian").delete().eq("id", id);
}

// ---------- TRANSAKSI ----------
// tanggal di DB = date (yyyy-mm-dd). Aplikasi memakai Date object -> konversi.
function _dateToStr(d){
  if(!(d instanceof Date)) d=new Date(d);
  var y=d.getFullYear();
  var m=String(d.getMonth()+1).padStart(2,"0");
  var dd=String(d.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+dd;
}

async function dbLoadTransaksi(){
  var sb = supabaseClient();
  if(!sb) return [];
  var res = await sb.from("transaksi").select("*").order("tanggal",{ascending:false});
  if(res.error){ console.error("dbLoadTransaksi:", res.error); return []; }
  return (res.data||[]).map(r=>({
    id:r.id,
    tanggal:new Date(r.tanggal+"T00:00:00"),
    jam:r.jam?String(r.jam).slice(0,5):null,   // 'HH:MM'
    kode:r.kode_barang,
    ukuran:r.ukuran||"",
    jenis:r.jenis,
    jumlah:r.jumlah,
    pic:r.pic,
    ket:r.ket,
    bagian:r.bagian,
    refKey:r.ref_key,
    refSJ:r.ref_key?r.ref_key.split("::")[1]:null,
    createdBy:r.created_by,
    createdAt:r.created_at?new Date(r.created_at):null
  }));
}

async function dbInsertTransaksi(t){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  var row = {
    tanggal:_dateToStr(t.tanggal),
    jam:t.jam||null,
    kode_barang:t.kode,
    ukuran:t.ukuran||null,
    jenis:t.jenis,
    jumlah:t.jumlah,
    pic:t.pic||null,
    ket:t.ket||null,
    bagian:t.bagian||null,
    ref_key:t.refKey||null
  };
  return await sb.from("transaksi").insert(row).select().single();
}

async function dbUpdateTransaksi(id, t){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  var row = {
    tanggal:_dateToStr(t.tanggal),
    jam:t.jam||null,
    kode_barang:t.kode,
    ukuran:t.ukuran||null,
    jenis:t.jenis,
    jumlah:t.jumlah,
    pic:t.pic||null,
    ket:t.ket||null,
    bagian:t.bagian||null,
    ref_key:t.refKey||null
  };
  return await sb.from("transaksi").update(row).eq("id", id);
}

async function dbDeleteTransaksi(id){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("transaksi").delete().eq("id", id);
}

async function dbDeleteTransaksiByRefKey(refKey){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("transaksi").delete().eq("ref_key", refKey);
}

// ---------- PEMBELIAN (SJ) ----------
// tgl di DB = date. Aplikasi memakai Date object -> konversi via _dateToStr.
// file (foto) ditunda ke Tahap 5; sementara diisi array kosong.
async function dbLoadPembelian(){
  var sb = supabaseClient();
  if(!sb) return [];
  var res = await sb.from("pembelian").select("*").order("tgl_sj",{ascending:false});
  if(res.error){ console.error("dbLoadPembelian:", res.error); return []; }
  return (res.data||[]).map(r=>({
    id:r.id,
    sj:r.sj,
    vendor:r.vendor,
    tglSJ:r.tgl_sj?new Date(r.tgl_sj+"T00:00:00"):null,
    jam:r.jam?String(r.jam).slice(0,5):null,
    kode:r.kode_barang,
    ukuran:r.ukuran||"",
    qty:r.qty,
    hargaPcs:r.harga_pcs,
    invoice:r.invoice,
    tglInvoiceDatang:r.tgl_invoice?new Date(r.tgl_invoice+"T00:00:00"):null,
    tglFinance:r.tgl_finance?new Date(r.tgl_finance+"T00:00:00"):null,
    lunas:r.lunas,
    tglLunas:r.tgl_lunas?new Date(r.tgl_lunas+"T00:00:00"):null,
    buktiLunas:r.bukti_lunas,
    fotoSJFiles:[],fotoInvoiceFiles:[],buktiLunasFiles:[]
  }));
}

function _pembelianRow(t){
  return {
    sj:t.sj,
    vendor:t.vendor,
    tgl_sj:_dateToStr(t.tglSJ),
    jam:t.jam||null,
    kode_barang:t.kode,
    ukuran:t.ukuran||null,
    qty:t.qty,
    harga_pcs:t.hargaPcs||null,
    invoice:t.invoice||null,
    tgl_invoice:t.tglInvoiceDatang?_dateToStr(t.tglInvoiceDatang):null,
    tgl_finance:t.tglFinance?_dateToStr(t.tglFinance):null,
    lunas:!!t.lunas,
    tgl_lunas:t.tglLunas?_dateToStr(t.tglLunas):null,
    bukti_lunas:t.buktiLunas||null
  };
}

async function dbInsertPembelian(items){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  var rows = items.map(_pembelianRow);
  return await sb.from("pembelian").insert(rows);
}

async function dbUpdatePembelianById(id, t){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("pembelian").update(_pembelianRow(t)).eq("id", id);
}

async function dbUpdatePembelianBySJ(vendor, sj, patch){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("pembelian").update(patch).eq("vendor", vendor).eq("sj", sj);
}

async function dbDeletePembelianBySJ(vendor, sj){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("pembelian").delete().eq("vendor", vendor).eq("sj", sj);
}

// ---------- STORAGE / FILES ----------
// File disimpan di bucket 'docs' (PRIVAT) dengan struktur: <tipe>/<vendor>/<sj>/<namafile>
// Tabel `files` mencatat path-nya. Untuk tampilan, pakai signed URL (kadaluarsa).

function _safeFileName(name){
  return String(name||"file").replace(/[^A-Za-z0-9._-]+/g,"_");
}

// Masa berlaku signed URL (detik). 12 jam — lebih lama dari sesi login (8 jam).
var SIGNED_URL_TTL = 43200;

// Kembalikan signed URL untuk satu path di bucket docs.
async function storageSignedUrl(path){
  var sb = supabaseClient();
  if(!sb || !path) return null;
  var res = await sb.storage.from("docs").createSignedUrl(path, SIGNED_URL_TTL);
  if(res.error){ console.error("storageSignedUrl:", res.error); return null; }
  return res.data ? res.data.signedUrl : null;
}

// Kembalikan map path -> signed URL untuk banyak path (1 panggilan API).
async function storageSignedUrls(paths){
  var sb = supabaseClient();
  if(!sb || !paths || paths.length===0) return {};
  var res = await sb.storage.from("docs").createSignedUrls(paths, SIGNED_URL_TTL);
  if(res.error){ console.error("storageSignedUrls:", res.error); return {}; }
  var map = {};
  (res.data||[]).forEach(function(d){
    if(!d.error && d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}

// Upload satu file {name,type,dataUrl} ke Storage, catat ke tabel files.
// pembelianRef = ref_key SJ (vendor::sj-norm). tipe = 'SJ' | 'Invoice' | 'Bukti'
async function dbUploadFile(pembelianRef, tipe, vendor, sj, file){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  // dataUrl -> Blob
  var parts = file.dataUrl.split(",");
  var bin = atob(parts[1]);
  var arr = new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  var blob = new Blob([arr], {type:file.type||"application/octet-stream"});

  var folder = tipe + "/" + _safeFileName(vendor) + "/" + _safeFileName(sj) + "/";
  var path = folder + Date.now() + "_" + _safeFileName(file.name);
  var up = await sb.storage.from("docs").upload(path, blob, { upsert:false, contentType:file.type||"application/octet-stream" });
  if(up.error) return { error:up.error };
  var ins = await sb.from("files").insert({
    pembelian_ref:pembelianRef,
    tipe:tipe,
    path:path
  });
  if(ins.error) return { error:ins.error };
  var url = await storageSignedUrl(path);
  return { data:{ path:path, url:url, name:file.name, type:file.type } };
}

// Ambil daftar file untuk sekumpulan SJ (by tipe). Return map: refKey -> [ {path,name,type,url} ]
async function dbLoadFilesByRefs(refList, tipe){
  var sb = supabaseClient();
  if(!sb || !refList || refList.length===0) return {};
  var res = await sb.from("files").select("*").eq("tipe",tipe).in("pembelian_ref",refList);
  if(res.error){ console.error("dbLoadFilesByRefs:", res.error); return {}; }
  var rows = res.data||[];
  var urls = await storageSignedUrls(rows.map(function(r){ return r.path; }));
  var map = {};
  rows.forEach(function(r){
    var name = r.path.split("/").pop().replace(/^\d+_/, "");
    var ext = (name.split(".").pop()||"").toLowerCase();
    var type = (ext==="pdf")?"application/pdf":("image/"+ (ext==="jpg"?"jpeg":ext||"jpeg"));
    (map[r.pembelian_ref] = map[r.pembelian_ref] || []).push({
      path:r.path, name:name, type:type, url:urls[r.path]||null
    });
  });
  return map;
}

// Hapus file dari Storage + tabel files (berdasarkan path)
async function dbDeleteFile(path){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  var rm = await sb.storage.from("docs").remove([path]);
  if(rm.error) return { error:rm.error };
  return await sb.from("files").delete().eq("path", path);
}

// ---------- KELOLA USER (via Edge Function) ----------
async function dbManageUser(payload){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  var session = await sb.auth.getSession();
  var token = session && session.data && session.data.session ? session.data.session.access_token : null;
  if(!token) return { error:{message:"Sesi tidak ditemukan. Login ulang."} };
  var c = window.SUPABASE_CONFIG || {};
  try{
    var res = await fetch(c.SUPABASE_URL + "/functions/v1/manage-user", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":"Bearer " + token,
        "apikey": c.SUPABASE_ANON_KEY
      },
      body: JSON.stringify(payload)
    });
    var data = null;
    try{ data = await res.json(); }catch(e){ data = null; }
    if(!res.ok){
      var msg = (data && data.error) ? data.error : ("Gagal (" + res.status + ")");
      return { error:{message: msg} };
    }
    return { data: data };
  }catch(e){
    return { error:{message: "Tidak bisa menghubungi server: " + (e && e.message ? e.message : e)} };
  }
}

// ---------- AUDIT LOG ----------
async function dbInsertAudit(entry){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  return await sb.from("audit_log").insert({
    user_id: entry.userId || null,
    action: entry.action || "",
    category: entry.category || "",
    target: entry.target || "",
    detail: entry.detail || ""
  });
}

// Ambil audit log terbaru (join ke profiles untuk nama/username).
async function dbLoadAudit(limit){
  var sb = supabaseClient();
  if(!sb) return [];
  var res = await sb.from("audit_log")
    .select("id,ts,action,category,target,detail,profiles(username,nama)")
    .order("ts",{ascending:false})
    .limit(limit||500);
  if(res.error){ console.error("dbLoadAudit:", res.error); return []; }
  return (res.data||[]).map(r=>({
    ts:r.ts,
    action:r.action,
    category:r.category,
    target:r.target,
    detail:r.detail,
    user:(r.profiles&&r.profiles.username)||"",
    nama:(r.profiles&&r.profiles.nama)||"Sistem"
  }));
}

async function dbClearAudit(){
  var sb = supabaseClient();
  if(!sb) return { error:{message:"Supabase belum dikonfigurasi"} };
  // Hapus semua baris (RLS hanya izinkan Admin)
  return await sb.from("audit_log").delete().neq("id", 0);
}
