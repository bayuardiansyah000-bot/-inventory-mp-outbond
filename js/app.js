
// ==================== USER SYSTEM ====================
const DEFAULT_USERS = {
  bayu:   { password:"bayu2026",   nama:"Bayu Ardiansyah", role:"Admin",    avatar:"BA", aktif:true, isDefault:true },
  afandi: { password:"afandi2026", nama:"Afandi",          role:"Operator", avatar:"AF", aktif:true, isDefault:true },
  febri:  { password:"febri2026",  nama:"Febriansyah",     role:"Operator", avatar:"FE", aktif:true, isDefault:true }
};
const USERS_KEY = "inv_users_v1";
const SESSION_KEY = "inv_session_v1";
const AUDIT_KEY = "inv_audit_v1";
const THEME_KEY = "inv_theme_v1";
const SB_KEY = "inv_sidebar_collapsed_v1";
const ATTEMPT_KEY = "inv_login_attempts_v1";
const SESSION_HOURS = 8;
const SESSION_MS = SESSION_HOURS * 3600000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 5 * 60 * 1000;
let CURRENT_SESSION = null;

// ==================== LOGIN LOCKOUT ====================
function getLoginAttempts(){
  try{ return JSON.parse(localStorage.getItem(ATTEMPT_KEY)||"{}"); }catch(e){ return {}; }
}
function saveLoginAttempts(obj){
  try{ localStorage.setItem(ATTEMPT_KEY, JSON.stringify(obj)); }catch(e){}
}
function getLockRemaining(username){
  const a=getLoginAttempts()[username];
  if(!a||!a.until)return 0;
  const rem=a.until-Date.now();
  return rem>0?rem:0;
}
function registerFailedAttempt(username){
  const all=getLoginAttempts();
  const a=all[username]||{count:0,until:0};
  a.count=(a.count||0)+1;
  if(a.count>=MAX_LOGIN_ATTEMPTS){
    a.until=Date.now()+LOGIN_LOCK_MS;
    a.count=0;
  }
  all[username]=a;
  saveLoginAttempts(all);
  return a.until>Date.now()?a.until:0;
}
function clearLoginAttempts(username){
  const all=getLoginAttempts();
  if(all[username]){ delete all[username]; saveLoginAttempts(all); }
}
function fmtDurasi(ms){
  const total=Math.ceil(ms/1000);
  const m=Math.floor(total/60);
  const s=total%60;
  if(m>0)return `${m} menit ${s} detik`;
  return `${s} detik`;
}

function getUsers(){
  let stored={};
  try{ stored=JSON.parse(localStorage.getItem(USERS_KEY)||"{}"); }catch(e){}
  return {...DEFAULT_USERS,...stored};
}
function saveUser(username,data){
  let stored={};
  try{ stored=JSON.parse(localStorage.getItem(USERS_KEY)||"{}"); }catch(e){}
  stored[username]=data;
  localStorage.setItem(USERS_KEY,JSON.stringify(stored));
}
function deleteUserStored(username){
  let stored={};
  try{ stored=JSON.parse(localStorage.getItem(USERS_KEY)||"{}"); }catch(e){}
  delete stored[username];
  localStorage.setItem(USERS_KEY,JSON.stringify(stored));
}
function currentUser(){
  if(!CURRENT_SESSION) return null;
  return {
    id:CURRENT_SESSION.id,
    username:CURRENT_SESSION.username,
    nama:CURRENT_SESSION.nama,
    role:CURRENT_SESSION.role,
    avatar:CURRENT_SESSION.avatar,
    aktif:true
  };
}
function isAdmin(){
  if(!CURRENT_SESSION) return false;
  return CURRENT_SESSION.role === "Admin";
}

// ==================== THEME (DARK MODE) ====================
function getTheme(){
  try{ return localStorage.getItem(THEME_KEY)||"light"; }catch(e){ return "light"; }
}
function applyTheme(theme){
  if(theme==="dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
  try{ localStorage.setItem(THEME_KEY,theme); }catch(e){}
  const icon=document.getElementById("sb-theme-icon");
  const label=document.getElementById("sb-theme-label");
  if(icon){
    icon.setAttribute("data-lucide", theme==="dark"?"sun":"moon");
    if(window.lucide&&lucide.createIcons)lucide.createIcons();
  }
  if(label) label.textContent = theme==="dark"?"Light Mode":"Dark Mode";
  if(typeof renderChart==="function" && state.activeTab==="beranda"){
    requestAnimationFrame(()=>{ renderChart(state.berandaDays); renderTrendChart(state.trendDays); });
  }
}
function toggleTheme(){
  const next = getTheme()==="dark" ? "light" : "dark";
  applyTheme(next);
}

// ==================== SIDEBAR ====================
function getSidebarCollapsed(){
  try{ return localStorage.getItem(SB_KEY)==="1"; }catch(e){ return false; }
}
function setSidebarCollapsed(v){
  try{ if(v) localStorage.setItem(SB_KEY,"1"); else localStorage.removeItem(SB_KEY); }catch(e){}
}
function applySidebarPrefs(){
  const shell=document.getElementById("app-shell");
  if(!shell) return;
  if(getSidebarCollapsed()) shell.classList.add("sb-collapsed");
  else shell.classList.remove("sb-collapsed");
}
function toggleSidebarCollapse(){
  const shell=document.getElementById("app-shell");
  if(!shell) return;
  const isCollapsed = shell.classList.toggle("sb-collapsed");
  setSidebarCollapsed(isCollapsed);
  setTimeout(()=>window.dispatchEvent(new Event("resize")),300);
}
function openMobileSidebar(){
  const sh=document.getElementById("app-shell");
  if(sh) sh.classList.add("sb-open");
}
function closeMobileSidebar(){
  const sh=document.getElementById("app-shell");
  if(sh) sh.classList.remove("sb-open");
}

// ==================== AUDIT LOG SYSTEM ====================
// Audit log kini tersimpan di database (tabel audit_log).
function logAudit(action, category, target, detail){
  if(!CURRENT_SESSION) return;
  if(typeof dbInsertAudit!=="function") return;
  dbInsertAudit({
    userId:CURRENT_SESSION.id,
    action:action, category:category, target:target||"", detail:detail||""
  }).then(res=>{
    if(res && res.error) console.error("logAudit gagal:", res.error.message || res.error);
  }).catch(e=>console.error("logAudit exception:",e));
}
// Untuk aksi sebelum ada sesi (mis. percobaan login gagal).
function logAuditAnon(action, category, target, detail){
  if(typeof dbInsertAudit!=="function") return;
  dbInsertAudit({
    userId:null,
    action:action, category:category, target:target||"", detail:detail||""
  }).then(res=>{
    if(res && res.error) console.error("logAuditAnon gagal:", res.error.message || res.error);
  }).catch(e=>console.error("logAuditAnon exception:",e));
}

// ==================== HELPERS ====================
function esc(s){
  return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function escRegex(s){
  return String(s||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}
// Parsing angka QTY: terima hanya bilangan bulat.
function parseNumber(v){ return Number(String(v??"").trim()); }
function isValidInt(n){ return Number.isInteger(n); }

let TODAY = (function(){ const t = new Date(); t.setHours(0,0,0,0); return t; })();
function refreshToday(){
  const t = new Date(); t.setHours(0,0,0,0);
  if(t.getTime() !== TODAY.getTime()) TODAY = t;
}
setInterval(refreshToday, 60000);

function getToday(){ const t = new Date(); t.setHours(0,0,0,0); return t; }
function dAgo(n){ const t=new Date(TODAY); t.setDate(t.getDate()-n); return t; }
function endOfDay(d){ const t=new Date(d); t.setHours(23,59,59,999); return t; }
// Geser 1 bulan ke belakang, pertahankan tanggal.
// Kalau tanggal tidak ada di bulan tujuan (mis. 31 Feb), clamp ke hari terakhir bulan itu.
function shiftMonthKeepDay(d, deltaMonths){
  const y=d.getFullYear();
  const m=d.getMonth();
  const day=d.getDate();
  const targetM=m+deltaMonths;
  const maxDay=new Date(y,targetM+1,0).getDate();
  const newDay=Math.min(day,maxDay);
  const result=new Date(y,targetM,newDay);
  result.setHours(d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds());
  return result;
}
function normalizeSJ(s){
  return String(s||"").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    .map(p=>/^\d+$/.test(p)?String(Number(p)):p).join("|");
}
const normalizeInvoice=normalizeSJ;
// Kunci unik baris SJ: pasangan vendor + no. SJ.
// Membedakan SJ yang nomornya sama tapi vendornya berbeda.
// No. SJ dinormalisasi agar "SJ-0105", "sj 105", "SJ0105" dianggap sama.
function sjKey(vendor,sj){ return String(vendor||"")+"::"+normalizeSJ(sj); }

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve({name:file.name,type:file.type,dataUrl:r.result});
    r.onerror=reject;
    r.readAsDataURL(file);
  });
}
async function compressImage(file,maxDim=1600,quality=0.75){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        let{width,height}=img;
        if(width>maxDim||height>maxDim){
          const ratio=Math.min(maxDim/width,maxDim/height);
          width=Math.round(width*ratio);
          height=Math.round(height*ratio);
        }
        const canvas=document.createElement("canvas");
        canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0,width,height);
        const dataUrl=canvas.toDataURL("image/jpeg",quality);
        const newName=file.name.replace(/\.(png|jpe?g|webp|gif|bmp)$/i,"")+".jpg";
        resolve({name:newName,type:"image/jpeg",dataUrl});
      };
      img.onerror=()=>resolve({name:file.name,type:file.type,dataUrl:e.target.result});
      img.src=e.target.result;
    };
    reader.onerror=()=>resolve({name:file.name,type:file.type,dataUrl:""});
    reader.readAsDataURL(file);
  });
}
async function readFiles(fileList){
  const arr=Array.from(fileList||[]);
  const out=[];
  for(const f of arr){
    if(f.size>8*1024*1024){
      await alertModal("File terlalu besar",`<b>${esc(f.name)}</b> melebihi 8MB. Dilewati.`);
      continue;
    }
    const isPdf=f.type==="application/pdf";
    const isImage=f.type.startsWith("image/");
    if(!isPdf&&!isImage){
      await alertModal("Format salah",`<b>${esc(f.name)}</b> bukan JPG/PNG/PDF. Dilewati.`);
      continue;
    }
    if(isPdf){ out.push(await fileToDataUrl(f)); }
    else{ out.push(await compressImage(f)); }
  }
  return out;
}
function downloadFile(file){
  const a=document.createElement("a");
  a.href=(file.url||file.dataUrl);a.download=file.name||"file";
  a.target="_blank";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function openFileInTab(file){
  try{
    if(file.url){ const w2=window.open(file.url,"_blank"); if(!w2)alertModal("Popup diblokir","Izinkan popup di browser untuk membuka file di tab baru."); return; }
    const parts=file.dataUrl.split(",");
    const byteString=atob(parts[1]);
    const ab=new ArrayBuffer(byteString.length);
    const ia=new Uint8Array(ab);
    for(let i=0;i<byteString.length;i++) ia[i]=byteString.charCodeAt(i);
    const blob=new Blob([ab],{type:file.type});
    const url=URL.createObjectURL(blob);
    const w=window.open(url,"_blank");
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    if(!w)alertModal("Popup diblokir","Izinkan popup di browser untuk membuka file di tab baru.");
  }catch(err){
    alertModal("Gagal membuka","Tidak bisa membuka file di tab baru.");
  }
}
function fileSrc(f){ return f.url || f.dataUrl || ''; }
function openFilePreview(title,subtitle,files){
  const overlay=document.getElementById("file-preview-overlay");
  const titleEl=document.getElementById("file-preview-title");
  const subEl=document.getElementById("file-preview-subtitle");
  const gallery=document.getElementById("file-preview-gallery");
  titleEl.textContent=title;
  subEl.textContent=subtitle||"";
  if(!files||files.length===0){
    gallery.innerHTML='<div class="file-preview-empty"><i data-lucide="inbox"></i> Belum ada file yang di-upload.</div>';
  }else{
    gallery.innerHTML=files.map((f,i)=>{
      const isPdf=f.type==="application/pdf";
      const _src=f.url||f.dataUrl||"";const body=isPdf?`<iframe src="${_src}" title="${esc(f.name)}"></iframe>`:`<img src="${_src}" alt="${esc(f.name)}" />`;
      return `<div class="file-preview-item"><div class="head"><span class="name">${isPdf?"<i data-lucide='file-text'></i>":"<i data-lucide='image'></i>"} ${esc(f.name)}</span><div class="actions"><button class="btn btn-secondary btn-sm" type="button" data-download-idx="${i}"><i data-lucide='download'></i> Download</button><button class="btn btn-secondary btn-sm" type="button" data-open-idx="${i}"><i data-lucide='link'></i> Tab baru</button></div></div>${body}</div>`;
    }).join("");
  }
  overlay.hidden=false;
  document.body.style.overflow="hidden";
  gallery.querySelectorAll("[data-download-idx]").forEach(btn=>{
    btn.addEventListener("click",()=>downloadFile(files[Number(btn.dataset.downloadIdx)]));
  });
  gallery.querySelectorAll("[data-open-idx]").forEach(btn=>{
    btn.addEventListener("click",()=>openFileInTab(files[Number(btn.dataset.openIdx)]));
  });
  refreshIcons();
}
function closeFilePreview(){
  document.getElementById("file-preview-overlay").hidden=true;
  document.getElementById("file-preview-gallery").innerHTML="";
  document.body.style.overflow="";
}
document.getElementById("file-preview-overlay").addEventListener("click",e=>{
  if(e.target.id==="file-preview-overlay") closeFilePreview();
});
document.getElementById("file-preview-close").addEventListener("click",closeFilePreview);

function renderFileChips(container,files){
  if(!container)return;
  if(!files||files.length===0){ container.innerHTML=""; return; }
  container.innerHTML=files.map((f,i)=>{
    const ico=f.type==="application/pdf"?"<i data-lucide='file-text'></i>":"<i data-lucide='image'></i>";
    return `<span class="pdf-chip">${ico} ${esc(f.name)} <button type="button" data-remove-idx="${i}" title="Hapus"><i data-lucide="x"></i></button></span>`;
  }).join("");
  container.querySelectorAll("[data-remove-idx]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      files.splice(Number(btn.dataset.removeIdx),1);
      renderFileChips(container,files);
    });
  });
  refreshIcons();
}

// ==================== SEARCH SCROLL HELPERS ====================
function flashAndScroll(el){
  if(!el) return false;
  try{
    el.scrollIntoView({behavior:"smooth", block:"center"});
    el.classList.add("flash-hl");
    setTimeout(()=>{ el.classList.remove("flash-hl"); }, 2600);
    return true;
  }catch(e){ return false; }
}
function findRowByCode(selector, code){
  const rows = document.querySelectorAll(selector);
  for(const r of rows){
    if(r.textContent && r.textContent.indexOf(code) !== -1) return r;
  }
  return null;
}

// ==================== DATA ====================
const DATA={
// Master data dimuat dari Supabase saat login (lihat loadMasterData()).
items:[],
vendors:{},
picList:[],
bagianList:[],
bagianRows:[],
transaksi:[],   // dimuat dari Supabase (lihat loadMasterData()/loadTransaksi())
pembelian:[],   // menyusul: akan dimuat dari Supabase
};

// ==================== LOAD MASTER DATA DARI DB ====================
async function loadMasterData(){
  if(typeof dbLoadItems!=="function") return;
  const [items, vendors, picList, bagianRows, transaksi, pembelian] = await Promise.all([
    dbLoadItems(), dbLoadVendors(), dbLoadPic(), dbLoadBagian(), dbLoadTransaksi(), dbLoadPembelian()
  ]);
  DATA.items = items;
  DATA.vendors = vendors;
  DATA.picList = picList;
  DATA.bagianList = (bagianRows||[]).map(b=>b.nama);
  DATA.bagianRows = bagianRows; // {id,nama} untuk rename/hapus
  DATA.transaksi = transaksi;
  DATA.pembelian = pembelian;
  await attachFilesToPembelian();
}

// Muat ulang transaksi + pembelian (untuk sinkronisasi SJ <-> auto-stock).
async function loadTransaksiDanPembelian(){
  if(typeof dbLoadTransaksi==="function") DATA.transaksi = await dbLoadTransaksi();
  if(typeof dbLoadPembelian==="function") DATA.pembelian = await dbLoadPembelian();
  await attachFilesToPembelian();
}

// Lampirkan file (foto SJ/Invoice/Bukti) dari Storage ke tiap baris pembelian.
async function attachFilesToPembelian(){
  if(typeof dbLoadFilesByRefs!=="function") return;
  const refs=[...new Set(DATA.pembelian.map(r=>sjKey(r.vendor,r.sj)))];
  if(refs.length===0) return;
  const [sjMap,invMap,buktiMap]=await Promise.all([
    dbLoadFilesByRefs(refs,"SJ"),
    dbLoadFilesByRefs(refs,"Invoice"),
    dbLoadFilesByRefs(refs,"Bukti")
  ]);
  DATA.pembelian.forEach(r=>{
    const k=sjKey(r.vendor,r.sj);
    r.fotoSJFiles=sjMap[k]||[];
    r.fotoInvoiceFiles=invMap[k]||[];
    r.buktiLunasFiles=buktiMap[k]||[];
  });
}

// Muat ulang hanya transaksi (lebih ringan setelah perubahan transaksi).
async function loadTransaksi(){
  if(typeof dbLoadTransaksi!=="function") return;
  DATA.transaksi = await dbLoadTransaksi();
}

function itemByKode(k){ return DATA.items.find(i=>i.kode===k); }
// Kembalikan daftar barang yang stoknya akan menjadi negatif.
function negativeStockItems(){
  return DATA.items.filter(it=>currentStock(it.kode)<0);
}
// Peringatkan (tanpa memblokir) bila ada stok negatif setelah perubahan.
function warnNegativeStock(){
  const neg=negativeStockItems();
  if(neg.length===0)return;
  const list=neg.slice(0,5).map(it=>`<b>${esc(it.nama)}</b> (${currentStock(it.kode)} ${esc(it.satuan)})`).join("<br>");
  const more=neg.length>5?`<br>+${neg.length-5} lainnya`:"";
  alertModal("<i data-lucide='alert-triangle'></i> Stok menjadi negatif",`Perubahan ini membuat stok berikut menjadi negatif:<br><br>${list}${more}<br><br>Periksa kembali transaksi terkait.`);
}
function vendorByKode(k){ return DATA.vendors[k]||null; }
function vendorNama(k){ return (DATA.vendors[k]&&DATA.vendors[k].nama)||k||"-"; }
function picByNama(n){ return DATA.picList.find(p=>p.nama===n)||null; }
function picNamaList(){ return DATA.picList.filter(p=>p.aktif!==false).map(p=>p.nama); }
function picInfoStr(n){
  const p=picByNama(n);
  if(!p)return"";
  return [p.divisi,p.posisi].filter(Boolean).join(" · ");
}
function fmtTgl(dt){
  return dt?dt.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"-";
}
function fmtInputDate(dt){
  if(!dt)return"";
  const y=dt.getFullYear();
  const m=String(dt.getMonth()+1).padStart(2,"0");
  const d=String(dt.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function fmtRupiah(n){ return "Rp "+(n||0).toLocaleString("id-ID"); }

function currentStock(kode,excludeIdx){
  const it=itemByKode(kode);
  if(!it)return 0;
  let s=it.stokAwal;
  DATA.transaksi.forEach((t,i)=>{
    if(t.kode===kode && i!==excludeIdx) s += t.jenis==="Masuk"?t.jumlah:-t.jumlah;
  });
  return s;
}
const RECENT_WINDOW_DAYS=7;

// Rata-rata pemakaian: total OUT ÷ jumlah hari kalender pada periode (dipakai di laporan).
function avgDailyKeluar(kode,fromDate,toDate){
  const fromStart=new Date(fromDate);fromStart.setHours(0,0,0,0);
  const toStart=new Date(toDate);toStart.setHours(0,0,0,0);
  const days=Math.max(1,Math.round((toStart-fromStart)/86400000)+1);
  const tot=DATA.transaksi.filter(t=>t.kode===kode&&t.jenis==="Keluar"&&t.tanggal>=fromDate&&t.tanggal<=toDate).reduce((a,t)=>a+t.jumlah,0);
  return tot/days;
}
// Rata-rata pemakaian (kartu Beranda/umur stok): total OUT 7 hari terakhir ÷ 7
// (hari kalender — termasuk hari tanpa pemakaian).
function recentDailyUsage(kode){
  const from=new Date(TODAY);
  from.setDate(from.getDate()-(RECENT_WINDOW_DAYS-1));
  const to=endOfDay(TODAY);
  const tot=DATA.transaksi.filter(t=>t.kode===kode&&t.jenis==="Keluar"&&t.tanggal>=from&&t.tanggal<=to).reduce((a,t)=>a+t.jumlah,0);
  return tot/RECENT_WINDOW_DAYS;
}
function totalKeluarPeriode(kode,days){
  const from=new Date(TODAY);
  from.setDate(from.getDate()-(days-1));
  return DATA.transaksi.filter(t=>t.kode===kode&&t.jenis==="Keluar"&&t.tanggal>=from&&t.tanggal<=endOfDay(TODAY)).reduce((a,t)=>a+t.jumlah,0);
}
function countKeluarPeriode(kode,days){
  const from=new Date(TODAY);
  from.setDate(from.getDate()-(days-1));
  return DATA.transaksi.filter(t=>t.kode===kode&&t.jenis==="Keluar"&&t.tanggal>=from&&t.tanggal<=endOfDay(TODAY)).length;
}
function downloadCSV(filename,headers,rows){
  const csv=[headers.join(",")].concat(rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(","))).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}
function pembelianGroups(){
  const map=new Map();
  DATA.pembelian.forEach(r=>{
    const key=sjKey(r.vendor,r.sj);
    if(!map.has(key)) map.set(key,{
      key,sj:r.sj,vendor:r.vendor,tglSJ:r.tglSJ,invoice:r.invoice,
      tglInvoiceDatang:r.tglInvoiceDatang,tglFinance:r.tglFinance,
      lunas:r.lunas,tglLunas:r.tglLunas,buktiLunas:r.buktiLunas,
      fotoSJFiles:r.fotoSJFiles||[],fotoInvoiceFiles:r.fotoInvoiceFiles||[],
      buktiLunasFiles:r.buktiLunasFiles||[],items:[]
    });
    const g=map.get(key);
    g.items.push(r);
    if(r.fotoSJFiles&&r.fotoSJFiles.length>g.fotoSJFiles.length) g.fotoSJFiles=r.fotoSJFiles;
    if(r.fotoInvoiceFiles&&r.fotoInvoiceFiles.length>g.fotoInvoiceFiles.length) g.fotoInvoiceFiles=r.fotoInvoiceFiles;
    if(r.buktiLunasFiles&&r.buktiLunasFiles.length>g.buktiLunasFiles.length) g.buktiLunasFiles=r.buktiLunasFiles;
  });
  return [...map.values()].map(g=>({
    ...g,
    total:g.items.reduce((a,it)=>a+it.qty*(it.hargaPcs||0),0)
  }));
}
function findGroupByKey(key){ return pembelianGroups().find(g=>g.key===key); }
function groupStageIndex(g){
  if(g.lunas)return 3;
  if(g.tglFinance)return 2;
  if(g.invoice)return 1;
  return 0;
}
function groupItemsLabel(g){
  return g.items.map(x=>{
    const item=itemByKode(x.kode)||{nama:x.kode,satuan:""};
    return `${item.nama} (${x.qty} ${item.satuan})`;
  }).join(" · ");
}

async function syncSJToTransaksi(sj,vendor){
  const key=sjKey(vendor,sj);
  // Apakah SJ ini sebelumnya punya transaksi auto-stock?
  const has=DATA.transaksi.some(t=>t.refKey===key);
  if(!has)return { ok:true }; // SJ tanpa auto-stock tidak ditambah otomatis saat edit
  // Hapus semua transaksi auto-stock milik SJ ini di DB
  const del=await dbDeleteTransaksiByRefKey(key);
  if(del.error) return { ok:false, error:del.error.message };
  // Bangun ulang dari baris pembelian milik SJ ini
  const rows=DATA.pembelian.filter(r=>sjKey(r.vendor,r.sj)===key);
  for(const r of rows){
    const ins=await dbInsertTransaksi({
      tanggal:r.tglSJ,kode:r.kode,jenis:"Masuk",jumlah:r.qty,
      pic:"Admin Pembelian",ket:"SJ "+r.sj,refKey:key,bagian:""
    });
    if(ins.error) return { ok:false, error:ins.error.message };
  }
  return { ok:true };
}

// ==================== TOAST ====================
// Render ulang ikon Lucide setelah HTML dinamis dibuat.
function refreshIcons(){
  if(window.lucide && lucide.createIcons) lucide.createIcons();
}

function toast(msg,type="success",sub=""){
  const c=document.getElementById("toast-container");
  const icons={success:"<i data-lucide='check'></i>",error:"<i data-lucide='x'></i>",info:"<i data-lucide='info'></i>"};
  const el=document.createElement("div");
  el.className=`toast toast-${type}`;
  el.innerHTML=`<div class="toast-icon">${icons[type]||"<i data-lucide='info'></i>"}</div><div style="flex:1;min-width:0;"><div style="font-weight:600;color:var(--ink);">${esc(msg)}</div>${sub?`<div style="font-size:11px;color:var(--ink-muted);margin-top:2px;">${esc(sub)}</div>`:""}</div>`;
  c.appendChild(el);
  refreshIcons();
  setTimeout(()=>{
    el.classList.add("out");
    setTimeout(()=>el.remove(),250);
  },3000);
}

// ==================== FOCUS TRAP ====================
function attachFocusTrap(boxId,getHandler,setHandler){
  const container=document.getElementById(boxId);
  const handler=e=>{
    if(e.key!=="Tab")return;
    const items=container.querySelectorAll('button,[href],input:not([type="hidden"]),select,textarea,[tabindex]:not([tabindex="-1"])');
    if(items.length===0)return;
    const first=items[0],last=items[items.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  const prev=getHandler();
  if(prev)document.removeEventListener("keydown",prev);
  document.addEventListener("keydown",handler);
  setHandler(handler);
}

// ==================== MODAL ====================
let modalOnCancel=null,modalFocusTrap=null;
function openModal(html,onCancel){
  document.getElementById("modal-box").innerHTML=html;
  document.getElementById("modal-overlay").hidden=false;
  modalOnCancel=onCancel||null;
  attachFocusTrap("modal-box",()=>modalFocusTrap,fn=>modalFocusTrap=fn);
  const f=document.querySelector("#modal-box input,#modal-box select,#modal-box button");
  if(f)setTimeout(()=>f.focus(),40);
  if(window.lucide&&lucide.createIcons)lucide.createIcons();
}
function closeModal(viaCancel=false){
  const cb=modalOnCancel;
  modalOnCancel=null;
  document.getElementById("modal-overlay").hidden=true;
  document.getElementById("modal-box").innerHTML="";
  if(modalFocusTrap){document.removeEventListener("keydown",modalFocusTrap);modalFocusTrap=null;}
  if(viaCancel&&cb)cb();
}
document.getElementById("modal-overlay").addEventListener("click",e=>{
  if(e.target.id==="modal-overlay")closeModal(true);
});

let manageFocusTrap=null;
function openManageModal(html){
  document.getElementById("manage-box").innerHTML=html;
  document.getElementById("manage-overlay").hidden=false;
  attachFocusTrap("manage-box",()=>manageFocusTrap,fn=>manageFocusTrap=fn);
  const f=document.querySelector("#manage-box input,#manage-box select,#manage-box button");
  if(f)setTimeout(()=>f.focus(),40);
  if(window.lucide&&lucide.createIcons)lucide.createIcons();
}
function closeManageModal(){
  document.getElementById("manage-overlay").hidden=true;
  document.getElementById("manage-box").innerHTML="";
  if(manageFocusTrap){document.removeEventListener("keydown",manageFocusTrap);manageFocusTrap=null;}
  render();
}
document.getElementById("manage-overlay").addEventListener("click",e=>{
  if(e.target.id==="manage-overlay")closeManageModal();
});

let alertFocusTrap=null,currentAlertResolver=null,currentAlertOnNo=null;
function closeAlertLayer(){
  document.getElementById("alert-overlay").hidden=true;
  document.getElementById("alert-box").innerHTML="";
  if(alertFocusTrap){document.removeEventListener("keydown",alertFocusTrap);alertFocusTrap=null;}
  currentAlertOnNo=null;
}
function alertModal(title,message){
  return new Promise(resolve=>{
    const box=document.getElementById("alert-box");
    box.innerHTML=`<div class="modal-title">${esc(title)}</div><div class="modal-sub">${message}</div><div class="modal-actions"><button class="btn btn-primary" type="button" data-ok>OK</button></div>`;
    document.getElementById("alert-overlay").hidden=false;
    attachFocusTrap("alert-box",()=>alertFocusTrap,fn=>alertFocusTrap=fn);
    currentAlertResolver=resolve;
    const btn=box.querySelector("[data-ok]");
    setTimeout(()=>btn&&btn.focus(),20);
    btn.addEventListener("click",()=>{
      currentAlertResolver=null;
      closeAlertLayer();
      resolve();
    });
  });
}
function confirmModal(title,message,onYes,yesLabel,onNo,noLabel){
  const box=document.getElementById("alert-box");
  box.innerHTML=`<div class="modal-title">${esc(title)}</div><div class="modal-sub">${message}</div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-confirm-no>${esc(noLabel||"Batal")}</button><button class="btn btn-primary" type="button" data-confirm-yes>${esc(yesLabel||"Ya, Lanjutkan")}</button></div>`;
  document.getElementById("alert-overlay").hidden=false;
  attachFocusTrap("alert-box",()=>alertFocusTrap,fn=>alertFocusTrap=fn);
  currentAlertResolver=null;
  currentAlertOnNo=onNo||null;
  setTimeout(()=>{
    const b=box.querySelector("[data-confirm-yes]");
    if(b)b.focus();
  },20);
  box.querySelector("[data-confirm-no]").addEventListener("click",()=>{
    const cb=onNo;closeAlertLayer();if(cb)cb();
  });
  box.querySelector("[data-confirm-yes]").addEventListener("click",()=>{
    currentAlertOnNo=null;closeAlertLayer();onYes();
  });
}

// ==================== SEMUA BARANG MODAL ====================
let semuaFocusTrap=null;
function openSemuaModal(){
  const list=sortItemsByPriority(DATA.items);
  document.getElementById("semua-subtitle").textContent=`Total ${list.length} barang terdaftar`;
  document.getElementById("semua-search").value="";
  renderSemuaGrid("");
  document.getElementById("semua-overlay").hidden=false;
  document.body.style.overflow="hidden";
  attachFocusTrap("semua-overlay",()=>semuaFocusTrap,fn=>semuaFocusTrap=fn);
  setTimeout(()=>document.getElementById("semua-search").focus(),40);
  if(window.lucide&&lucide.createIcons)lucide.createIcons();
}
function closeSemuaModal(){
  document.getElementById("semua-overlay").hidden=true;
  document.body.style.overflow="";
  if(semuaFocusTrap){document.removeEventListener("keydown",semuaFocusTrap);semuaFocusTrap=null;}
}
function renderSemuaGrid(query){
  const list=sortItemsByPriority(DATA.items);
  const q=query.trim().toLowerCase();
  const filtered=q?list.filter(it=>it.nama.toLowerCase().includes(q)||it.kode.toLowerCase().includes(q)):list;
  const grid=document.getElementById("semua-grid");
  const empty=document.getElementById("semua-empty");
  if(filtered.length===0){grid.innerHTML="";empty.hidden=false;return;}
  empty.hidden=true;
  grid.innerHTML=filtered.map(statCardHtml).join("");
  renderAllSparklines();
}
document.getElementById("semua-overlay").addEventListener("click",e=>{
  if(e.target.id==="semua-overlay")closeSemuaModal();
});
document.getElementById("semua-close").addEventListener("click",closeSemuaModal);
document.getElementById("semua-search").addEventListener("input",e=>renderSemuaGrid(e.target.value));

// ==================== SEARCH MODAL ====================
let searchFocusTrap=null;
function openSearchModal(){
  document.getElementById("search-modal").hidden=false;
  document.getElementById("search-input").value="";
  document.getElementById("search-results").innerHTML='<div class="search-empty">Ketik kata kunci untuk mulai mencari...</div>';
  attachFocusTrap("search-modal",()=>searchFocusTrap,fn=>searchFocusTrap=fn);
  setTimeout(()=>document.getElementById("search-input").focus(),40);
}
function closeSearchModal(){
  document.getElementById("search-modal").hidden=true;
  if(searchFocusTrap){document.removeEventListener("keydown",searchFocusTrap);searchFocusTrap=null;}
}
document.getElementById("search-modal").addEventListener("click",e=>{
  if(e.target.id==="search-modal")closeSearchModal();
});
document.getElementById("search-modal-close").addEventListener("click",closeSearchModal);
document.getElementById("global-search").addEventListener("click",openSearchModal);
document.getElementById("global-search").addEventListener("focus",function(){
  this.blur();openSearchModal();
});

function highlight(text,q){
  const s=String(text||"");
  if(!q) return esc(s);
  const re=new RegExp("("+escRegex(q)+")","gi");
  return esc(s).replace(re,'<span class="si-hit">$1</span>');
}

function runSearch(q){
  const box=document.getElementById("search-results");
  if(!q || q.trim().length<1){
    box.innerHTML='<div class="search-empty">Ketik kata kunci untuk mulai mencari...</div>';
    return;
  }
  const query=q.trim();
  const qLow=query.toLowerCase();
  const hit=(t)=>{ if(!t) return false; return String(t).toLowerCase().includes(qLow); };
  let groups=[];

  // === Barang ===
  const items=DATA.items.filter(it=>hit(it.kode)||hit(it.nama)||hit(it.kategori)||hit(it.satuan));
  if(items.length){
    groups.push({
      title:"<i data-lucide='package'></i> Barang ("+items.length+")",
      items:items.slice(0,8).map(it=>({
        title:`${esc(it.kode)} — ${highlight(it.nama,query)}`,
        sub:`Kategori: ${esc(it.kategori||"-")} · Stok: ${currentStock(it.kode)} ${esc(it.satuan)}`,
        action:()=>{
          closeSearchModal();
          state.activeTab="vendor";
          state.vendorSearch="";
          render();
          setTimeout(()=>{
            const row=findRowByCode("#barang-master-list tr",it.kode);
            if(row){flashAndScroll(row);toast("Barang: "+it.nama,"info",it.kode);}
            else toast("Baris tidak ditemukan","error","Cek tab Vendor");
          },120);
        }
      }))
    });
  }

  // === Vendor ===
  const vendors=Object.values(DATA.vendors).filter(v=>hit(v.kode)||hit(v.nama)||hit(v.pic)||hit(v.hp)||hit(v.alamat));
  if(vendors.length){
    groups.push({
      title:"<i data-lucide='building-2'></i> Vendor ("+vendors.length+")",
      items:vendors.slice(0,8).map(v=>({
        title:`${esc(v.kode)} — ${highlight(v.nama,query)}`,
        sub:`PIC: ${esc(v.pic||"-")} · ${esc(v.hp||"-")}`,
        action:()=>{
          closeSearchModal();
          state.activeTab="vendor";
          state.vendorSearch="";
          render();
          setTimeout(()=>{
            const btn=document.querySelector('[data-edit-vendor="'+CSS.escape(v.kode)+'"]');
            const row=btn?btn.closest("tr"):null;
            if(row){flashAndScroll(row);toast("Vendor: "+v.nama,"info",v.kode);}
            else toast("Baris tidak ditemukan","error","Cek tab Vendor");
          },120);
        }
      }))
    });
  }

  // === Surat Jalan ===
  const sjMap=new Map();
  DATA.pembelian.forEach(r=>{
    const key=sjKey(r.vendor,r.sj);
    if(!sjMap.has(key)) sjMap.set(key,{key,sj:r.sj,vendor:r.vendor,lunas:r.lunas});
  });
  const sjs=[...sjMap.values()].filter(g=>hit(g.sj)||hit(vendorNama(g.vendor)));
  if(sjs.length){
    groups.push({
      title:"<i data-lucide='clipboard-list'></i> Surat Jalan ("+sjs.length+")",
      items:sjs.slice(0,8).map(g=>({
        title:`SJ ${highlight(g.sj,query)} — ${highlight(vendorNama(g.vendor),query)}`,
        sub:`Klik untuk buka di tab Pembelian`,
        action:()=>{
          closeSearchModal();
          state.activeTab="pembelian";
          render();
          setTimeout(()=>{
            const el=document.querySelector('[data-preview-sj="'+CSS.escape(g.key)+'"]');
            const row=el?el.closest("tr"):null;
            if(row){flashAndScroll(row);toast("Surat Jalan: "+g.sj,"info",vendorNama(g.vendor));}
            else toast("Baris tidak ditemukan","error","Cek tab Pembelian");
          },120);
        }
      }))
    });
  }

  // === Invoice ===
  const invMap=new Map();
  DATA.pembelian.forEach(r=>{
    if(r.invoice){
      const key=sjKey(r.vendor,r.sj);
      if(!invMap.has(key)) invMap.set(key,{key,sj:r.sj,vendor:r.vendor,invoice:r.invoice});
    }
  });
  const invs=[...invMap.values()].filter(g=>hit(g.invoice)||hit(g.sj));
  if(invs.length){
    groups.push({
      title:"<i data-lucide='dollar-sign'></i> Invoice ("+invs.length+")",
      items:invs.slice(0,8).map(g=>({
        title:`${highlight(g.invoice,query)} — SJ ${esc(g.sj)}`,
        sub:`Vendor: ${esc(vendorNama(g.vendor))}`,
        action:()=>{
          closeSearchModal();
          state.activeTab="pembelian";
          render();
          setTimeout(()=>{
            const el=document.querySelector('[data-preview-invoice="'+CSS.escape(g.key)+'"]');
            const row=el?el.closest("tr"):null;
            if(row){flashAndScroll(row);toast("Invoice: "+g.invoice,"info",vendorNama(g.vendor));}
            else toast("Baris tidak ditemukan","error","Cek tab Pembelian");
          },120);
        }
      }))
    });
  }

  // === PIC ===
  const pics=DATA.picList.filter(p=>hit(p.nama)||hit(p.divisi)||hit(p.posisi));
  if(pics.length){
    groups.push({
      title:"<i data-lucide='user'></i> PIC ("+pics.length+")",
      items:pics.slice(0,8).map(p=>({
        title:highlight(p.nama,query),
        sub:`${esc(p.divisi||"-")} · ${esc(p.posisi||"-")}`,
        action:()=>{
          closeSearchModal();
          state.activeTab="pic";
          state.picSearch="";
          render();
          setTimeout(()=>{
            const btn=document.querySelector('[data-edit-pic="'+CSS.escape(p.nama)+'"]');
            const row=btn?btn.closest("tr"):null;
            if(row){flashAndScroll(row);toast("PIC: "+p.nama,"info",p.divisi||"");}
            else toast("Baris tidak ditemukan","error","Cek tab PIC");
          },120);
        }
      }))
    });
  }

  // === Transaksi ===
  const trx=DATA.transaksi.filter(t=>{
    const it=itemByKode(t.kode);
    return hit(t.pic)||hit(t.ket)||hit(t.kode)||(it&&hit(it.nama))||hit(t.bagian);
  });
  if(trx.length){
    groups.push({
      title:"<i data-lucide='pencil-line'></i> Transaksi ("+trx.length+")",
      items:trx.slice(0,8).map(t=>{
        const it=itemByKode(t.kode)||{nama:t.kode,satuan:""};
        return {
          title:`${t.jenis==="Keluar"?"OUT":"IN"} ${t.jumlah} ${esc(it.satuan)} - ${highlight(it.nama,query)}`,
          sub:`${esc(fmtTgl(t.tanggal))} - PIC: ${esc(t.pic)}${t.bagian?" - "+esc(t.bagian):""}`,
          action:()=>{
            closeSearchModal();
            state.activeTab="transaksi";
            const d=new Date(t.tanggal);
            state.riwayatFrom=new Date(d);state.riwayatFrom.setHours(0,0,0,0);
            state.riwayatTo=new Date(d);state.riwayatTo.setHours(23,59,59,999);
            state.filterJenis="";state.filterBarang="";state.filterPic="";state.filterBagian="";
            state.rangePreset="";
            document.getElementById("f-riwayat-from").value=fmtInputDate(state.riwayatFrom);
            document.getElementById("f-riwayat-to").value=fmtInputDate(state.riwayatTo);
            state.riwayatPage=1;
            render();
            setTimeout(()=>{
              const idx=DATA.transaksi.indexOf(t);
              const btn=document.querySelector('[data-edit-transaksi="'+idx+'"]');
              const row=btn?btn.closest("tr"):null;
              if(row){flashAndScroll(row);toast("Transaksi: "+it.nama,"info",fmtTgl(t.tanggal));}
              else toast("Baris tidak ditemukan","error","Cek tab Transaksi");
            },120);
          }
        };
      })
    });
  }

  if(groups.length===0){
    box.innerHTML='<div class="search-empty">Tidak ada hasil untuk <b>'+esc(query)+'</b>.</div>';
    return;
  }
  box.innerHTML=groups.map(g=>{
    const itemsHtml=g.items.map((it,i)=>`<div class="search-item" data-g="${groups.indexOf(g)}" data-i="${i}"><div class="si-title">${it.title}</div><div class="si-sub">${it.sub}</div></div>`).join("");
    return `<div class="search-group"><div class="search-group-title">${g.title}</div>${itemsHtml}</div>`;
  }).join("");
  box.querySelectorAll(".search-item").forEach(el=>{
    el.addEventListener("click",()=>{
      const gi=Number(el.dataset.g), ii=Number(el.dataset.i);
      groups[gi].items[ii].action();
    });
  });
}
document.getElementById("search-input").addEventListener("input",e=>runSearch(e.target.value));

// ==================== AUDIT MODAL ====================
let auditFocusTrap=null;
function openAuditModal(){
  document.getElementById("modal-audit").hidden=false;
  document.getElementById("audit-search").value="";
  renderAuditList("");
  attachFocusTrap("modal-audit",()=>auditFocusTrap,fn=>auditFocusTrap=fn);
}
function closeAuditModal(){
  document.getElementById("modal-audit").hidden=true;
  if(auditFocusTrap){document.removeEventListener("keydown",auditFocusTrap);auditFocusTrap=null;}
}
document.getElementById("modal-audit").addEventListener("click",e=>{
  if(e.target.id==="modal-audit")closeAuditModal();
});
document.getElementById("modal-audit-close").addEventListener("click",closeAuditModal);
let _auditCache=[];
document.getElementById("audit-search").addEventListener("input",e=>renderAuditList(e.target.value));
document.getElementById("btn-audit-csv").addEventListener("click",()=>{
  const rows=_auditCache.map(e=>[new Date(e.ts).toLocaleString("id-ID"),e.nama+" (@"+e.user+")",e.action,e.category,e.target,e.detail]);
  downloadCSV("audit-log.csv",["Waktu","User","Aksi","Kategori","Target","Detail"],rows);
  toast("CSV audit diunduh","success","audit-log.csv");
});
document.getElementById("btn-audit-clear").addEventListener("click",()=>{
  if(!isAdmin()){alertModal("Akses ditolak","Hanya Admin yang bisa membersihkan audit log.");return;}
  confirmModal("Bersihkan Audit Log","Yakin hapus semua riwayat audit? Tindakan ini tidak bisa dibatalkan.",async ()=>{
    const res=await dbClearAudit();
    if(res.error){alertModal("Gagal membersihkan",esc(res.error.message));return;}
    toast("Audit log dibersihkan","success");
    renderAuditList("");
  },"Ya, Hapus");
});
async function renderAuditList(q){
  const box=document.getElementById("audit-list");
  box.innerHTML='<div class="search-empty">Memuat...</div>';
  let list=await dbLoadAudit(500);
  _auditCache=list;
  if(q){
    const ql=q.toLowerCase();
    list=list.filter(e=>String(e.nama).toLowerCase().includes(ql)||String(e.user).toLowerCase().includes(ql)||String(e.action).toLowerCase().includes(ql)||String(e.target).toLowerCase().includes(ql)||String(e.detail).toLowerCase().includes(ql));
  }
  if(list.length===0){box.innerHTML='<div class="search-empty">Belum ada aktivitas.</div>';return;}
  const icoMap={create:"plus",update:"pencil",delete:"trash-2",login:"log-in",logout:"log-out","login-fail":"alert-triangle"};
  const clsMap={create:"act-create",update:"act-update",delete:"act-delete","login-fail":"act-delete"};
  box.innerHTML=list.map(e=>{
    const ico=`<i data-lucide='${icoMap[e.action]||"dot"}'></i>`;
    const cls=clsMap[e.action]||"";
    const waktu=new Date(e.ts).toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit"});
    return `<div class="audit-row ${cls}"><div class="a-ico">${ico}</div><div class="a-body"><div class="a-line1"><b>${esc(e.nama)}</b> - ${esc(e.action)} ${esc(e.category)}${e.target?` <b>${esc(e.target)}</b>`:""}${e.detail?` - ${esc(e.detail)}`:""}</div><div class="a-meta">${waktu} - @${esc(e.user)}</div></div></div>`;
  }).join("");
  refreshIcons();
}

// ==================== DATE / VALIDATION ====================
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape")return;
  if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
  if(!document.getElementById("search-modal").hidden){closeSearchModal();return;}
  if(!document.getElementById("modal-audit").hidden){closeAuditModal();return;}
  if(!document.getElementById("file-preview-overlay").hidden){closeFilePreview();return;}
  if(!document.getElementById("semua-overlay").hidden){closeSemuaModal();return;}
  if(!document.getElementById("alert-overlay").hidden){
    const onNo=currentAlertOnNo;
    closeAlertLayer();
    if(currentAlertResolver){const r=currentAlertResolver;currentAlertResolver=null;r();}
    else if(onNo){onNo();}
    return;
  }
  if(!document.getElementById("manage-overlay").hidden){closeManageModal();return;}
  if(!document.getElementById("modal-overlay").hidden)closeModal(true);
});
document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){
    e.preventDefault();
    if(!document.getElementById("dashboard").classList.contains("show")) return;
    openSearchModal();
  }
});
function checkNotFuture(dateStr,label){
  if(!dateStr){
    alertModal("Tanggal belum diisi",`${label} wajib diisi.`);
    return false;
  }
  const d=new Date(dateStr+"T00:00:00");
  if(isNaN(d.getTime())){
    alertModal("Tanggal tidak valid",`${label} tidak valid.`);
    return false;
  }
  const today=getToday();
  if(d>today){
    alertModal("Tanggal tidak valid",`${label} tidak boleh melebihi hari ini.`);
    return false;
  }
  return true;
}
function checkDateOrder(a,b,labelA,labelB){
  if(!a||!b)return true;
  if(new Date(a)<new Date(b)){
    alertModal("Urutan tanggal salah",`${labelA} tidak boleh sebelum ${labelB}.`);
    return false;
  }
  return true;
}

const state={
  activeTab:"beranda",berandaDays:14,trendDays:30,
  riwayatFrom:getToday(),riwayatTo:endOfDay(getToday()),rangePreset:"today",
  laporanFrom:dAgo(30),laporanTo:endOfDay(getToday()),laporanShown:false,laporanCompare:false,
  tagihanSearch:"",tagihanBulan:"",expandedPO:null,fotoSJFiles:[],
  sortRiwayat:{by:"tanggal",dir:"desc"},riwayatPage:1,
  editingVendorKode:null,vendorSearch:"",editingPicNama:null,picSearch:"",
  filterJenis:"",filterBarang:"",filterPic:"",filterBagian:""
};
const PAGE_SIZE=20;
const TAB_TITLES={beranda:"Beranda",transaksi:"Transaksi Gudang",pembelian:"Pembelian",vendor:"Vendor & Barang",pic:"PIC",laporan:"Laporan",petunjuk:"Petunjuk"};

// ==================== ROLE HELPERS ====================
function canManageUser(){return isAdmin();}
function canDelete(){return isAdmin();}
function canManageMaster(){return isAdmin();}
// ==================== QUICK STOCK STRIP ====================
function renderQuickStock(){
  const list=document.getElementById("qs-list");
  if(!list)return;
  const curKode=document.getElementById("f-barang").value;
  list.innerHTML=DATA.items.map(it=>{
    const stok=currentStock(it.kode);
    const warn=stok<=it.minimum;
    const active=it.kode===curKode?" active":"";
    const cls=warn?"warn":"ok";
    const title=`${it.nama} · stok ${stok} ${it.satuan}${warn?` · min ${it.minimum}`:""}`;
    return `<button type="button" class="qs-pill ${cls}${active}" data-qs-kode="${esc(it.kode)}" title="${esc(title)}"><span class="qs-name">${esc(it.nama)}</span><span class="qs-stok"><span class="qs-dot"></span>${stok}<span class="qs-unit">${esc(it.satuan)}</span></span></button>`;
  }).join("");
}

// Click handler — pilih barang dari pill
document.getElementById("qs-list").addEventListener("click",e=>{
  const pill=e.target.closest("[data-qs-kode]");
  if(!pill)return;
  const kode=pill.dataset.qsKode;
  const fBarang=document.getElementById("f-barang");
  if(fBarang&&itemByKode(kode)){
    fBarang.value=kode;
    fBarang.dataset.prevValue=kode;
    renderQuickStock();
    fBarang.dispatchEvent(new Event("change"));
  }
});
// ==================== MAIN RENDER ====================
function render(){
  invalidateStockCache();
  document.getElementById("page-title").textContent=TAB_TITLES[state.activeTab];
  ["beranda","transaksi","pembelian","vendor","pic","laporan","petunjuk"].forEach(t=>{
    const sb=document.querySelector('.sb-item[data-tab="'+t+'"]');
    if(sb) sb.setAttribute("aria-selected",String(t===state.activeTab));
    if(sb) sb.classList.toggle("active",t===state.activeTab);
    document.getElementById("panel-"+t).hidden=t!==state.activeTab;
  });
  renderBeranda();
  populateSelects();
  renderRiwayat();
  renderTagihanBerjalan();
  renderTagihanSelesai();
  renderLaporan();
  renderVendorList();
  renderBarangMasterList();
  renderPicList();
  renderQuickStock();
  updateVendorBadge();
   updatePembelianBadge();
  if(typeof initVendorSelects==="function") { initVendorSelects(); setLaporanPbDefault(); }
  if(state.activeTab==="beranda"){
    requestAnimationFrame(()=>{
      renderChart(state.berandaDays);
      renderTrendChart(state.trendDays);
      renderAllSparklines();
    });
  }
  if(window.lucide && lucide.createIcons) lucide.createIcons();
}

function populateSelects(){
  const fBarang=document.getElementById("f-barang");const curBarang=fBarang.value;
  fBarang.innerHTML=DATA.items.map(i=>`<option value="${esc(i.kode)}">${esc(i.nama)}</option>`).join("");
  if(curBarang&&itemByKode(curBarang))fBarang.value=curBarang;
  fBarang.dataset.prevValue=fBarang.value;

  const pVendor=document.getElementById("p-vendor");const curVendor=pVendor.value;
  pVendor.innerHTML='<option value="">-- Pilih Vendor --</option>'+Object.values(DATA.vendors).map(v=>`<option value="${esc(v.kode)}">${esc(v.nama)}</option>`).join("");
  if(curVendor&&DATA.vendors[curVendor])pVendor.value=curVendor;

  const fPic=document.getElementById("f-pic");const curPic=fPic.value;const aktivePic=picNamaList();
  fPic.innerHTML='<option value="">-- Pilih PIC --</option>'+aktivePic.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("")+'<option value="__new_pic__">+ Tambah PIC baru...</option>';
  if(curPic&&(aktivePic.includes(curPic)||curPic==="__new_pic__"))fPic.value=curPic;

  const fBagian=document.getElementById("f-bagian");const curBagian=fBagian.value;
  fBagian.innerHTML=DATA.bagianList.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join("");
  if(curBagian&&DATA.bagianList.includes(curBagian))fBagian.value=curBagian;

  const fJenis=document.getElementById("f-riwayat-jenis");if(fJenis)fJenis.value=state.filterJenis||"";

  // state = sumber tunggal; bila nilainya sudah tidak valid, bersihkan state
  // supaya dropdown & tabel selalu sinkron (tidak ada filter "hantu").
  if(state.filterBarang&&!itemByKode(state.filterBarang))state.filterBarang="";
  const fBar=document.getElementById("f-riwayat-barang");
  if(fBar){
    fBar.innerHTML='<option value="">Semua Barang</option>'+DATA.items.map(i=>`<option value="${esc(i.kode)}">${esc(i.nama)}</option>`).join("");
    fBar.value=state.filterBarang||"";
  }
  if(state.filterPic&&!picByNama(state.filterPic))state.filterPic="";
  const fPc=document.getElementById("f-riwayat-pic");
  if(fPc){
    fPc.innerHTML='<option value="">Semua PIC</option>'+DATA.picList.map(p=>`<option value="${esc(p.nama)}">${esc(p.nama)}</option>`).join("");
    fPc.value=state.filterPic||"";
  }
  if(state.filterBagian&&!DATA.bagianList.includes(state.filterBagian))state.filterBagian="";
  const fBg=document.getElementById("f-riwayat-bagian");
  if(fBg){
    fBg.innerHTML='<option value="">Semua Bagian</option>'+DATA.bagianList.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join("");
    fBg.value=state.filterBagian||"";
  }
}
function refreshItemDropdowns(){
  const fb=document.getElementById("f-barang");const curFb=fb.value;
  fb.innerHTML=DATA.items.map(i=>`<option value="${esc(i.kode)}">${esc(i.nama)}</option>`).join("");
  if(curFb&&itemByKode(curFb))fb.value=curFb;
  fb.dataset.prevValue=fb.value;
  document.querySelectorAll(".cart-barang").forEach(sel=>{
    const cur=sel.value;
    sel.innerHTML=DATA.items.map(i=>`<option value="${esc(i.kode)}">${esc(i.nama)}</option>`).join("")+'<option value="__new_barang__">+ Tambah barang baru...</option>';
    if(cur&&cur!=="__new_barang__"&&itemByKode(cur))sel.value=cur;
    else if(DATA.items.length)sel.value=DATA.items[0].kode;
    sel.dataset.prevValue=sel.value;
  });
}

// ==================== SPARKLINE ====================
// Cache deret stok harian per kode. Direset setiap render (DATA_REV berubah)
// agar selalu sinkron dengan DATA terbaru.
const SPARKLINE_CACHE=new Map();
let DATA_REV=0;
function invalidateStockCache(){ DATA_REV++; SPARKLINE_CACHE.clear(); }

// Hitung deret stok harian untuk `days` hari terakhir (inklusif hari ini).
// Mengelompokkan transaksi per kode sekali agar tidak scan penuh tiap hari.
function buildDailyStockSeries(kode,days){
  const cacheKey=kode+"|"+days+"|"+DATA_REV;
  if(SPARKLINE_CACHE.has(cacheKey)) return SPARKLINE_CACHE.get(cacheKey);
  const it=itemByKode(kode);
  const today=getToday();
  const result=[];
  if(!it){
    for(let i=0;i<days;i++) result.push(0);
    SPARKLINE_CACHE.set(cacheKey,result);
    return result;
  }
  // Kumpulkan transaksi kode ini, urutkan naik berdasarkan tanggal.
  const trx=DATA.transaksi.filter(t=>t.kode===kode).sort((a,b)=>a.tanggal-b.tanggal);
  for(let i=days-1;i>=0;i--){
    const d=new Date(today);
    d.setDate(d.getDate()-i);
    const end=endOfDay(d);
    let s=it.stokAwal;
    for(const t of trx){
      if(t.tanggal>end)break; // sudah terurut, aman untuk berhenti
      s += (t.jenis==="Masuk"?t.jumlah:-t.jumlah);
    }
    result.push(s);
  }
  SPARKLINE_CACHE.set(cacheKey,result);
  return result;
}
function sparklineData(kode,days){
  return buildDailyStockSeries(kode,days);
}
function sparklineSvg(kode,warn){
  const arr=sparklineData(kode,7);
  if(arr.length<2) return "";
  const w=100,h=32,pad=2;
  const min=Math.min(...arr);
  const max=Math.max(...arr);
  const range=Math.max(1,max-min);
  const stepX=(w-pad*2)/(arr.length-1);
  const points=arr.map((v,i)=>{
    const x=pad+i*stepX;
    const y=pad+(h-pad*2)*(1-(v-min)/range);
    return [x,y];
  });
  const linePath=points.map((p,i)=>(i===0?"M":"L")+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
  const fillPath=linePath+" L"+points[points.length-1][0].toFixed(1)+","+(h-pad)+" L"+points[0][0].toFixed(1)+","+(h-pad)+" Z";
  const color=warn?"#CA8A04":"#15803D";
  const fillColor=warn?"rgba(202,138,4,.14)":"rgba(21,128,61,.12)";
  const gid="spark-"+kode+"-"+Math.random().toString(36).slice(2,7);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:36px;display:block;overflow:visible;">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${fillPath}" fill="url(#${gid})"/>
    <path d="${linePath}" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${points[points.length-1][0].toFixed(1)}" cy="${points[points.length-1][1].toFixed(1)}" r="2.4" fill="${color}"/>
  </svg>`;
}
function renderAllSparklines(){
  document.querySelectorAll(".stat-spark").forEach(el=>{
    const kode=el.dataset.sparkKode;
    const warn=el.dataset.sparkWarn==="1";
    if(!kode) return;
    el.innerHTML=sparklineSvg(kode,warn);
  });
}

// ==================== BERANDA ====================
const MAX_VISIBLE=6;
function sortItemsByPriority(list){
  return [...list].sort((a,b)=>{
    const aW=currentStock(a.kode)<=a.minimum;
    const bW=currentStock(b.kode)<=b.minimum;
    if(aW!==bW)return aW?-1:1;
    const aR=recentDailyUsage(a.kode);
    const bR=recentDailyUsage(b.kode);
    if(aR!==bR)return bR-aR;
    return a.kode.localeCompare(b.kode);
  });
}
function statCardHtml(it){
  const stok=currentStock(it.kode);
  const rateRaw=recentDailyUsage(it.kode);
  const rate=Math.round(rateRaw*10)/10;
  const warn=stok<=it.minimum;
  const umur=rateRaw>0?Math.round(stok/rateRaw):null;
  const umurLabel=umur===null||umur>99?">99 Hari":umur+" Hari";
  return `<div class="stat-card ${warn?"warn-card":""}">
    <div class="stat-head">
      <span class="stat-name">${esc(it.nama)}</span>
      <span class="badge ${warn?"badge-warn":"badge-good"}"><span class="badge-dot"></span>${warn?"RESTOCK":"AMAN"}</span>
    </div>
    <div class="stat-value">${stok} <small>${esc(it.satuan)}</small></div>
    <div class="stat-spark" data-spark-kode="${esc(it.kode)}" data-spark-warn="${warn?"1":"0"}"></div>
    <div class="stat-foot"><span title="Total pemakaian 7 hari terakhir dibagi 7 (hari kalender)"><i data-lucide="bar-chart-3"></i> ${rate}/hr</span><span><i data-lucide="hourglass"></i> ${umurLabel}</span></div>
  </div>`;
}
function renderBeranda(){
  renderAlertBanner();
  renderStokGrid();
  renderLeaderboard();
  renderFeed();
  renderTagihanCard();
}
function renderAlertBanner(){
  const banner=document.getElementById("alert-banner");
  const restock=DATA.items.filter(it=>currentStock(it.kode)<=it.minimum);
  const title=document.getElementById("alert-title");
  const desc=document.getElementById("alert-desc");
  const ico=document.getElementById("alert-ico");
  if(restock.length===0){
    banner.className="alert-banner good";
    ico.innerHTML=`<i data-lucide="check"></i>`;
    title.textContent="Semua stok aman";
    desc.innerHTML='<span style="color:var(--good);">Tidak ada barang di bawah stok minimum saat ini.</span>';
    banner.hidden=false;
    return;
  }
  banner.className="alert-banner danger";
  ico.innerHTML=`<i data-lucide="alert-triangle"></i>`;
  title.textContent=`${restock.length} barang perlu segera di-restock`;
  desc.innerHTML=restock.slice(0,5).map(r=>`<span class="pill">${esc(r.nama)} · stok ${currentStock(r.kode)} / min ${r.minimum}</span>`).join("")+(restock.length>5?`<span class="pill">+${restock.length-5} lainnya</span>`:"");
  banner.hidden=false;
}
function renderStokGrid(){
  const sorted=sortItemsByPriority(DATA.items);
  const visible=sorted.slice(0,MAX_VISIBLE);
  const total=sorted.length;
  document.getElementById("stok-grid").innerHTML=visible.map(statCardHtml).join("");
  const rowEl=document.getElementById("lihat-semua-row");
  if(total>MAX_VISIBLE){
    rowEl.hidden=false;
    document.getElementById("lihat-semua-count").textContent=total;
  }else{
    rowEl.hidden=true;
  }
}
function renderLeaderboard(){
  const list=DATA.items.map(it=>({nama:it.nama,count:countKeluarPeriode(it.kode,RECENT_WINDOW_DAYS)})).filter(r=>r.count>0).sort((a,b)=>b.count-a.count).slice(0,5);
  const el=document.getElementById("leader-list");
  const foot=document.getElementById("leader-foot");
  if(list.length===0){
    el.innerHTML='<div class="sub" style="padding:14px 0;text-align:center;">Belum ada transaksi OUT dalam 7 hari terakhir.</div>';
    foot.hidden=true;
    return;
  }
  el.innerHTML=list.map((r,i)=>{
    const rc=i===0?"rank-1":i===1?"rank-2":i===2?"rank-3":"rank-n";
    const medal=i===0?"<i data-lucide='medal'></i>":i===1?"<i data-lucide='medal'></i>":i===2?"<i data-lucide='medal'></i>":(i+1);
    return `<div class="leader-row"><div class="leader-rank ${rc}">${medal}</div><div class="leader-name">${esc(r.nama)}</div><div class="leader-value">${r.count}× keluar</div></div>`;
  }).join("");
  const totalCount=DATA.items.reduce((a,it)=>a+countKeluarPeriode(it.kode,RECENT_WINDOW_DAYS),0);
  document.getElementById("leader-total").textContent=`${totalCount}× keluar`;
  foot.hidden=false;
}
function renderFeed(){
  const sorted=[...DATA.transaksi].sort((a,b)=>b.tanggal-a.tanggal).slice(0,5);
  const el=document.getElementById("feed");
  if(sorted.length===0){
    el.innerHTML='<div class="sub" style="padding:14px 0;text-align:center;">Belum ada aktivitas.</div>';
    return;
  }
  el.innerHTML=sorted.map(t=>{
    const it=itemByKode(t.kode)||{nama:t.kode,satuan:""};
    const diff=Math.round((getToday()-t.tanggal)/86400000);
    const waktu=diff===0?"Hari ini":diff===1?"Kemarin":`${diff} hari lalu`;
    return `<div class="feed-row"><div class="feed-dot ${t.jenis==="Keluar"?"out":"in"}"></div><div class="feed-body"><div class="feed-line1"><b>${t.jenis==="Keluar"?"OUT":"IN"}</b> · ${esc(it.nama)} ${t.jumlah} ${esc(it.satuan)} — <span style="color:var(--ink-muted);">${esc(t.pic)}</span></div></div><div class="feed-time">${waktu}</div></div>`;
  }).join("");
}
function renderTagihanCard(){
  const groups=pembelianGroups().filter(g=>!g.lunas).sort((a,b)=>b.tglSJ-a.tglSJ);
  const total=groups.reduce((a,g)=>a+g.total,0);
  document.getElementById("beranda-tagihan-num").textContent=`${groups.length} tagihan`;
  document.getElementById("beranda-tagihan-amt").textContent=`Total ${fmtRupiah(total)}`;
  const listEl=document.getElementById("beranda-tagihan-list");
  if(!listEl)return;
  if(groups.length===0){
    listEl.innerHTML='<div class="tagihan-mini-empty">Tidak ada tagihan berjalan <i data-lucide="check"></i></div>';
    return;
  }
  listEl.innerHTML=groups.map(g=>{
    const itemsArr=g.items.map(it=>{
      const item=itemByKode(it.kode)||{nama:it.kode,satuan:""};
      return {nama:item.nama,qty:it.qty,satuan:item.satuan};
    });
    let itemsText="";
    if(itemsArr.length===1)itemsText=`<b>${esc(itemsArr[0].nama)}</b> (${itemsArr[0].qty} ${esc(itemsArr[0].satuan)})`;
    else if(itemsArr.length===2)itemsText=`<b>${esc(itemsArr[0].nama)}</b> (${itemsArr[0].qty} ${esc(itemsArr[0].satuan)}) · ${esc(itemsArr[1].nama)} (${itemsArr[1].qty} ${esc(itemsArr[1].satuan)})`;
    else if(itemsArr.length>2)itemsText=`<b>${esc(itemsArr[0].nama)}</b> (${itemsArr[0].qty} ${esc(itemsArr[0].satuan)}) +${itemsArr.length-1} lainnya`;
    const invHtml=g.invoice?`<span class="inv">${esc(g.invoice)}</span>`:`<span class="inv belum">Belum invoice</span>`;
    const amtHtml=g.total>0?`<div class="amt">${fmtRupiah(g.total)}</div>`:`<div class="amt belum">—</div>`;
    return `<div class="tagihan-mini-row"><div class="left"><div class="line1"><span class="sj">${esc(g.sj)}</span><span class="sep">·</span><span>${esc(fmtTgl(g.tglSJ))}</span><span class="sep">·</span>${invHtml}</div><div class="line2">${itemsText} — ${esc(vendorNama(g.vendor))}</div></div>${amtHtml}</div>`;
  }).join("");
}
let chartBarang=null;
function isDark(){ return document.body.classList.contains("dark"); }
function getChartColors(){
  return isDark() ? {grid:"#44403C",tick:"#A8A29E",ink:"#F5F5F4",accentWarn:"#FBBF24",accentOk:"#F59E0B",tip:"#292524"} : {grid:"#E7E5E4",tick:"#A8A29E",ink:"#292524",accentWarn:"#CA8A04",accentOk:"#D97706",tip:"#292524"};
}
function renderChart(days){
  state.berandaDays=days;
  const canvas=document.getElementById("chart-barang");
  if(!canvas||typeof Chart==="undefined"){
    const wrap=canvas?canvas.parentElement:null;
    if(wrap)wrap.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-faint);font-size:12.5px;">Grafik tidak bisa dimuat (Chart.js CDN offline)</div>';
    return;
  }
  const list=DATA.items;
  const labels=list.map(i=>i.nama);
  const values=list.map(i=>totalKeluarPeriode(i.kode,days));
  const C=getChartColors();
  const colors=list.map(i=>(currentStock(i.kode)<=i.minimum)?C.accentWarn:C.accentOk);
  if(chartBarang)chartBarang.destroy();
  chartBarang=new Chart(canvas,{
    type:"bar",
    data:{labels,datasets:[{label:"Qty keluar",data:values,backgroundColor:colors,borderRadius:8,borderSkipped:false,barThickness:"flex",maxBarThickness:22}]},
    options:{
      indexAxis:"y",responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:C.tip,padding:10,titleFont:{size:12,weight:"600"},bodyFont:{size:12},callbacks:{label:ctx=>` ${ctx.parsed.x} ${list[ctx.dataIndex].satuan} (${days} hari)`}}},
      scales:{x:{beginAtZero:true,grid:{color:C.grid},ticks:{color:C.tick,font:{size:11}}},y:{grid:{display:false},ticks:{color:C.ink,font:{size:12,weight:"500"}}}},
      animation:{duration:400,easing:"easeOutQuart"}
    }
  });
}

// ==================== TREND STOK CHART ====================
let chartTrend=null;
function renderTrendChart(days){
  state.trendDays=days;
  const canvas=document.getElementById("chart-trend");
  if(!canvas||typeof Chart==="undefined") return;
  const C=getChartColors();
  const labels=[];
  const today=getToday();
  for(let i=days-1;i>=0;i--){
    const d=new Date(today);
    d.setDate(d.getDate()-i);
    labels.push(d.toLocaleDateString("id-ID",{day:"2-digit",month:"short"}));
  }
  const palette=isDark()
    ?["#F59E0B","#FBBF24","#FCD34D","#22C55E","#4ADE80","#F87171","#A8A29E","#D97706"]
    :["#35578A","#5B7FA6","#8AAECB","#B8791F","#3F8F5C","#A8365C","#6B7686","#C99A3F"];
  const datasets=DATA.items.map((it,idx)=>{
    const arr=buildDailyStockSeries(it.kode,days);
    return {label:it.nama,data:arr,borderColor:palette[idx%palette.length],backgroundColor:palette[idx%palette.length]+"22",tension:.3,pointRadius:0,pointHoverRadius:5,borderWidth:2};
  });
  if(chartTrend)chartTrend.destroy();
  chartTrend=new Chart(canvas,{
    type:"line",
    data:{labels,datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:"index",intersect:false},
      plugins:{
        legend:{position:"bottom",labels:{boxWidth:10,boxHeight:10,font:{size:11},color:C.ink,padding:12,usePointStyle:true,pointStyle:"circle"}},
        tooltip:{backgroundColor:C.tip,padding:10,titleFont:{size:12,weight:"600"},bodyFont:{size:12}}
      },
      scales:{
        x:{grid:{display:false},ticks:{color:C.tick,font:{size:11},maxRotation:0,autoSkip:true,maxTicksLimit:10}},
        y:{beginAtZero:false,grid:{color:C.grid},ticks:{color:C.tick,font:{size:11}}}
      },
      animation:{duration:400,easing:"easeOutQuart"}
    }
  });
}

// ==================== RIWAYAT ====================
function sortTransaksi(rows){
  const{by,dir}=state.sortRiwayat;
  return [...rows].sort((a,b)=>{
    let av,bv;
    if(by==="tanggal"){av=a.tanggal.getTime();bv=b.tanggal.getTime();}
    else if(by==="barang"){av=(itemByKode(a.kode)?.nama||"").toLowerCase();bv=(itemByKode(b.kode)?.nama||"").toLowerCase();}
    else if(by==="jenis"){av=a.jenis;bv=b.jenis;}
    else if(by==="qty"){av=a.jumlah;bv=b.jumlah;}
    else return 0;
    if(av<bv)return dir==="asc"?-1:1;
    if(av>bv)return dir==="asc"?1:-1;
    return 0;
  });
}
function renderRiwayat(){
  const tbody=document.getElementById("riwayat-body");
  if(!tbody)return;
  const from=state.riwayatFrom;
  const to=state.riwayatTo;
  let all=DATA.transaksi.map((t,idx)=>({t,idx})).filter(({t})=>t.tanggal>=from&&t.tanggal<=to);
  if(state.filterJenis)all=all.filter(({t})=>t.jenis===state.filterJenis);
  if(state.filterBarang)all=all.filter(({t})=>t.kode===state.filterBarang);
  if(state.filterPic)all=all.filter(({t})=>t.pic===state.filterPic);
  if(state.filterBagian)all=all.filter(({t})=>t.bagian===state.filterBagian);
  const sorted=sortTransaksi(all.map(x=>x.t)).map(t=>all.find(x=>x.t===t));
  const total=sorted.length;
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  if(state.riwayatPage>totalPages)state.riwayatPage=totalPages;
  const start=(state.riwayatPage-1)*PAGE_SIZE;
  const pageRows=sorted.slice(start,start+PAGE_SIZE);
  if(pageRows.length===0){
    tbody.innerHTML='<tr class="empty-row"><td colspan="8">Tidak ada data yang cocok dengan filter ini.</td></tr>';
  }else{
    tbody.innerHTML=pageRows.map(({t,idx})=>{
      const it=itemByKode(t.kode);
      const isAutoStock=t.refSJ!=null;
      const picSub=picInfoStr(t.pic);
      const delDisabled=isAutoStock||!canDelete();
      const delTitle=isAutoStock?'Dari SJ - hapus lewat tab Pembelian':(!canDelete()?"Hanya Admin yang bisa menghapus":"");
      return `<tr><td>${esc(fmtTgl(t.tanggal))}</td><td class="mono">${esc(t.kode)}</td><td><b>${esc(it?it.nama:t.kode)}</b></td><td><span class="badge ${t.jenis==="Masuk"?"badge-good":"badge-warn"}">${t.jenis==="Masuk"?"IN":"OUT"}</span></td><td style="text-align:right">${t.jumlah} ${esc(it?it.satuan:"")}</td><td>${esc(t.pic)}${picSub?`<div class="sub">${esc(picSub)}</div>`:""}</td><td class="sub">${esc(t.ket)||"-"}${t.bagian?`<div class="sub" style="color:var(--steel-bright);"><i data-lucide="package"></i> ${esc(t.bagian)}</div>`:""}${isAutoStock?'<div class="sub" style="color:var(--steel-bright);"><i data-lucide="link"></i> auto-stock</div>':""}</td><td class="row-actions"><button class="btn btn-secondary" data-edit-transaksi="${idx}">Edit</button><button class="btn btn-secondary" data-del-transaksi="${idx}" ${delDisabled?'disabled title="'+esc(delTitle)+'"':""}>Hapus</button></td></tr>`;
    }).join("");
  }
  const fromLabel=fmtTgl(state.riwayatFrom);
  const toLabel=fmtTgl(state.riwayatTo);
  const rangeText=(fromLabel===toLabel)?fromLabel:`${fromLabel} – ${toLabel}`;
  const filterAktif=[state.filterJenis,state.filterBarang,state.filterPic,state.filterBagian].filter(Boolean).length;
  const filterText=filterAktif>0?` • ${filterAktif} filter aktif`:"";
  document.getElementById("riwayat-count").textContent=`Menampilkan ${pageRows.length} dari ${total} transaksi • ${rangeText}${filterText}`;
  const pager=document.getElementById("riwayat-pager");
  if(totalPages<=1){pager.innerHTML="";return;}
  let html=`<button ${state.riwayatPage===1?"disabled":""} data-page="${state.riwayatPage-1}">‹</button>`;
  const maxBtn=5;
  let fromP=Math.max(1,state.riwayatPage-2);
  let toP=Math.min(totalPages,fromP+maxBtn-1);
  if(toP-fromP+1<maxBtn)fromP=Math.max(1,toP-maxBtn+1);
  for(let i=fromP;i<=toP;i++){
    html+=`<button class="${i===state.riwayatPage?"active":""}" data-page="${i}">${i}</button>`;
  }
  html+=`<button ${state.riwayatPage===totalPages?"disabled":""} data-page="${state.riwayatPage+1}">›</button>`;
  pager.innerHTML=html;
}

// ==================== TAGIHAN ====================
function itemsDetailHtml(g,priced){
  return g.items.map(it=>{
    const item=itemByKode(it.kode);
    const line=priced&&it.hargaPcs
      ?`${it.qty} ${esc(item.satuan)} x ${fmtRupiah(it.hargaPcs)} = ${fmtRupiah(it.qty*it.hargaPcs)}`
      :`${it.qty} ${esc(item.satuan)}`;
    return `<div class="sub" style="padding:2px 0;">${esc(item.nama)} — ${line}</div>`;
  }).join("");
}
function vendorCellHtml(g){
  const v=vendorByKode(g.vendor);
  const nama=v?v.nama:g.vendor;
  return `<b>${esc(nama)}</b><div class="sub mono">${esc(g.vendor)}</div>`;
}
function itemsCellHtml(g,open){
  const lines=g.items.map(it=>{
    const item=itemByKode(it.kode)||{nama:it.kode,satuan:""};
    return `<div><b>${esc(item.nama)}</b> <span class="sub">(${it.qty} ${esc(item.satuan)})</span></div>`;
  }).join("");
  const toggle=g.items.length>1?`<div class="sub expand-toggle" data-toggle-po="${esc(g.key)}">${open?"▾ sembunyikan rincian harga":"▸ lihat rincian harga"}</div>`:"";
  const detail=open?`<div style="margin-top:4px;">${itemsDetailHtml(g,true)}</div>`:"";
  return lines+toggle+detail;
}
function sjLinkHtml(g){
  const n=(g.fotoSJFiles||[]).length;
  const badge=n>0?` <span class="file-count" title="${n} file terlampir"><i data-lucide="paperclip"></i>${n}</span>`:"";
  return `<span class="link-click" data-preview-sj="${esc(g.key)}">${esc(g.sj)}</span>${badge}<div class="sub">${esc(fmtTgl(g.tglSJ))}</div>`;
}
function invoiceCellHtml(g){
  if(!g.invoice)return `—<div class="sub">—</div>`;
  const n=(g.fotoInvoiceFiles||[]).length;
  const badge=n>0?` <span class="file-count" title="${n} file terlampir"><i data-lucide="paperclip"></i>${n}</span>`:"";
  return `<span class="link-click" data-preview-invoice="${esc(g.key)}">${esc(g.invoice)}</span>${badge}<div class="sub">${g.tglInvoiceDatang?esc(fmtTgl(g.tglInvoiceDatang)):"-"}</div>`;
}
function buktiCellHtml(g){
  if(!g.buktiLunas)return "-";
  const n=(g.buktiLunasFiles||[]).length;
  const badge=n>0?` <span class="file-count" title="${n} file terlampir"><i data-lucide="paperclip"></i>${n}</span>`:"";
  return `<span class="link-click" data-preview-bukti="${esc(g.key)}">${esc(g.buktiLunas)}</span>${badge}`;
}
function renderTagihanBerjalan(){
  const tbody=document.getElementById("tagihan-berjalan-body");
  if(!tbody)return;
  const groups=pembelianGroups().filter(g=>!g.lunas).sort((a,b)=>{
    const sa=groupStageIndex(a),sb=groupStageIndex(b);
    if(sa!==sb)return sa-sb;
    return b.tglSJ-a.tglSJ;
  });
  if(groups.length===0){
    tbody.innerHTML='<tr class="empty-row"><td colspan="7">Bagus! Tidak ada tagihan tertunggak.</td></tr>';
  }else{
    const SL=[
      {label:"Menunggu Invoice",cls:"badge-rose"},
      {label:"Invoice Masuk - Proses Finance",cls:"badge-info"},
      {label:"Di Finance - Belum Lunas",cls:"badge-warn"}
    ];
    const AH=[
      k=>`<button class="btn btn-primary btn-sm" data-invoice-po="${esc(k)}">+ Input Invoice</button>`,
      k=>`<button class="btn btn-primary btn-sm" data-finance-po="${esc(k)}">→ Kirim ke Finance</button>`,
      k=>`<button class="btn btn-primary btn-sm" data-lunas-po="${esc(k)}"><i data-lucide="check"></i> Tandai Lunas</button>`
    ];
    tbody.innerHTML=groups.map(g=>{
      const idx=groupStageIndex(g);
      const open=state.expandedPO===g.key;
      const delBtn=canDelete()
        ?`<button class="btn btn-secondary btn-sm" data-del-po="${esc(g.key)}" style="color:var(--danger);">Hapus</button>`
        :`<button class="btn btn-secondary btn-sm" disabled title="Hanya Admin yang bisa menghapus" style="color:var(--ink-faint);">Hapus</button>`;
      return `<tr><td>${sjLinkHtml(g)}</td><td>${vendorCellHtml(g)}</td><td>${itemsCellHtml(g,open)}</td><td>${invoiceCellHtml(g)}</td><td>${g.total>0?fmtRupiah(g.total):"-"}</td><td><span class="badge ${SL[idx].cls}">${SL[idx].label}</span></td><td><div class="action-stack">${AH[idx](g.key)}<div class="action-sub"><button class="btn btn-secondary btn-sm" data-edit-po="${esc(g.key)}">Edit</button>${delBtn}</div></div></td></tr>`;
    }).join("");
  }
  const total=groups.reduce((a,g)=>a+g.total,0);
  document.getElementById("tagihan-berjalan-total").textContent=`Total ${groups.length} tagihan • ${fmtRupiah(total)}`;
}
function renderTagihanSelesai(){
  const tbody=document.getElementById("tagihan-selesai-body");
  if(!tbody)return;
  const q=state.tagihanSearch.trim().toLowerCase();
  let groups=pembelianGroups().filter(g=>g.lunas);
  if(q)groups=groups.filter(g=>g.sj.toLowerCase().includes(q)||vendorNama(g.vendor).toLowerCase().includes(q)||(g.invoice||"").toLowerCase().includes(q));
  if(state.tagihanBulan)groups=groups.filter(g=>g.tglLunas&&fmtInputDate(g.tglLunas).slice(0,7)===state.tagihanBulan);
  if(groups.length===0){
    tbody.innerHTML='<tr class="empty-row"><td colspan="8">Tidak ada riwayat untuk filter ini.</td></tr>';
  }else{
    tbody.innerHTML=groups.map(g=>{
      const open=state.expandedPO===g.key;
      const delBtn=canDelete()
        ?`<button class="btn btn-secondary btn-sm" data-del-po="${esc(g.key)}" style="color:var(--danger);">Hapus</button>`
        :`<button class="btn btn-secondary btn-sm" disabled title="Hanya Admin yang bisa menghapus" style="color:var(--ink-faint);">Hapus</button>`;
      return `<tr><td>${sjLinkHtml(g)}</td><td>${vendorCellHtml(g)}</td><td>${itemsCellHtml(g,open)}</td><td>${invoiceCellHtml(g)}</td><td>${fmtRupiah(g.total)}</td><td>${esc(fmtTgl(g.tglLunas))}</td><td class="sub">${buktiCellHtml(g)}</td><td><div class="action-stack"><button class="btn btn-primary btn-sm" data-edit-po="${esc(g.key)}"><i data-lucide="pencil"></i> Edit</button><div class="action-sub">${delBtn}</div></div></td></tr>`;
    }).join("");
  }
  const total=groups.reduce((a,g)=>a+g.total,0);
  document.getElementById("tagihan-selesai-total").textContent=`Total ${groups.length} tagihan • ${fmtRupiah(total)}`;
}

// ==================== CART ====================
function renderCartRows(){
  if(document.getElementById("cart-rows").children.length===0)addCartRow();
}
function addCartRow(){
  const box=document.getElementById("cart-rows");
  const row=document.createElement("div");
  row.className="cart-row";
  row.innerHTML=`<select class="cart-barang">${DATA.items.map(i=>`<option value="${esc(i.kode)}">${esc(i.nama)}</option>`).join("")}<option value="__new_barang__">+ Tambah barang baru...</option></select><input type="number" class="cart-qty" placeholder="Qty" min="1" step="1" /><button type="button" class="rm"><i data-lucide="x"></i></button>`;
  const selectEl=row.querySelector(".cart-barang");
  selectEl.dataset.prevValue=selectEl.value;
  row.querySelector(".rm").addEventListener("click",()=>{
    row.remove();
    if(box.children.length===0)addCartRow();
  });
  selectEl.addEventListener("change",()=>{
    if(selectEl.value==="__new_barang__"){
      selectEl.value=selectEl.dataset.prevValue||(DATA.items[0]?DATA.items[0].kode:"");
      openKelolaBarangModal({afterAdd:newKode=>{
        selectEl.value=newKode;
        selectEl.dataset.prevValue=newKode;
      }});
    }else{
      selectEl.dataset.prevValue=selectEl.value;
    }
  });
  box.appendChild(row);
}

// ==================== VENDOR LIST ====================
function renderVendorList(){
  const tbody=document.getElementById("vendor-list");
  if(!tbody)return;
  const q=state.vendorSearch.trim().toLowerCase();
  const list=Object.values(DATA.vendors).filter(v=>{
    if(!q)return true;
    return v.kode.toLowerCase().includes(q)
      ||v.nama.toLowerCase().includes(q)
      ||(v.pic||"").toLowerCase().includes(q)
      ||(v.keterangan||"").toLowerCase().includes(q);
  });
  if(list.length===0){
    tbody.innerHTML='<tr class="empty-row"><td colspan="7">Belum ada vendor.</td></tr>';
    return;
  }
  const delTxt=canManageMaster()?"":"disabled title=\"Hanya Admin yang bisa menghapus\" style=\"color:var(--ink-faint);\"";
  const delStyle=canManageMaster()?'style="color:var(--danger);"':"";
  tbody.innerHTML=list.map(v=>{
    const ketHtml=v.keterangan
      ?`<span style="font-size:11.5px;color:var(--ink);line-height:1.5;">${esc(v.keterangan)}</span>`
      :`<span class="sub">-</span>`;
    return `<tr><td class="mono" style="font-weight:600;color:var(--steel-bright);">${esc(v.kode)}</td><td style="font-weight:600;">${esc(v.nama)}</td><td>${esc(v.pic)||"-"}</td><td class="mono">${esc(v.hp)||"-"}</td><td class="sub" style="max-width:220px;">${esc(v.alamat)||"-"}</td><td style="max-width:220px;">${ketHtml}</td><td style="text-align:right"><div class="row-actions" style="justify-content:flex-end;"><button class="btn btn-secondary btn-sm" data-edit-vendor="${esc(v.kode)}">Edit</button><button class="btn btn-secondary btn-sm" data-del-vendor="${esc(v.kode)}" ${delTxt} ${delStyle}>Hapus</button></div></td></tr>`;
  }).join("");
}
function resetVendorForm(){
  document.getElementById("v-kode").value="";
  document.getElementById("v-nama").value="";
  document.getElementById("v-pic").value="";
  document.getElementById("v-hp").value="";
  document.getElementById("v-alamat").value="";
  document.getElementById("v-ket").value="";
  document.getElementById("v-kode").disabled=false;
  state.editingVendorKode=null;
  document.getElementById("btn-vendor-save").textContent="Simpan Vendor";
  const vHint=document.getElementById("vendor-mode-hint");
vHint.innerHTML=`<i data-lucide="pencil-line"></i> Tambah Vendor Baru`;
vHint.className="mode-badge";
}
function loadVendorToForm(kode){
  const v=vendorByKode(kode);
  if(!v)return;
  document.getElementById("v-kode").value=v.kode;
  document.getElementById("v-kode").disabled=true;
  document.getElementById("v-nama").value=v.nama||"";
  document.getElementById("v-pic").value=v.pic||"";
  document.getElementById("v-hp").value=v.hp||"";
  document.getElementById("v-alamat").value=v.alamat||"";
  document.getElementById("v-ket").value=v.keterangan||"";
  state.editingVendorKode=kode;
  document.getElementById("btn-vendor-save").textContent="Update Vendor";
  const vHint=document.getElementById("vendor-mode-hint");
vHint.textContent=`<i data-lucide="pencil"></i> Edit Vendor: ${kode}`;
vHint.className="mode-badge edit";
  const formEl=document.getElementById("form-vendor");
  const sectionEl=formEl?formEl.closest(".section"):null;
  if(sectionEl){
    const rect=sectionEl.getBoundingClientRect();
    const y=rect.top+window.pageYOffset-20;
    window.scrollTo({top:Math.max(0,y),behavior:"smooth"});
    setTimeout(()=>{
      const inp=document.getElementById("v-nama");
      if(inp)inp.focus({preventScroll:true});
    },400);
  }
}

// ==================== MASTER BARANG ====================
function renderBarangMasterList(){
  const tbody=document.getElementById("barang-master-list");
  if(!tbody)return;
  if(DATA.items.length===0){
    tbody.innerHTML='<tr class="empty-row"><td colspan="6">Belum ada barang.</td></tr>';
    return;
  }
  tbody.innerHTML=DATA.items.map(it=>`<tr><td class="mono" style="font-weight:600;color:var(--steel-bright);">${esc(it.kode)}</td><td style="font-weight:600;">${esc(it.nama)}</td><td>${esc(it.kategori)||"-"}</td><td>${esc(it.satuan)}</td><td style="text-align:right">${it.stokAwal}</td><td style="text-align:right">${it.minimum}</td></tr>`).join("");
}

// ==================== PIC ====================
function renderPicList(){
  const tbody=document.getElementById("pic-list");
  if(!tbody)return;
  const q=state.picSearch.trim().toLowerCase();
  const usage={};
  DATA.transaksi.forEach(t=>{ if(t.pic)usage[t.pic]=(usage[t.pic]||0)+1; });
  const list=DATA.picList.filter(p=>{
    if(!q)return true;
    return p.nama.toLowerCase().includes(q)||(p.divisi||"").toLowerCase().includes(q)||(p.posisi||"").toLowerCase().includes(q);
  });
  if(list.length===0){
    tbody.innerHTML='<tr class="empty-row"><td colspan="6">Belum ada PIC.</td></tr>';
    return;
  }
  tbody.innerHTML=list.map(p=>{
    const trxCount=usage[p.nama]||0;
    const trxCell=trxCount>0?`<span class="badge badge-good">${trxCount} trx</span>`:`<span class="badge badge-neutral">0 trx</span>`;
    const statusCell=p.aktif!==false?`<span class="badge badge-good"><span class="badge-dot"></span>Aktif</span>`:`<span class="badge badge-neutral"><span class="badge-dot"></span>Nonaktif</span>`;
    const toggleBtn=p.aktif!==false
      ?`<button class="btn btn-secondary btn-sm" data-toggle-pic="${esc(p.nama)}" data-aktif="true">Nonaktifkan</button>`
      :`<button class="btn btn-secondary btn-sm" data-toggle-pic="${esc(p.nama)}" data-aktif="false" style="color:var(--good);">Aktifkan</button>`;
    const hapusBtn=p.aktif!==false?"":(canManageMaster()
      ?`<button class="btn btn-secondary btn-sm" data-del-pic="${esc(p.nama)}" style="color:var(--danger);">Hapus</button>`
      :`<button class="btn btn-secondary btn-sm" disabled title="Hanya Admin yang bisa menghapus" style="color:var(--ink-faint);">Hapus</button>`);
    return `<tr><td style="font-weight:600;">${esc(p.nama)}</td><td>${esc(p.divisi)||"-"}</td><td>${esc(p.posisi)||"-"}</td><td style="text-align:center">${trxCell}</td><td style="text-align:center">${statusCell}</td><td style="text-align:right"><div class="row-actions" style="justify-content:flex-end;"><button class="btn btn-secondary btn-sm" data-edit-pic="${esc(p.nama)}">Edit</button>${toggleBtn}${hapusBtn}</div></td></tr>`;
  }).join("");
}
function resetPicForm(){
  document.getElementById("pic-nama").value="";
  document.getElementById("pic-divisi").value="";
  document.getElementById("pic-posisi").value="";
  document.getElementById("pic-aktif").checked=true;
  document.getElementById("pic-nama").disabled=false;
  state.editingPicNama=null;
  document.getElementById("btn-pic-save").textContent="Simpan PIC";
  const pHint=document.getElementById("pic-mode-hint");
pHint.innerHTML=`<i data-lucide="pencil-line"></i> Tambah PIC Baru`;
pHint.className="mode-badge";
}
function loadPicToForm(nama){
  const p=picByNama(nama);
  if(!p)return;
  document.getElementById("pic-nama").value=p.nama;
  document.getElementById("pic-nama").disabled=true;
  document.getElementById("pic-divisi").value=p.divisi||"";
  document.getElementById("pic-posisi").value=p.posisi||"";
  document.getElementById("pic-aktif").checked=p.aktif!==false;
  state.editingPicNama=nama;
  document.getElementById("btn-pic-save").textContent="Update PIC";
  const pHint=document.getElementById("pic-mode-hint");
pHint.textContent=`<i data-lucide="pencil"></i> Edit PIC: ${nama}`;
pHint.className="mode-badge edit";
  const formEl=document.getElementById("form-pic");
  const sectionEl=formEl?formEl.closest(".section"):null;
  if(sectionEl){
    const rect=sectionEl.getBoundingClientRect();
    const y=rect.top+window.pageYOffset-20;
    window.scrollTo({top:Math.max(0,y),behavior:"smooth"});
    setTimeout(()=>{
      const inp=document.getElementById("pic-nama");
      if(inp)inp.focus({preventScroll:true});
    },400);
  }
}
function deletePic(nama){
  const p=picByNama(nama);
  if(!p)return;
  if(!canManageMaster()){alertModal("Akses ditolak","Hanya Admin yang bisa menghapus PIC.");return;}
  if(p.aktif!==false){alertModal("Tidak bisa hapus","PIC ini masih <b>aktif</b>. Nonaktifkan dulu sebelum menghapus.");return;}
  const usedCount=DATA.transaksi.filter(t=>t.pic===nama).length;
  const warnMsg=usedCount>0
    ?`PIC <b>${esc(nama)}</b> dipakai di ${usedCount} transaksi lama. Hapus permanen?`
    :`Yakin hapus PIC <b>${esc(nama)}</b> dari daftar master?`;
  confirmModal("Hapus PIC",warnMsg,async ()=>{
    const res=await dbDeletePic(p.id);
    if(res.error){alertModal("Gagal menghapus",esc(res.error.message));return;}
    if(state.editingPicNama===nama)resetPicForm();
    logAudit("delete","PIC",nama);
    await loadMasterData();
    render();
    toast("PIC dihapus","success",nama);
  },"Ya, Hapus");
}

// ==================== KELOLA BAGIAN ====================
function openKelolaBagianModal(opts){
  opts=opts||{};
  const onChanged=opts.onChanged||null;
  const getUsage=()=>{
    const u={};
    DATA.transaksi.forEach(t=>{ if(t.bagian)u[t.bagian]=(u[t.bagian]||0)+1; });
    return u;
  };
  const getOrphan=()=>{
    const o=new Set();
    DATA.transaksi.forEach(t=>{ if(t.bagian&&!DATA.bagianList.includes(t.bagian))o.add(t.bagian); });
    return [...o];
  };
  const renderList=()=>{
    const u=getUsage();
    const orphans=getOrphan();
    const masterHtml=DATA.bagianList.length===0
      ?`<div style="color:var(--ink-faint);font-size:12px;padding:12px 0;text-align:center;">Belum ada bagian.</div>`
      :DATA.bagianList.map((b,i)=>`<div class="manage-row"><div class="name">${esc(b)}<span class="count">${u[b]?`(${u[b]} trx)`:""}</span></div><div class="actions"><button class="btn btn-secondary btn-sm" type="button" data-rename data-idx="${i}"><i data-lucide="pencil"></i> Edit</button></div></div>`).join("");
    const orphanHtml=orphans.length===0?"":`<div style="margin-top:10px;font-size:11px;color:var(--ink-faint);">Bagian lama:</div>${orphans.map(b=>`<div class="manage-row"><div class="name">${esc(b)}<span class="count">(${u[b]||0} trx)</span></div><div class="actions"><button class="btn btn-secondary btn-sm" type="button" data-readd="${esc(b)}">+ Aktifkan</button></div></div>`).join("")}`;
    return masterHtml+orphanHtml;
  };
  const refreshList=()=>{
    document.getElementById("m-bagian-list").innerHTML=renderList();
    document.getElementById("m-bagian-count").textContent=DATA.bagianList.length;
    if(onChanged)onChanged();
  };
  openManageModal(`<div class="modal-title"><i data-lucide="settings"></i> Kelola Bagian Pemakaian</div><div class="modal-sub">Tambah bagian baru atau ubah nama bagian yang ada.</div><div class="field"><label>Tambah Bagian Baru</label><div style="display:flex;gap:8px;"><input type="text" id="m-bagian-new" placeholder="Cth: Packing, Gudang B" style="flex:1;" /><button class="btn btn-primary" type="button" id="m-bagian-add" style="width:auto;padding:10px 14px;">+ Tambah</button></div></div><div class="field" style="border-top:1px solid var(--line);padding-top:14px;margin-top:8px;"><label>Daftar Bagian (<span id="m-bagian-count">${DATA.bagianList.length}</span>)</label><div class="manage-list" id="m-bagian-list">${renderList()}</div></div><div class="modal-actions"><button class="btn btn-primary" type="button" id="m-bagian-done">Selesai</button></div>`);
  const addBagian=async ()=>{
    const inp=document.getElementById("m-bagian-new");
    const nama=inp.value.trim();
    if(!nama){alertModal("Nama kosong","Isi nama bagian dulu.");return;}
    if(DATA.bagianList.includes(nama)){alertModal("Sudah ada","Bagian itu sudah ada.");return;}
    const res=await dbInsertBagian(nama);
    if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
    inp.value="";
    logAudit("create","Bagian",nama);
    await loadMasterData();
    refreshList();
    render();
    toast("Bagian ditambahkan","success",nama);
  };
  document.getElementById("m-bagian-add").addEventListener("click",addBagian);
  document.getElementById("m-bagian-new").addEventListener("keydown",e=>{
    if(e.key==="Enter"){e.preventDefault();addBagian();}
  });
  document.getElementById("m-bagian-list").addEventListener("click",e=>{
    const readd=e.target.closest("[data-readd]");
    if(readd){
      const nama=readd.dataset.readd;
      if(!DATA.bagianList.includes(nama)){
        (async ()=>{
          const res=await dbInsertBagian(nama);
          if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
          logAudit("create","Bagian",nama);
          await loadMasterData();
          refreshList();
          render();
          toast("Bagian ditambahkan ke master","success",nama);
        })();
      }
      return;
    }
    const ren=e.target.closest("[data-rename]");
    if(ren){
      const idx=Number(ren.dataset.idx);
      const oldName=DATA.bagianList[idx];
      const row=ren.closest(".manage-row");
      row.innerHTML=`<input type="text" id="m-ren-tmp" value="${esc(oldName)}" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-size:12px;" /><div class="actions"><button class="btn btn-primary btn-sm" type="button" data-ren-save><i data-lucide="check"></i></button><button class="btn btn-secondary btn-sm" type="button" data-ren-cancel><i data-lucide="x"></i></button></div>`;
      const inp=document.getElementById("m-ren-tmp");
      setTimeout(()=>{inp.focus();inp.select();},20);
      const rowObj=(DATA.bagianRows||[]).find(x=>x.nama===oldName);
      const doSave=()=>{
        const baru=inp.value.trim();
        if(!baru){refreshList();return;}
        if(baru!==oldName&&DATA.bagianList.includes(baru)){alertModal("Sudah ada","Nama bagian itu sudah dipakai.");return;}
        if(baru===oldName){refreshList();return;}
        if(!rowObj){alertModal("Data tidak ditemukan","Bagian tidak ditemukan di database.");return;}
        const affected=DATA.transaksi.filter(t=>t.bagian===oldName);
        const applyRename=async alsoUpdateTrx=>{
          const res=await dbRenameBagian(rowObj.id, baru);
          if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
          if(alsoUpdateTrx)affected.forEach(t=>{t.bagian=baru;});
          logAudit("update","Bagian",`${oldName} -> ${baru}`);
          await loadMasterData();
          refreshList();
          render();
          toast("Bagian diubah","success",`${oldName} -> ${baru}${alsoUpdateTrx?` (${affected.length} trx)`:""}`);
        };
        if(affected.length>0){
          confirmModal("Update Transaksi Lama?",`Ada <b>${affected.length}</b> transaksi lama yang memakai bagian <b>${esc(oldName)}</b>.`,()=>applyRename(true),"Ya, Update Semua",()=>applyRename(false),"Master Saja");
        }else{
          applyRename(false);
        }
      };
      row.querySelector("[data-ren-save]").addEventListener("click",doSave);
      row.querySelector("[data-ren-cancel]").addEventListener("click",()=>refreshList());
      inp.addEventListener("keydown",e=>{
        if(e.key==="Enter"){e.preventDefault();doSave();}
        if(e.key==="Escape"){e.preventDefault();refreshList();}
      });
      return;
    }
  });
  document.getElementById("m-bagian-done").addEventListener("click",()=>closeManageModal());
}
// ==================== AUTO KODE BARANG ====================
function generateNextKode(prefix){
  if(!prefix) prefix="BP-";
  const pattern=new RegExp("^"+escRegex(prefix)+"(\\d+)$","i");
  let max=0;
  DATA.items.forEach(it=>{
    const m=String(it.kode).match(pattern);
    if(m){
      const n=parseInt(m[1],10);
      if(!isNaN(n)&&n>max)max=n;
    }
  });
  return prefix+String(max+1).padStart(3,"0");
}
// ==================== HAPUS BARANG ====================
async function deleteBarang(kode, onDone){
  const it=itemByKode(kode);
  if(!it)return;
  if(!canManageMaster()){alertModal("Akses ditolak","Hanya Admin yang bisa menghapus barang.");return;}
  const trxCount=DATA.transaksi.filter(t=>t.kode===kode).length;
  const beliCount=DATA.pembelian.filter(r=>r.kode===kode).length;
  const usedCount=trxCount+beliCount;
  const warnMsg=usedCount>0
    ?`Barang <b>${esc(it.nama)}</b> masih dipakai di <b>${trxCount}</b> transaksi dan <b>${beliCount}</b> baris pembelian.<br><br>Menghapus barang bisa membuat data transaksi terkait tidak lengkap. Lanjutkan?`
    :`Yakin hapus barang <b>${esc(it.nama)}</b> (${esc(it.kode)})?`;
  confirmModal("Hapus Barang",warnMsg,async ()=>{
    const res=await dbDeleteItem(kode);
    if(res.error){alertModal("Gagal menghapus",esc(res.error.message));return;}
    logAudit("delete","Barang",kode,it.nama);
    await loadMasterData();
    render();
    toast("Barang dihapus","success",it.nama);
    if(typeof onDone==="function")onDone();
  },"Ya, Hapus");
}

// ==================== KELOLA BARANG ====================
function openKelolaBarangModal(opts){
  const afterAdd=opts&&opts.afterAdd;
  const renderList=()=>DATA.items.length===0
    ?`<div style="color:var(--ink-faint);font-size:12px;padding:12px 0;text-align:center;">Belum ada barang.</div>`
    :DATA.items.map(it=>{
      const delBtn=canManageMaster()
        ?`<button class="btn btn-secondary btn-sm" type="button" data-del-barang="${esc(it.kode)}" style="color:var(--danger);">Hapus</button>`
        :`<button class="btn btn-secondary btn-sm" type="button" disabled title="Hanya Admin yang bisa menghapus" style="color:var(--ink-faint);">Hapus</button>`;
      return `<div class="manage-row"><div class="name">${esc(it.kode)} - ${esc(it.nama)}<span class="count">(stok: ${it.stokAwal} ${esc(it.satuan)})</span></div><div class="actions"><button class="btn btn-secondary btn-sm" type="button" data-edit-barang="${esc(it.kode)}">Edit</button>${delBtn}</div></div>`;
    }).join("");
  const renderListSection=()=>`<div style="border-top:1px solid var(--line);padding-top:14px;"><label style="display:block;font-size:11px;font-weight:700;color:var(--ink-muted);text-transform:uppercase;margin-bottom:6px;">Daftar Barang (${DATA.items.length})</label><button class="btn btn-ghost" type="button" id="m-br-add-btn" style="margin-bottom:10px;">+ Tambah Barang Baru</button><div class="manage-list" id="m-barang-list">${renderList()}</div></div>`;
  const renderForm=kodeEdit=>{
    const it=kodeEdit?itemByKode(kodeEdit):null;
    const isEdit=!!it;
    return `<div class="manage-form"><div style="font-size:11px;font-weight:700;color:var(--steel-bright);text-transform:uppercase;margin-bottom:10px;">${isEdit?`Edit Barang: ${esc(it.kode)}`:"Tambah Barang Baru"}</div><div class="field"><label>Kode Barang ${isEdit?"":'<span style="color:var(--danger)">*</span>'}</label><input type="text" id="m-br-kode" value="${isEdit?esc(it.kode):""}" placeholder="Cth: BP-005" style="text-transform:uppercase" ${isEdit?"disabled":""} />${isEdit?"":'<div class="helper"><i data-lucide="sparkles"></i> Kode terisi otomatis. Bisa diubah manual kalau perlu.</div>'}</div><div class="field"><label>Nama Barang <span style="color:var(--danger)">*</span></label><input type="text" id="m-br-nama" value="${isEdit?esc(it.nama):""}" /></div><div class="field"><label>Kategori</label><input type="text" id="m-br-kategori" value="${isEdit?esc(it.kategori):"Bahan Packing"}" /></div><div class="field"><label>Satuan</label><input type="text" id="m-br-satuan" value="${isEdit?esc(it.satuan):"Roll"}" /></div><div class="field"><label>Stok Awal</label><input type="number" id="m-br-stok" value="${isEdit?it.stokAwal:0}" min="0" /></div><div class="field"><label>Stok Minimum (ROP)</label><input type="number" id="m-br-min" value="${isEdit?it.minimum:10}" min="0" /></div><div class="actions"><button class="btn btn-primary" type="button" id="m-br-save">${isEdit?"Simpan Perubahan":"Simpan Barang"}</button><button class="btn btn-secondary" type="button" id="m-br-cancel">Batal</button></div></div>`;
  };
  openManageModal(`<div class="modal-title"><i data-lucide="settings"></i> Kelola Barang</div><div class="modal-sub">Tambah barang baru atau ubah data barang.</div><div id="m-barang-content">${renderListSection()}</div><div class="modal-actions"><button class="btn btn-primary" type="button" id="m-barang-done">Selesai</button></div>`);
  const refreshContent=()=>{
    document.getElementById("m-barang-content").innerHTML=renderListSection();
    bindList();
  };
  const bindList=()=>{
    const a=document.getElementById("m-br-add-btn");
    if(a)a.addEventListener("click",()=>openForm(null));
    const l=document.getElementById("m-barang-list");
    if(l)l.addEventListener("click",e=>{
      const del=e.target.closest("[data-del-barang]");
      if(del){deleteBarang(del.dataset.delBarang,refreshContent);return;}
      const ed=e.target.closest("[data-edit-barang]");
      if(ed)openForm(ed.dataset.editBarang);
    });
  };
  const openForm=kodeEdit=>{
    document.getElementById("m-barang-content").innerHTML=renderForm(kodeEdit);
    const kInp=document.getElementById("m-br-kode");
    if(!kodeEdit&&kInp){
      // Auto isi kode dengan format BP-XXX, increment dari yang terakhir
      kInp.value=generateNextKode("BP-");
      setTimeout(()=>{
        // Fokus ke nama (bukan kode), karena kode sudah terisi otomatis
        const nInp=document.getElementById("m-br-nama");
        if(nInp)nInp.focus();
      },30);
    }
    document.getElementById("m-br-cancel").addEventListener("click",()=>refreshContent());
    document.getElementById("m-br-save").addEventListener("click",async ()=>{
      const kode=(document.getElementById("m-br-kode").value||"").trim().toUpperCase();
      const nama=document.getElementById("m-br-nama").value.trim();
      const kategori=document.getElementById("m-br-kategori").value.trim()||"Bahan Packing";
      const satuan=document.getElementById("m-br-satuan").value.trim()||"Roll";
      const stokAwal=parseInt(document.getElementById("m-br-stok").value,10)||0;
      const minimum=parseInt(document.getElementById("m-br-min").value,10)||0;
      if(!nama){alertModal("Data belum lengkap","Nama Barang wajib diisi.");return;}
      if(kodeEdit){
        if(!itemByKode(kodeEdit)){alertModal("Barang tidak ditemukan","");refreshContent();return;}
        const res=await dbSaveItem({kode:kodeEdit,nama,kategori,satuan,stokAwal,minimum}, true);
        if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
        logAudit("update","Barang",kodeEdit,`${nama}`);
        toast("Barang diperbarui","success",`${kodeEdit} — ${nama}`);
        await loadMasterData();
        refreshItemDropdowns();
        render();
        refreshContent();
        setTimeout(checkStockAndNotify,300);
      }else{
        if(!kode){alertModal("Data belum lengkap","Kode Barang wajib diisi.");return;}
        if(itemByKode(kode)){alertModal("Kode sudah dipakai",`Barang dengan kode "${kode}" sudah ada.`);return;}
        const res=await dbSaveItem({kode,nama,kategori,satuan,stokAwal,minimum}, false);
        if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
        logAudit("create","Barang",kode,`${nama}`);
        await loadMasterData();
        refreshItemDropdowns();
        render();
        toast("Barang ditambahkan","success",`${kode} — ${nama}`);
        setTimeout(checkStockAndNotify,300);
        if(typeof afterAdd==="function"){closeManageModal();afterAdd(kode);return;}
        refreshContent();
      }
    });
  };
  bindList();
  document.getElementById("m-barang-done").addEventListener("click",()=>closeManageModal());
}

// ==================== LAPORAN ====================
function renderLaporan(){
  const barangBody=document.getElementById("rekap-barang-body");
  const picBody=document.getElementById("rekap-pic-body");
  const hint=document.getElementById("laporan-hint");
  const banner=document.getElementById("rekap-compare-banner");
  const thCmp=document.getElementById("th-cmp");
  const thCmpPic=document.getElementById("th-cmp-pic");
  if(!barangBody)return;

  if(!state.laporanShown){
    barangBody.innerHTML='<tr class="empty-row"><td colspan="4">Pilih periode lalu klik Tampilkan.</td></tr>';
    picBody.innerHTML='<tr class="empty-row"><td colspan="4">Pilih periode lalu klik Tampilkan.</td></tr>';
    hint.textContent="Pilih periode lalu klik Tampilkan.";
    if(banner)banner.hidden=true;
    if(thCmp)thCmp.style.display="none";
    if(thCmpPic)thCmpPic.style.display="none";
    return;
  }

  const inRange=(dt,f,t)=>dt>=f&&dt<=t;
  const rows=DATA.transaksi.filter(t=>inRange(t.tanggal,state.laporanFrom,state.laporanTo));

  // ===== PERIODE PEMBANDING = bulan kalender sebelumnya (C) =====
  let rowsPrev=null, prevFrom=null, prevTo=null;
  const showCmp = state.laporanCompare;
  if(showCmp){
    prevFrom = shiftMonthKeepDay(state.laporanFrom, -1);
    prevTo   = shiftMonthKeepDay(state.laporanTo, -1);
    prevFrom.setHours(0,0,0,0);
    prevTo.setHours(23,59,59,999);
    rowsPrev = DATA.transaksi.filter(t=>inRange(t.tanggal,prevFrom,prevTo));
    if(banner){
      banner.hidden=false;
      banner.innerHTML=`<i data-lucide="bar-chart-3"></i> <b>Perbandingan kalender</b><span class="sep">·</span> ${fmtTgl(prevFrom)} – ${fmtTgl(prevTo)} <span class="sep">vs</span> ${fmtTgl(state.laporanFrom)} – ${fmtTgl(state.laporanTo)}<span class="sep">·</span> ${rowsPrev.length} trx sebelumnya`;
    }
    if(thCmp)thCmp.style.display="";
    if(thCmpPic)thCmpPic.style.display="";
    hint.innerHTML=`Menampilkan <b>${rows.length}</b> transaksi · ${fmtTgl(state.laporanFrom)} – ${fmtTgl(state.laporanTo)} · dibanding <b>${rowsPrev.length}</b> trx bulan lalu`;
  }else{
    hint.textContent=`Menampilkan ${rows.length} transaksi dari ${fmtTgl(state.laporanFrom)} - ${fmtTgl(state.laporanTo)}.`;
    if(banner)banner.hidden=true;
    if(thCmp)thCmp.style.display="none";
    if(thCmpPic)thCmpPic.style.display="none";
  }

  const colCount = showCmp ? 5 : 4;

  // ===== Per Barang =====
  const perBarang=DATA.items.map(it=>{
    const masuk=rows.filter(t=>t.kode===it.kode&&t.jenis==="Masuk").reduce((a,t)=>a+t.jumlah,0);
    const keluar=rows.filter(t=>t.kode===it.kode&&t.jenis==="Keluar").reduce((a,t)=>a+t.jumlah,0);
    const rate=avgDailyKeluar(it.kode,state.laporanFrom,state.laporanTo);
    let keluarPrev=null;
    if(showCmp&&rowsPrev){
      keluarPrev=rowsPrev.filter(t=>t.kode===it.kode&&t.jenis==="Keluar").reduce((a,t)=>a+t.jumlah,0);
    }
    return {nama:it.nama,satuan:it.satuan,masuk,keluar,rate:rate.toFixed(1),keluarPrev};
  });

  function deltaCell(cur, prev){
    if(!showCmp) return "";
    if(prev===null||prev===undefined) return `<td></td>`;
    if(prev===0&&cur===0){
      return `<td style="text-align:right;"><span class="cmp-delta flat">＝ 0</span></td>`;
    }
    if(prev===0&&cur>0){
      return `<td style="text-align:right;"><span class="cmp-delta new">▲ Baru</span></td>`;
    }
    const d=cur-prev;
    const pct=Math.round((d/prev)*100);
    if(d===0){
      return `<td style="text-align:right;"><span class="cmp-delta flat">＝ 0</span></td>`;
    }
    const cls = d>0 ? "up" : "down";
    const arrow = d>0 ? "▲" : "▼";
    const sign = d>0 ? "+" : "";
    return `<td style="text-align:right;"><span class="cmp-delta ${cls}">${arrow} ${sign}${d} (${sign}${pct}%)</span></td>`;
  }

  if(perBarang.length){
    barangBody.innerHTML=perBarang.map(r=>`<tr>
<td>${esc(r.nama)}</td>
<td style="text-align:right">${r.masuk} ${esc(r.satuan)}</td>
<td style="text-align:right">${r.keluar} ${esc(r.satuan)}</td>
<td style="text-align:right" title="Total OUT dibagi jumlah hari kalender dalam periode">${r.rate}/hari</td>
${deltaCell(r.keluar, r.keluarPrev)}
</tr>`).join("");
  }else{
    barangBody.innerHTML=`<tr class="empty-row"><td colspan="${colCount}">Tidak ada transaksi di periode ini.</td></tr>`;
  }

  // ===== Per PIC =====
  const buildPicMap=(arr)=>{
    const m={};
    arr.filter(t=>t.jenis==="Keluar").forEach(t=>{
      m[t.pic]=m[t.pic]||{count:0,qty:0};
      m[t.pic].count+=1;
      m[t.pic].qty+=t.jumlah;
    });
    return m;
  };
  const picMap=buildPicMap(rows);
  const picPrevMap=rowsPrev?buildPicMap(rowsPrev):null;
  const picRows=Object.entries(picMap);

  if(picRows.length){
    picBody.innerHTML=picRows.map(([pic,v])=>{
      const info=picInfoStr(pic);
      const prevQty = picPrevMap ? (picPrevMap[pic]?.qty || 0) : null;
      return `<tr>
<td>${esc(pic)}</td>
<td class="sub">${esc(info)||"-"}</td>
<td style="text-align:right">${v.count}</td>
<td style="text-align:right">${v.qty}</td>
${deltaCell(v.qty, prevQty)}
</tr>`;
    }).join("");
  }else{
    picBody.innerHTML=`<tr class="empty-row"><td colspan="${colCount}">Tidak ada transaksi OUT di periode ini.</td></tr>`;
  }

  window._lastPerBarang=perBarang;
}

// ==================== LAPORAN PEMBELIAN & PEMBAYARAN ====================
function fmtRupiahLaporan(n){ return "Rp "+(n||0).toLocaleString("id-ID"); }

function cardLaporan(label,value,warn){
  return `<div class="stat-card${warn?" warn-card":""}" style="padding:14px 16px;">
    <div class="stat-name">${esc(label)}</div>
    <div class="stat-value" style="font-size:20px;margin-top:6px;">${value}</div>
  </div>`;
}

function initVendorSelects(){
  const opts = Object.values(DATA.vendors).map(v=>`<option value="${esc(v.kode)}">${esc(v.nama)}</option>`).join("");
  const a=document.getElementById("pb-vendor");
  if(a){ const cur=a.value; a.innerHTML='<option value="">Semua Vendor</option>'+opts; a.value=cur; }
  const b=document.getElementById("pay-vendor");
  if(b){ const cur=b.value; b.innerHTML='<option value="">Semua Vendor</option>'+opts; b.value=cur; }
}

// dua tanggal default: bulan ini
function setLaporanPbDefault(){
  const now=new Date();
  const from=new Date(now.getFullYear(),now.getMonth(),1);
  const to=new Date(now.getFullYear(),now.getMonth()+1,0);
  const f=fmtInputDate(from), t=fmtInputDate(to);
  const pd=document.getElementById("pb-dari"); if(pd && !pd.value) pd.value=f;
  const ps=document.getElementById("pb-sampai"); if(ps && !ps.value) ps.value=t;
  const yd=document.getElementById("pay-dari"); if(yd && !yd.value) yd.value=f;
  const ys=document.getElementById("pay-sampai"); if(ys && !ys.value) ys.value=t;
}

function renderLaporanPembelian(){
  const body=document.getElementById("pb-body"); if(!body) return;
  const dariV=document.getElementById("pb-dari").value;
  const sampaiV=document.getElementById("pb-sampai").value;
  const vendor=document.getElementById("pb-vendor").value;
  if(!dariV||!sampaiV){ body.innerHTML='<tr class="empty-row"><td colspan="7">Isi periode dulu.</td></tr>'; return; }
  const from=new Date(dariV+"T00:00:00"), to=new Date(sampaiV+"T23:59:59");
  let rows=DATA.pembelian.filter(r=>r.tglSJ && r.tglSJ>=from && r.tglSJ<=to);
  if(vendor) rows=rows.filter(r=>r.vendor===vendor);
  rows=rows.slice().sort((a,b)=>b.tglSJ-a.tglSJ);
  if(rows.length===0){
    body.innerHTML='<tr class="empty-row"><td colspan="7">Tidak ada pembelian pada periode ini.</td></tr>';
    document.getElementById("pb-cards").innerHTML="";
    document.getElementById("pb-total").textContent="";
    return;
  }
  let total=0, sjs=new Set(), vendors=new Set();
  body.innerHTML=rows.map(r=>{
    const it=itemByKode(r.kode)||{nama:r.kode,satuan:""};
    const sub=(r.qty||0)*(r.hargaPcs||0);
    total+=sub; sjs.add(r.vendor+"::"+normalizeSJ(r.sj)); vendors.add(r.vendor);
    return `<tr>
      <td>${esc(fmtTgl(r.tglSJ))}</td>
      <td class="mono">${esc(r.sj)}</td>
      <td>${esc(vendorNama(r.vendor))}</td>
      <td><b>${esc(it.nama)}</b></td>
      <td style="text-align:right">${r.qty} ${esc(it.satuan)}</td>
      <td style="text-align:right">${r.hargaPcs?fmtRupiahLaporan(r.hargaPcs):"-"}</td>
      <td style="text-align:right">${sub?fmtRupiahLaporan(sub):"-"}</td>
    </tr>`;
  }).join("");
  document.getElementById("pb-cards").innerHTML=
    cardLaporan("Total Nilai Pembelian", fmtRupiahLaporan(total), false)+
    cardLaporan("Jumlah SJ", sjs.size+" SJ", false)+
    cardLaporan("Jumlah Vendor", vendors.size+" vendor", false);
  document.getElementById("pb-total").textContent=`Total ${rows.length} baris - ${fmtRupiahLaporan(total)}`;
  document.getElementById("pb-hint").textContent=`${fmtTgl(from)} - ${fmtTgl(to)}`;
  refreshIcons();
}

function renderLaporanPembayaran(){
  const body=document.getElementById("pay-body"); if(!body) return;
  const dariV=document.getElementById("pay-dari").value;
  const sampaiV=document.getElementById("pay-sampai").value;
  const vendor=document.getElementById("pay-vendor").value;
  if(!dariV||!sampaiV){ body.innerHTML='<tr class="empty-row"><td colspan="7">Isi periode dulu.</td></tr>'; return; }
  const from=new Date(dariV+"T00:00:00"), to=new Date(sampaiV+"T23:59:59");
  // dikelompokkan per SJ (pembayaran = SJ yang sudah lunas)
  let groups=pembelianGroups().filter(g=>g.lunas && g.tglLunas && g.tglLunas>=from && g.tglLunas<=to);
  if(vendor) groups=groups.filter(g=>g.vendor===vendor);
  groups=groups.sort((a,b)=>b.tglLunas-a.tglLunas);
  if(groups.length===0){
    body.innerHTML='<tr class="empty-row"><td colspan="7">Tidak ada pembayaran pada periode ini.</td></tr>';
    document.getElementById("pay-cards").innerHTML="";
    document.getElementById("pay-total").textContent="";
    return;
  }
  let total=0, vendors=new Set();
  body.innerHTML=groups.map(g=>{
    total+=g.total; vendors.add(g.vendor);
    return `<tr>
      <td>${esc(fmtTgl(g.tglLunas))}</td>
      <td class="mono">${esc(g.sj)}</td>
      <td>${esc(vendorNama(g.vendor))}</td>
      <td class="mono">${esc(g.invoice||"-")}</td>
      <td style="text-align:right">${fmtRupiahLaporan(g.total)}</td>
      <td style="text-align:right">${fmtRupiahLaporan(g.total)}</td>
      <td class="sub">${esc(g.buktiLunas||"-")}</td>
    </tr>`;
  }).join("");
  const rata=Math.round(total/groups.length);
  document.getElementById("pay-cards").innerHTML=
    cardLaporan("Total Dibayar", fmtRupiahLaporan(total), false)+
    cardLaporan("Jumlah SJ Lunas", groups.length+" SJ", false)+
    cardLaporan("Jumlah Vendor", vendors.size+" vendor", false)+
    cardLaporan("Rata-rata / SJ", fmtRupiahLaporan(rata), false);
  document.getElementById("pay-total").textContent=`Total ${groups.length} SJ - ${fmtRupiahLaporan(total)}`;
  document.getElementById("pay-hint").textContent=`${fmtTgl(from)} - ${fmtTgl(to)}`;
  refreshIcons();
}

function csvLaporanPembelian(){
  const dariV=document.getElementById("pb-dari").value, sampaiV=document.getElementById("pb-sampai").value;
  const vendor=document.getElementById("pb-vendor").value;
  if(!dariV||!sampaiV){ alertModal("Periode belum diisi","Isi tanggal dulu."); return; }
  const from=new Date(dariV+"T00:00:00"), to=new Date(sampaiV+"T23:59:59");
  let rows=DATA.pembelian.filter(r=>r.tglSJ && r.tglSJ>=from && r.tglSJ<=to);
  if(vendor) rows=rows.filter(r=>r.vendor===vendor);
  rows=rows.slice().sort((a,b)=>b.tglSJ-a.tglSJ);
  const out=rows.map(r=>{
    const it=itemByKode(r.kode)||{nama:r.kode,satuan:""};
    return [fmtTgl(r.tglSJ), r.sj, vendorNama(r.vendor), it.nama, r.qty, it.satuan, r.hargaPcs||0, (r.qty||0)*(r.hargaPcs||0)];
  });
  downloadCSV("laporan-pembelian.csv",["Tgl Datang","No SJ","Vendor","Barang","Qty","Satuan","Harga","Subtotal"],out);
  toast("CSV diunduh","success","laporan-pembelian.csv");
}
function csvLaporanPembayaran(){
  const dariV=document.getElementById("pay-dari").value, sampaiV=document.getElementById("pay-sampai").value;
  const vendor=document.getElementById("pay-vendor").value;
  if(!dariV||!sampaiV){ alertModal("Periode belum diisi","Isi tanggal dulu."); return; }
  const from=new Date(dariV+"T00:00:00"), to=new Date(sampaiV+"T23:59:59");
  let groups=pembelianGroups().filter(g=>g.lunas && g.tglLunas && g.tglLunas>=from && g.tglLunas<=to);
  if(vendor) groups=groups.filter(g=>g.vendor===vendor);
  groups=groups.sort((a,b)=>b.tglLunas-a.tglLunas);
  const out=groups.map(g=>[fmtTgl(g.tglLunas), g.sj, vendorNama(g.vendor), g.invoice||"-", g.total, g.total, g.buktiLunas||"-"]);
  downloadCSV("laporan-pembayaran.csv",["Tgl Lunas","No SJ","Vendor","Invoice","Total Tagihan","Dibayar","Bukti"],out);
  toast("CSV diunduh","success","laporan-pembayaran.csv");
}

// ==================== CLOCK ====================
function tickClock(){
  const now=new Date();
  document.getElementById("clock-date").textContent=now.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"});
  document.getElementById("clock-time").textContent=now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
}

// ==================== BROWSER NOTIFICATION ====================
const NOTIF_FLAG_KEY = "inv_notif_enabled_v1";
function notifSupported(){ return typeof Notification !== "undefined"; }
function notifPermission(){ return notifSupported() ? Notification.permission : "unsupported"; }
function notifEnabled(){
  try{ return localStorage.getItem(NOTIF_FLAG_KEY) === "1"; }catch(e){ return false; }
}
function setNotifEnabled(v){
  try{
    if(v) localStorage.setItem(NOTIF_FLAG_KEY,"1");
    else localStorage.removeItem(NOTIF_FLAG_KEY);
  }catch(e){}
}
async function requestNotifPermission(){
  if(!notifSupported()){ alertModal("Tidak didukung","Browser kamu tidak mendukung Web Notification."); return false; }
  if(Notification.permission==="granted"){ setNotifEnabled(true); return true; }
  if(Notification.permission==="denied"){
    alertModal("Notifikasi diblokir","Izinkan notifikasi lewat pengaturan browser (ikon kunci di address bar).");
    return false;
  }
  const res=await Notification.requestPermission();
  if(res==="granted"){ setNotifEnabled(true); return true; }
  return false;
}
function sendNotif(title,body){
  if(!notifEnabled()||notifPermission()!=="granted") return;
  try{
    const n=new Notification(title,{body:body,icon:"",tag:"inv-mp-"+Date.now()});
    setTimeout(()=>{ try{n.close();}catch(e){} },8000);
  }catch(e){}
}
const NOTIF_STATE_KEY = "inv_notif_state_v1";
const NOTIF_COOLDOWN_MS = 30 * 60 * 1000;
function getNotifState(){
  try{ return JSON.parse(localStorage.getItem(NOTIF_STATE_KEY)||"{}"); }catch(e){ return {}; }
}
function setNotifState(key,ts){
  try{ localStorage.setItem(NOTIF_STATE_KEY, JSON.stringify({key:key,ts:ts||Date.now()})); }catch(e){}
}
function clearNotifState(){
  try{ localStorage.removeItem(NOTIF_STATE_KEY); }catch(e){}
}
function checkStockAndNotify(){
  if(!notifEnabled()||!CURRENT_SESSION) return;
  const restock=DATA.items.filter(it=>currentStock(it.kode)<=it.minimum);
  if(restock.length===0){ clearNotifState(); return; }
  const key=restock.map(r=>r.kode+":"+currentStock(r.kode)).join("|");
  const prev=getNotifState();
  const sameKey = prev.key===key;
  const withinCooldown = prev.ts && (Date.now()-prev.ts) < NOTIF_COOLDOWN_MS;
  // Skip bila kondisi sama & masih dalam cooldown; tetap kirim bila kondisi berubah.
  if(sameKey && withinCooldown) return;
  setNotifState(key);
  const list=restock.slice(0,5).map(r=>`• ${r.nama} (${currentStock(r.kode)}/${r.minimum})`).join("\n");
  const more=restock.length>5?`\n+${restock.length-5} lainnya`:"";
  sendNotif(`<i data-lucide="alert-triangle"></i> ${restock.length} barang stok kritis`, list+more);
}
setInterval(checkStockAndNotify, 5*60*1000);

// ==================== LOGIN SYSTEM ====================
document.getElementById("toggle-pwd").addEventListener("click",()=>{
  const inp=document.getElementById("login-pass");
  const btn=document.getElementById("toggle-pwd");
  if(inp.type==="password"){
    inp.type="text";btn.innerHTML=`<i data-lucide="eye-off"></i>`;btn.title="Sembunyikan password";
  }else{
    inp.type="password";btn.innerHTML=`<i data-lucide="eye"></i>`;btn.title="Tampilkan password";
  }
});
document.getElementById("login-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const username=document.getElementById("login-user").value.trim().toLowerCase();
  const password=document.getElementById("login-pass").value;
  const errBox=document.getElementById("login-error");
  const errMsg=document.getElementById("login-error-msg");
  const userInp=document.getElementById("login-user");
  const passInp=document.getElementById("login-pass");
  const btn=document.getElementById("login-btn");
  userInp.classList.remove("error");
  passInp.classList.remove("error");
  errBox.hidden=true;
  if(!username||!password){
    errMsg.textContent="Isi username & password dulu.";
    errBox.hidden=false;
    if(!username)userInp.classList.add("error");
    if(!password)passInp.classList.add("error");
    return;
  }
  const lockRem=getLockRemaining(username);
  if(lockRem>0){
    errMsg.textContent=`Terlalu banyak percobaan gagal. Coba lagi dalam ${fmtDurasi(lockRem)}.`;
    errBox.hidden=false;
    userInp.classList.add("error");passInp.classList.add("error");
    passInp.value="";passInp.focus();
    return;
  }
  btn.disabled=true;btn.textContent="Memeriksa...";
  let result;
  try{
    result=await authLogin(username,password);
  }catch(err){
    result={ok:false,error:"Tidak bisa menghubungi server. Cek koneksi internet."};
  }
  btn.disabled=false;btn.textContent="Masuk";

  if(!result.ok){
    const until=registerFailedAttempt(username);
    if(until>Date.now()){
      errMsg.textContent=`Terlalu banyak percobaan gagal. Akun dikunci ${fmtDurasi(until-Date.now())}.`;
      logAuditAnon("login-fail","User",username,"akun dikunci sementara");
    }else{
      const sisa=MAX_LOGIN_ATTEMPTS-((getLoginAttempts()[username]||{}).count||0);
      errMsg.textContent=(result.error||"Username atau password salah.")+(sisa>0?` Sisa ${sisa} percobaan.`:"");
      logAuditAnon("login-fail","User",username,"login gagal");
    }
    errBox.hidden=false;
    userInp.classList.add("error");passInp.classList.add("error");
    passInp.value="";passInp.focus();
    return;
  }

  clearLoginAttempts(username);
  const p=result.profile;
  const session={
    id:p.id,
    username:p.username,
    nama:p.nama,
    role:p.role,
    avatar:p.avatar||p.username.slice(0,2).toUpperCase(),
    expiresAt:Date.now()+SESSION_MS
  };
  enterDashboard(session);
  logAudit("login","User",session.username);
  toast("Login berhasil","success",`Selamat datang, ${p.nama}`);
  if(notifSupported() && Notification.permission==="granted" && !notifEnabled()){
    setNotifEnabled(true);
  }else if(notifSupported() && Notification.permission==="default"){
    setTimeout(()=>{
      confirmModal("Aktifkan Notifikasi Stok?",
        "Izinkan notifikasi browser untuk peringatan stok kritis? Kamu akan dapat pemberitahuan otomatis saat ada barang di bawah stok minimum.",
        async()=>{
          const ok=await requestNotifPermission();
          if(ok){ toast("Notifikasi diaktifkan","success","Akan muncul saat stok kritis"); }
        },
        "Ya, Aktifkan",
        ()=>{ toast("Notifikasi tidak diaktifkan","info","Bisa diaktifkan nanti"); },
        "Nanti Saja");
    }, 2000);
  }
  setTimeout(checkStockAndNotify,1500);
});
async function enterDashboard(session){
  CURRENT_SESSION=session;
  document.getElementById("login-screen").classList.add("hide");
  setTimeout(()=>{ document.getElementById("login-screen").style.display="none"; },350);
  document.getElementById("dashboard").classList.add("show");
  await loadMasterData();
  const roleCls=session.role==="Admin"?"admin":"operator";
  document.getElementById("user-avatar").textContent=session.avatar||session.username.slice(0,2).toUpperCase();
  document.getElementById("user-name").textContent=session.nama;
  document.getElementById("user-role").textContent=session.role;
  const badge=document.getElementById("user-role-badge");
  badge.textContent=session.role;
  badge.className=`role-badge-mini ${roleCls}`;
  document.getElementById("dd-who").textContent=session.nama;
  document.getElementById("dd-role").textContent=`${session.role} · @${session.username}`;
  document.getElementById("session-user").textContent=session.nama;
  document.getElementById("session-bar").hidden=false;
  document.getElementById("dd-manage-users").hidden=session.role!=="Admin";
  applyTheme(getTheme());
  applySidebarPrefs();
  tickClock();
  render();
  startSessionTimer(session);
  if(typeof startRealtime==="function") startRealtime();
}

// ==================== SESSION TIMER ====================
let sessionTimerInterval=null;
let sessionProfileCheckCounter=0;
function startSessionTimer(session){
  stopSessionTimer();
  sessionProfileCheckCounter=0;
  updateRemaining(session.expiresAt);
  sessionTimerInterval=setInterval(async ()=>{
    if(Date.now()>=session.expiresAt){
      stopSessionTimer();
      await authLogout();
      CURRENT_SESSION=null;
      autoLogout("Sesi habis setelah 8 jam. Silakan login ulang.");
      return;
    }
    updateRemaining(session.expiresAt);
    tickClock();
    // Cek status akun ke server setiap ~30 detik
    sessionProfileCheckCounter++;
    if(sessionProfileCheckCounter>=30){
      sessionProfileCheckCounter=0;
      const prof=await authFetchProfile(session.id);
      if(!prof || prof.aktif===false){
        stopSessionTimer();
        await authLogout();
        CURRENT_SESSION=null;
        autoLogout("Akun kamu telah dinonaktifkan oleh Admin.");
      }
    }
  },1000);
}
function stopSessionTimer(){
  if(sessionTimerInterval){ clearInterval(sessionTimerInterval); sessionTimerInterval=null; }
}
function updateRemaining(expiresAt){
  const diff=Math.max(0,expiresAt-Date.now());
  const h=Math.floor(diff/3600000);
  const m=Math.floor((diff%3600000)/60000);
  const s=Math.floor((diff%60000)/1000);
  document.getElementById("session-remain").textContent=`${h}j ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
}
function autoLogout(msg){
  if(typeof stopRealtime==="function") stopRealtime();
  document.getElementById("dashboard").classList.remove("show");
  document.getElementById("login-screen").style.display="flex";
  document.getElementById("session-bar").hidden=true;
  closeMobileSidebar();
  setTimeout(()=>document.getElementById("login-screen").classList.remove("hide"),10);
  document.getElementById("login-user").value="";
  document.getElementById("login-pass").value="";
  document.getElementById("user-dropdown").hidden=true;
  document.getElementById("user-menu-btn").setAttribute("aria-expanded","false");
  toast("Sesi berakhir","info",msg);
}
function doLogout(){
  if(CURRENT_SESSION) logAudit("logout","User",CURRENT_SESSION.username);
  if(typeof stopRealtime==="function") stopRealtime();
  authLogout();
  CURRENT_SESSION=null;
  document.getElementById("dashboard").classList.remove("show");
  document.getElementById("login-screen").style.display="flex";
  document.getElementById("session-bar").hidden=true;
  closeMobileSidebar();
  setTimeout(()=>document.getElementById("login-screen").classList.remove("hide"),10);
  document.getElementById("login-user").value="";
  document.getElementById("login-pass").value="";
  document.getElementById("login-user").focus();
  stopSessionTimer();
  document.getElementById("user-dropdown").hidden=true;
  document.getElementById("user-menu-btn").setAttribute("aria-expanded","false");
  toast("Logout berhasil","info","Sesi diakhiri");
}
document.getElementById("dd-logout").addEventListener("click",doLogout);
document.getElementById("sb-logout").addEventListener("click",()=>{ closeMobileSidebar(); doLogout(); });

// ==================== SIDEBAR EVENTS ====================
document.getElementById("sb-collapse").addEventListener("click",toggleSidebarCollapse);
document.getElementById("sb-toggle").addEventListener("click",()=>{
  const sh=document.getElementById("app-shell");
  if(sh.classList.contains("sb-open")) closeMobileSidebar();
  else openMobileSidebar();
});
document.getElementById("sb-backdrop").addEventListener("click",closeMobileSidebar);
document.getElementById("sb-theme").addEventListener("click",()=>{ toggleTheme(); });

// ==================== USER MENU DROPDOWN ====================
document.getElementById("user-menu-btn").addEventListener("click",e=>{
  e.stopPropagation();
  const dd=document.getElementById("user-dropdown");
  const btn=document.getElementById("user-menu-btn");
  const open=dd.hidden;
  dd.hidden=!open;
  btn.setAttribute("aria-expanded",String(open));
});
document.addEventListener("click",e=>{
  const dd=document.getElementById("user-dropdown");
  if(!dd.hidden&&!e.target.closest(".user-menu")){
    dd.hidden=true;
    document.getElementById("user-menu-btn").setAttribute("aria-expanded","false");
  }
});

// ==================== AUDIT MENU ====================
document.getElementById("dd-audit").addEventListener("click",()=>{
  document.getElementById("user-dropdown").hidden=true;
  document.getElementById("user-menu-btn").setAttribute("aria-expanded","false");
  openAuditModal();
});

// ==================== USER MANAGEMENT ====================
let editingUsername=null;
document.getElementById("dd-manage-users").addEventListener("click",()=>{
  if(!canManageUser()){
    toast("Akses ditolak","error","Hanya Admin yang bisa kelola user");
    return;
  }
  document.getElementById("user-dropdown").hidden=true;
  document.getElementById("user-menu-btn").setAttribute("aria-expanded","false");
  openUsersModal();
});
function openUsersModal(){
  document.getElementById("modal-users").hidden=false;
  renderUserList();
}
document.getElementById("modal-users-close").addEventListener("click",()=>{
  document.getElementById("modal-users").hidden=true;
});
document.getElementById("modal-users").addEventListener("click",e=>{
  if(e.target.id==="modal-users") document.getElementById("modal-users").hidden=true;
});
async function renderUserList(){
  const session=CURRENT_SESSION||{};
  const list=document.getElementById("user-list");
  if(!list)return;
  list.innerHTML='<div style="text-align:center;padding:24px;color:var(--ink-faint);font-size:13px;">Memuat...</div>';
  const sb=supabaseClient();
  if(!sb){
    list.innerHTML='<div style="text-align:center;padding:24px;color:var(--ink-faint);font-size:13px;">Supabase belum dikonfigurasi.</div>';
    return;
  }
  const res=await sb.from("profiles").select("*").order("created_at",{ascending:true});
  if(res.error){
    list.innerHTML='<div style="text-align:center;padding:24px;color:var(--danger);font-size:13px;">Gagal memuat user: '+esc(res.error.message)+'</div>';
    return;
  }
  const rows=res.data||[];
  if(rows.length===0){
    list.innerHTML='<div style="text-align:center;padding:24px;color:var(--ink-faint);font-size:13px;">Belum ada user.</div>';
    return;
  }
  list.innerHTML=rows.map(u=>{
    const roleCls=u.role==="Admin"?"admin":"operator";
    const statusBadge=u.aktif!==false
      ?'<span class="badge badge-aktif">Aktif</span>'
      :'<span class="badge badge-nonaktif">Nonaktif</span>';
    const isMe=u.username===session.username;
    const toggleLabel=u.aktif!==false?"Nonaktifkan":"Aktifkan";
    const toggleBtn=isMe?"":`<button class="btn btn-secondary btn-sm" data-action="toggle" data-user="${esc(u.username)}">${toggleLabel}</button>`;
    const deleteBtn=isMe?"":`<button class="btn btn-secondary btn-sm" data-action="delete" data-user="${esc(u.username)}" style="color:var(--danger);">Hapus</button>`;
    return `<div class="user-row ${u.aktif===false?'nonaktif':''}"><div class="u-avatar">${esc(u.avatar||u.username.slice(0,2).toUpperCase())}</div><div class="u-info"><div class="u-name">${esc(u.nama)}<span class="badge badge-${roleCls}">${esc(u.role)}</span>${statusBadge}${isMe?'<span style="font-size:10px;color:var(--steel-bright);font-weight:600;">(kamu)</span>':''}</div><div class="u-meta">@${esc(u.username)}</div></div><div class="u-actions"><button class="btn btn-secondary btn-sm" data-action="edit" data-user="${esc(u.username)}">Edit</button>${toggleBtn}${deleteBtn}</div></div>`;
  }).join("");
}
document.getElementById("user-list").addEventListener("click",e=>{
  const btn=e.target.closest("[data-action]");
  if(!btn)return;
  const action=btn.dataset.action;
  const username=btn.dataset.user;
  if(action==="edit")openUserForm(username);
  else if(action==="toggle")toggleUser(username);
  else if(action==="delete")deleteUserConfirm(username);
});
document.getElementById("btn-add-user").addEventListener("click",()=>openUserForm(null));

async function toggleUser(username){
  const sb=supabaseClient();
  const res0=await sb.from("profiles").select("*").eq("username",username).maybeSingle();
  const u=res0.data;
  if(!u){toast("User tidak ditemukan","error");return;}
  const newState=u.aktif===false?true:false;
  const res=await dbManageUser({action:"update",username:username,aktif:newState});
  if(res.error){toast("Gagal","error",res.error.message);return;}
  logAudit("update","User",username,newState?"diaktifkan":"dinonaktifkan");
  await renderUserList();
  toast(newState?"User diaktifkan":"User dinonaktifkan","success",u.nama);
}
function deleteUserConfirm(username){
  confirmModal("Hapus User",`Yakin hapus user <b>@${esc(username)}</b>?<br><br>Tindakan ini tidak bisa dibatalkan.`,async ()=>{
    const res=await dbManageUser({action:"delete",username:username});
    if(res.error){alertModal("Gagal menghapus",esc(res.error.message));return;}
    logAudit("delete","User",username,"");
    await renderUserList();
    toast("User dihapus","success",username);
  },"Ya, Hapus");
}

function openUserForm(username){
  editingUsername=username;
  const isEdit=username!==null;
  const form=document.getElementById("modal-user-form");
  const title=document.getElementById("modal-form-title");
  const sub=document.getElementById("modal-form-sub");
  const pwdHelp=document.getElementById("uf-password-helper");
  if(isEdit){
    title.textContent=`Edit User - @${username}`;
    sub.textContent="Ubah data user. Kosongkan password jika tidak ingin ganti.";
    document.getElementById("uf-username").value=username;
    document.getElementById("uf-username").disabled=true;
    document.getElementById("uf-password").value="";
    document.getElementById("uf-password").placeholder="(kosongkan jika tidak ganti)";
    pwdHelp.textContent="Kosongkan jika tidak ingin mengganti password.";
    // isi nama & role dari DB
    supabaseClient().from("profiles").select("*").eq("username",username).maybeSingle().then(r=>{
      const u=r.data; if(!u)return;
      document.getElementById("uf-nama").value=u.nama;
      document.getElementById("uf-role").value=u.role;
    });
  }else{
    title.textContent="Tambah User Baru";
    sub.textContent="Isi data user dengan lengkap.";
    document.getElementById("uf-username").value="";
    document.getElementById("uf-username").disabled=false;
    document.getElementById("uf-nama").value="";
    document.getElementById("uf-role").value="Operator";
    document.getElementById("uf-password").value="";
    document.getElementById("uf-password").placeholder="Minimal 6 karakter";
    pwdHelp.textContent="Untuk user baru, wajib diisi.";
  }
  form.hidden=false;
  setTimeout(()=>document.getElementById(isEdit?"uf-nama":"uf-username").focus(),40);
}
document.getElementById("modal-form-cancel").addEventListener("click",()=>{
  document.getElementById("modal-user-form").hidden=true;
  editingUsername=null;
});
document.getElementById("modal-user-form").addEventListener("click",e=>{
  if(e.target.id==="modal-user-form"){
    document.getElementById("modal-user-form").hidden=true;
    editingUsername=null;
  }
});
document.getElementById("modal-form-save").addEventListener("click",async ()=>{
  const username=document.getElementById("uf-username").value.trim().toLowerCase();
  const nama=document.getElementById("uf-nama").value.trim();
  const role=document.getElementById("uf-role").value;
  const password=document.getElementById("uf-password").value;
  if(!username){toast("Username wajib diisi","error");return;}
  if(!nama){toast("Nama wajib diisi","error");return;}
  let res;
  if(editingUsername){
    const payload={action:"update",username:editingUsername,nama:nama,role:role};
    if(password)payload.password=password;
    res=await dbManageUser(payload);
    if(res.error){toast("Gagal","error",res.error.message);return;}
    logAudit("update","User",editingUsername,nama);
    toast("User diperbarui","success",nama);
  }else{
    if(!/^[a-z0-9_]+$/.test(username)){toast("Username tidak valid","error","Gunakan huruf kecil, angka, atau _");return;}
    if(!password||password.length<6){toast("Password minimal 6 karakter","error");return;}
    res=await dbManageUser({action:"create",username:username,nama:nama,role:role,password:password,aktif:true});
    if(res.error){toast("Gagal","error",res.error.message);return;}
    logAudit("create","User",username,nama);
    toast("User ditambahkan","success","@"+username);
  }
  document.getElementById("modal-user-form").hidden=true;
  editingUsername=null;
  await renderUserList();
});

// ==================== UBAH PASSWORD SENDIRI ====================
document.getElementById("dd-change-pwd").addEventListener("click",()=>{
  document.getElementById("user-dropdown").hidden=true;
  document.getElementById("user-menu-btn").setAttribute("aria-expanded","false");
  const session=CURRENT_SESSION||{};
  document.getElementById("cp-who").textContent=`${session.nama} (@${session.username})`;
  document.getElementById("cp-old").value="";
  document.getElementById("cp-new").value="";
  document.getElementById("cp-confirm").value="";
  document.getElementById("modal-change-pwd").hidden=false;
  setTimeout(()=>document.getElementById("cp-old").focus(),40);
});
document.getElementById("modal-cp-cancel").addEventListener("click",()=>{
  document.getElementById("modal-change-pwd").hidden=true;
});
document.getElementById("modal-change-pwd").addEventListener("click",e=>{
  if(e.target.id==="modal-change-pwd") document.getElementById("modal-change-pwd").hidden=true;
});
document.getElementById("modal-cp-save").addEventListener("click",async ()=>{
  const session=CURRENT_SESSION;
  if(!session){toast("Sesi tidak ditemukan","error");return;}
  const sb=supabaseClient();
  if(!sb){toast("Supabase belum dikonfigurasi","error");return;}
  const newPwd=document.getElementById("cp-new").value;
  const confirmPwd=document.getElementById("cp-confirm").value;
  if(!newPwd||newPwd.length<6){toast("Password baru minimal 6 karakter","error");return;}
  if(newPwd!==confirmPwd){toast("Konfirmasi tidak cocok","error");return;}
  // Supabase tidak butuh password lama untuk update; user sudah login.
  const res=await sb.auth.updateUser({password:newPwd});
  if(res.error){toast("Gagal ubah password","error",res.error.message);return;}
  logAudit("update","Password",session.username,"diubah sendiri");
  document.getElementById("modal-change-pwd").hidden=true;
  toast("Password berhasil diubah","success","Gunakan password baru saat login berikutnya");
});

// ==================== MODAL INPUT INVOICE ====================
function openInvoiceModal(key){
  const g=findGroupByKey(key);
  if(!g)return;
  const existingFiles=[...(g.fotoInvoiceFiles||[])];
  const rowsHtml=g.items.map(it=>{
    const item=itemByKode(it.kode);
    return `<div class="item-row"><div class="item-name">${esc(item.nama)}<span class="item-sub"> — ${it.qty} ${esc(item.satuan)}</span></div><span class="sub">Harga / ${esc(item.satuan)}</span><input type="number" class="m-harga" data-kode="${esc(it.kode)}" min="1" placeholder="0" value="${it.hargaPcs||""}" /></div>`;
  }).join("");
  openModal(`<div class="modal-title">Input Invoice — ${esc(g.sj)}</div><div class="modal-sub">${esc(vendorNama(g.vendor))}</div><div class="field"><label>Tgl Invoice Datang</label><input type="date" id="m-tgl-inv" value="${g.tglInvoiceDatang?fmtInputDate(g.tglInvoiceDatang):fmtInputDate(TODAY)}" /></div><div class="field"><label>No. Invoice</label><input type="text" id="m-no-inv" placeholder="INV-xxxx" value="${esc(g.invoice||"")}" /></div><div class="field"><label>Upload Foto Invoice (bisa pilih >1 file)</label><input type="file" id="m-inv-files" accept="image/*,application/pdf" multiple /><div class="helper">JPG, PNG, atau PDF. Maks 8MB per file. Gambar otomatis dikompres.</div><div class="file-preview-box" id="m-inv-preview"></div></div><div class="field"><label>Harga per Barang</label>${rowsHtml}</div><div class="modal-total" id="m-total">Total: Rp 0</div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-cancel>Batal</button><button class="btn btn-primary" type="button" id="m-save">Simpan</button></div>`);
  renderFileChips(document.getElementById("m-inv-preview"),existingFiles);
  function recompute(){
    let total=0;
    document.querySelectorAll(".m-harga").forEach(inp=>{
      const it=g.items.find(x=>x.kode===inp.dataset.kode);
      total+=it.qty*(parseInt(inp.value,10)||0);
    });
    document.getElementById("m-total").textContent="Total: "+fmtRupiah(total);
  }
  document.querySelectorAll(".m-harga").forEach(inp=>inp.addEventListener("input",recompute));
  recompute();
  document.getElementById("m-inv-files").addEventListener("change",async e=>{
    const newFiles=await readFiles(e.target.files);
    existingFiles.push(...newFiles);
    renderFileChips(document.getElementById("m-inv-preview"),existingFiles);
    e.target.value="";
  });
  document.querySelector("[data-cancel]").addEventListener("click",()=>closeModal(true));
  document.getElementById("m-save").addEventListener("click",()=>{
    const noInv=document.getElementById("m-no-inv").value.trim();
    if(!noInv){alertModal("Data belum lengkap","Isi No. Invoice dulu.");return;}
    const tglVal=document.getElementById("m-tgl-inv").value;
    if(!checkNotFuture(tglVal,"Tgl Invoice"))return;
    if(!checkDateOrder(tglVal,fmtInputDate(g.tglSJ),"Tgl Invoice","Tgl SJ"))return;
    const hargaMap={};let anyZero=false;
    document.querySelectorAll(".m-harga").forEach(inp=>{
      const v=parseInt(inp.value,10)||0;
      if(v<=0)anyZero=true;
      hargaMap[inp.dataset.kode]=v;
    });
    if(anyZero){alertModal("Harga belum lengkap","Semua harga barang harus > 0.");return;}
    const doSave=async ()=>{
      const tglInv=new Date(tglVal+"T00:00:00");
      const refKeySJ=sjKey(g.vendor,g.sj);
      // Upload file invoice baru ke Storage (yang belum punya path)
      for(const f of existingFiles){
        if(!f.path){
          const up=await dbUploadFile(refKeySJ,"Invoice",g.vendor,g.sj,f);
          if(up.error){toast("Gagal upload file","error",f.name);}
        }
      }
      for(const it of g.items){
        const payload={
          sj:g.sj, vendor:g.vendor, tglSJ:it.tglSJ, kode:it.kode, qty:it.qty,
          hargaPcs:(hargaMap[it.kode]!=null)?hargaMap[it.kode]:it.hargaPcs,
          invoice:noInv,
          tglInvoiceDatang:tglInv,
          tglFinance:it.tglFinance,
          lunas:it.lunas,
          tglLunas:it.tglLunas,
          buktiLunas:it.buktiLunas
        };
        const res=await dbUpdatePembelianById(it.id,payload);
        if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
      }
      logAudit("update","Invoice",noInv,`SJ ${g.sj}`);
      await loadTransaksiDanPembelian();
      closeModal();render();
      toast("Invoice tersimpan","success",`${g.sj} - ${noInv}`);
    };
    const norm=normalizeInvoice(noInv);
    const bentrok=DATA.pembelian.find(r=>r.invoice&&normalizeInvoice(r.invoice)===norm&&!(r.sj===g.sj&&r.vendor===g.vendor));
    if(bentrok){
      confirmModal("No. Invoice sudah dipakai",`Invoice <b>${esc(noInv)}</b> sudah dipakai di SJ <b>${esc(bentrok.sj)}</b> (${esc(vendorNama(bentrok.vendor))}).<br><br>Kalau ini memang invoice gabungan untuk beberapa SJ, lanjutkan.`,()=>doSave(),"Ya, Lanjutkan");
    }else{
      doSave();
    }
  });
}

// ==================== MODAL FINANCE ====================
function openFinanceModal(key){
  const g=findGroupByKey(key);
  if(!g)return;
  openModal(`<div class="modal-title">Kirim ke Finance — ${esc(g.sj)}</div><div class="modal-sub">${esc(vendorNama(g.vendor))} • Invoice ${esc(g.invoice)} • ${fmtRupiah(g.total)}</div><div class="field"><label>Tgl Diserahkan ke Finance</label><input type="date" id="m-tgl-fin" value="${fmtInputDate(TODAY)}" /></div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-cancel>Batal</button><button class="btn btn-primary" type="button" id="m-save">Konfirmasi Kirim</button></div>`);
  document.querySelector("[data-cancel]").addEventListener("click",()=>closeModal(true));
  document.getElementById("m-save").addEventListener("click",async ()=>{
    const tglVal=document.getElementById("m-tgl-fin").value;
    if(!checkNotFuture(tglVal,"Tgl Finance"))return;
    if(g.tglInvoiceDatang&&!checkDateOrder(tglVal,fmtInputDate(g.tglInvoiceDatang),"Tgl Finance","Tgl Invoice"))return;
    const tgl=new Date(tglVal+"T00:00:00");
    for(const it of g.items){
      const payload={
        sj:g.sj, vendor:g.vendor, tglSJ:it.tglSJ, kode:it.kode, qty:it.qty,
        hargaPcs:it.hargaPcs, invoice:it.invoice, tglInvoiceDatang:it.tglInvoiceDatang,
        tglFinance:tgl, lunas:it.lunas, tglLunas:it.tglLunas, buktiLunas:it.buktiLunas
      };
      const res=await dbUpdatePembelianById(it.id,payload);
      if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
    }
    logAudit("update","Finance",g.sj,"SJ dikirim ke Finance");
    await loadTransaksiDanPembelian();
    closeModal();render();
    toast("Dikirim ke Finance","success",g.sj);
  });
}

// ==================== MODAL TANDAI LUNAS ====================
function openLunasModal(key){
  const g=findGroupByKey(key);
  if(!g)return;
  const files=[...(g.buktiLunasFiles||[])];
  openModal(`<div class="modal-title">Tandai Lunas — ${esc(g.sj)}</div><div class="modal-sub">${esc(vendorNama(g.vendor))} • Invoice ${esc(g.invoice)} • ${fmtRupiah(g.total)}</div><div class="field"><label>Tgl Pelunasan</label><input type="date" id="m-tgl-lunas" value="${fmtInputDate(TODAY)}" /></div><div class="field"><label>Upload Bukti Lunas (bisa pilih >1 file)</label><input type="file" id="m-bukti-files" accept="image/*,application/pdf" multiple /><div class="helper">JPG, PNG, atau PDF. Maks 8MB per file. Gambar otomatis dikompres.</div><div class="file-preview-box" id="m-bukti-preview"></div></div><div class="field"><label for="m-bukti-ket">Keterangan (opsional)</label><input type="text" id="m-bukti-ket" placeholder="Cth: Transfer BCA" /></div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-cancel>Batal</button><button class="btn btn-primary" type="button" id="m-save">Tandai Lunas</button></div>`);
  renderFileChips(document.getElementById("m-bukti-preview"),files);
  document.getElementById("m-bukti-files").addEventListener("change",async e=>{
    const nf=await readFiles(e.target.files);
    files.push(...nf);
    renderFileChips(document.getElementById("m-bukti-preview"),files);
    e.target.value="";
  });
  document.querySelector("[data-cancel]").addEventListener("click",()=>closeModal(true));
  document.getElementById("m-save").addEventListener("click",async ()=>{
    const tglVal=document.getElementById("m-tgl-lunas").value;
    if(!tglVal){alertModal("Tanggal belum diisi","Tanggal pelunasan wajib diisi.");return;}
    if(!checkNotFuture(tglVal,"Tgl Pelunasan"))return;
    if(g.tglFinance&&!checkDateOrder(tglVal,fmtInputDate(g.tglFinance),"Tgl Pelunasan","Tgl Finance"))return;
    const tgl=new Date(tglVal+"T00:00:00");
    const ket=document.getElementById("m-bukti-ket").value.trim();
    let bukti="-";
    if(files.length===1){bukti=files[0].name;if(ket)bukti+=" - "+ket;}
    else if(files.length>1){bukti=`${files.length} file`;if(ket)bukti+=" - "+ket;}
    else if(ket){bukti=ket;}
    const refKeySJ=sjKey(g.vendor,g.sj);
    for(const f of files){
      if(!f.path){
        const up=await dbUploadFile(refKeySJ,"Bukti",g.vendor,g.sj,f);
        if(up.error){toast("Gagal upload file","error",f.name);}
      }
    }
    for(const it of g.items){
      const payload={
        sj:g.sj, vendor:g.vendor, tglSJ:it.tglSJ, kode:it.kode, qty:it.qty,
        hargaPcs:it.hargaPcs, invoice:it.invoice, tglInvoiceDatang:it.tglInvoiceDatang,
        tglFinance:it.tglFinance, lunas:true, tglLunas:tgl, buktiLunas:bukti
      };
      const res=await dbUpdatePembelianById(it.id,payload);
      if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
    }
    logAudit("update","Pelunasan",g.sj,`${fmtRupiah(g.total)}`);
    await loadTransaksiDanPembelian();
    closeModal();render();
    toast("SJ ditandai lunas","success",`${g.sj} - ${fmtRupiah(g.total)}`);
  });
}

// ==================== MODAL EDIT PEMBELIAN ====================
function openEditPembelianModal(key){
  const g=findGroupByKey(key);
  if(!g)return;
  const sjFiles=[...(g.fotoSJFiles||[])];
  const invFiles=[...(g.fotoInvoiceFiles||[])];
  const lunasFiles=[...(g.buktiLunasFiles||[])];
  const rowsHtml=g.items.map(it=>{
    const item=itemByKode(it.kode);
    return `<div class="item-row"><div class="item-name">${esc(item.nama)}</div><span class="sub">Qty (${esc(item.satuan)})</span><input type="number" class="m-qty" data-kode="${esc(it.kode)}" value="${it.qty}" min="1" step="1" /><span class="sub">Harga/${esc(item.satuan)}</span><input type="number" class="m-harga2" data-kode="${esc(it.kode)}" value="${it.hargaPcs||""}" min="0" /></div>`;
  }).join("");
  const lunasSection=g.lunas?`<div class="field" style="border-top:1px solid var(--line);padding-top:14px;"><label>Bukti Lunas</label><input type="file" id="m-edit-lunas-files" accept="image/*,application/pdf" multiple /><div class="helper">Tambah file baru. File lama tetap ada.</div><div class="file-preview-box" id="m-edit-lunas-preview"></div></div>`:"";
  openModal(`<div class="modal-title">Edit — ${esc(g.sj)}</div><div class="modal-sub">${esc(vendorNama(g.vendor))} · Perbaiki data jika salah input</div><div class="field"><label>Tgl Barang Datang</label><input type="date" id="m-edit-tgl" value="${fmtInputDate(g.tglSJ)}" /></div><div class="field"><label>No. Surat Jalan</label><input type="text" id="m-edit-sj" value="${esc(g.sj)}" /></div><div class="field"><label>Vendor</label><select id="m-edit-vendor">${Object.values(DATA.vendors).map(v=>`<option value="${esc(v.kode)}" ${v.kode===g.vendor?"selected":""}>${esc(v.nama)}</option>`).join("")}</select></div><div class="field"><label>Foto SJ (tambah file baru)</label><input type="file" id="m-edit-sj-files" accept="image/*,application/pdf" multiple /><div class="file-preview-box" id="m-edit-sj-preview"></div></div><div class="field"><label>No. Invoice</label><input type="text" id="m-edit-inv" value="${esc(g.invoice||"")}" placeholder="INV-xxxx" /></div><div class="field"><label>Foto Invoice (tambah file baru)</label><input type="file" id="m-edit-inv-files" accept="image/*,application/pdf" multiple /><div class="file-preview-box" id="m-edit-inv-preview"></div></div><div class="field"><label>Tgl Invoice Datang</label><input type="date" id="m-edit-inv-tgl" value="${g.tglInvoiceDatang?fmtInputDate(g.tglInvoiceDatang):""}" /></div><div class="field"><label>Tgl Diserahkan ke Finance</label><input type="date" id="m-edit-fin-tgl" value="${g.tglFinance?fmtInputDate(g.tglFinance):""}" /></div><div class="field"><label>Barang</label>${rowsHtml}</div>${lunasSection}<div class="modal-actions"><button class="btn btn-secondary" type="button" data-cancel>Batal</button><button class="btn btn-primary" type="button" id="m-save">Simpan Perubahan</button></div>`);
  renderFileChips(document.getElementById("m-edit-sj-preview"),sjFiles);
  renderFileChips(document.getElementById("m-edit-inv-preview"),invFiles);
  const lunasPreviewEl=document.getElementById("m-edit-lunas-preview");
  if(lunasPreviewEl)renderFileChips(lunasPreviewEl,lunasFiles);
  document.getElementById("m-edit-sj-files").addEventListener("change",async e=>{
    const nf=await readFiles(e.target.files);
    sjFiles.push(...nf);
    renderFileChips(document.getElementById("m-edit-sj-preview"),sjFiles);
    e.target.value="";
  });
  document.getElementById("m-edit-inv-files").addEventListener("change",async e=>{
    const nf=await readFiles(e.target.files);
    invFiles.push(...nf);
    renderFileChips(document.getElementById("m-edit-inv-preview"),invFiles);
    e.target.value="";
  });
  const editLunasInput=document.getElementById("m-edit-lunas-files");
  if(editLunasInput)editLunasInput.addEventListener("change",async e=>{
    const nf=await readFiles(e.target.files);
    lunasFiles.push(...nf);
    renderFileChips(document.getElementById("m-edit-lunas-preview"),lunasFiles);
    e.target.value="";
  });
  document.querySelector("[data-cancel]").addEventListener("click",()=>closeModal(true));
  document.getElementById("m-save").addEventListener("click",()=>{
    const tglVal=document.getElementById("m-edit-tgl").value;
    if(!tglVal){alertModal("Tanggal wajib diisi","Tgl Barang Datang tidak boleh kosong.");return;}
    if(!checkNotFuture(tglVal,"Tgl Barang Datang"))return;
    const sjBaru=document.getElementById("m-edit-sj").value.trim();
    if(!sjBaru){alertModal("Data belum lengkap","No. Surat Jalan wajib diisi.");return;}
    const invTglVal=document.getElementById("m-edit-inv-tgl").value;
    const finTglVal=document.getElementById("m-edit-fin-tgl").value;
    if(invTglVal&&!checkDateOrder(invTglVal,tglVal,"Tgl Invoice","Tgl SJ"))return;
    if(finTglVal&&invTglVal&&!checkDateOrder(finTglVal,invTglVal,"Tgl Finance","Tgl Invoice"))return;
    if(invTglVal&&!checkNotFuture(invTglVal,"Tgl Invoice"))return;
    if(finTglVal&&!checkNotFuture(finTglVal,"Tgl Finance"))return;
    const tgl=new Date(tglVal+"T00:00:00");
    const vendor=document.getElementById("m-edit-vendor").value;
    const inv=document.getElementById("m-edit-inv").value.trim();
    const qtyMap={},hargaMap={};
    let qtyTakValid=null;
    document.querySelectorAll(".m-qty").forEach(inp=>{
      const n=parseNumber(inp.value);
      qtyMap[inp.dataset.kode]=n;
      if(qtyTakValid===null&&(!isValidInt(n)||n<=0))qtyTakValid=inp.dataset.kode;
    });
    document.querySelectorAll(".m-harga2").forEach(inp=>{
      hargaMap[inp.dataset.kode]=parseInt(inp.value,10)||0;
    });
    if(qtyTakValid!==null){
      const nm=itemByKode(qtyTakValid)?itemByKode(qtyTakValid).nama:qtyTakValid;
      alertModal("Jumlah tidak valid",`Jumlah untuk <b>${esc(nm)}</b> harus berupa bilangan bulat positif.`);return;
    }
    const sjBerubah=sjBaru!==g.sj;
    const vendorBerubah=vendor!==g.vendor;
    if(sjBerubah||vendorBerubah){
      const normBaru=normalizeSJ(sjBaru);
      const bentrok=DATA.pembelian.find(r=>r.vendor===vendor&&normalizeSJ(r.sj)===normBaru&&!(r.sj===g.sj&&r.vendor===g.vendor));
      if(bentrok){
        alertModal("Kombinasi SJ & Vendor sudah ada",`SJ <b>${esc(sjBaru)}</b> untuk vendor <b>${esc(vendorNama(vendor))}</b> sudah ada (diinput ${fmtTgl(bentrok.tglSJ)}).`);
        return;
      }
    }
    const doSave=async ()=>{
      const oldKey=sjKey(g.vendor,g.sj);
      const newKey=sjKey(vendor,sjBaru);
      // Update setiap baris pembelian (berdasarkan id)
      for(const it of g.items){
        const payload={
          sj:sjBaru, vendor, tglSJ:tgl, kode:it.kode,
          qty:(qtyMap[it.kode]||it.qty),
          hargaPcs:(hargaMap[it.kode]!=null&&hargaMap[it.kode]>0)?hargaMap[it.kode]:null,
          invoice:inv||null,
          tglInvoiceDatang:invTglVal?new Date(invTglVal+"T00:00:00"):null,
          tglFinance:finTglVal?new Date(finTglVal+"T00:00:00"):null,
          lunas:it.lunas,
          tglLunas:it.tglLunas,
          buktiLunas:it.buktiLunas
        };
        const res=await dbUpdatePembelianById(it.id, payload);
        if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
      }
      // Jika SJ/vendor berubah, relink transaksi auto-stock lama lalu rebuild
      if(sjBerubah||vendorBerubah){
        for(const t of DATA.transaksi){
          if(t.refKey===oldKey){
            const upd=await dbUpdateTransaksi(t.id,{
              tanggal:t.tanggal,kode:t.kode,jenis:t.jenis,jumlah:t.jumlah,
              pic:t.pic,ket:"SJ "+sjBaru,bagian:t.bagian,refKey:newKey
            });
            if(upd.error){alertModal("Gagal relink transaksi",esc(upd.error.message));return;}
          }
        }
      }
      // Muat ulang agar DATA.pembelian & transaksi sinkron sebelum sync
      await loadTransaksiDanPembelian();
      const sync=await syncSJToTransaksi(sjBaru,vendor);
      if(sync && sync.ok===false){alertModal("Gagal sinkron stok",esc(sync.error));return;}
      logAudit("update","Pembelian",sjBaru,sjBerubah?`SJ: ${g.sj} -> ${sjBaru}`:"diedit");
      await loadTransaksiDanPembelian();
      closeModal();render();
      toast("Perubahan tersimpan","success",sjBerubah?`SJ: ${g.sj} -> ${sjBaru}`:g.sj);
    };
    if(inv){
      const normInv=normalizeInvoice(inv);
      const bentrokInv=DATA.pembelian.find(r=>r.invoice&&normalizeInvoice(r.invoice)===normInv&&!(r.sj===g.sj&&r.vendor===g.vendor));
      if(bentrokInv){
        confirmModal("No. Invoice sudah dipakai",`Invoice <b>${esc(inv)}</b> sudah dipakai di SJ <b>${esc(bentrokInv.sj)}</b> (${esc(vendorNama(bentrokInv.vendor))}).<br><br>Kalau memang invoice gabungan, lanjutkan.`,()=>doSave(),"Ya, Lanjutkan");
        return;
      }
    }
    doSave();
  });
}

// ==================== MODAL EDIT TRANSAKSI ====================
function openEditTransaksiModal(idx){
  const t=DATA.transaksi[idx];
  const isAutoStock=t.refSJ!=null;
  const buildBagianOptions=()=>{
    const list=[...DATA.bagianList];
    let html="";
    if(t.bagian&&!list.includes(t.bagian)){
      html+=`<option value="${esc(t.bagian)}" selected>${esc(t.bagian)} (tidak aktif)</option>`;
    }
    html+=list.map(b=>`<option value="${esc(b)}" ${b===t.bagian?"selected":""}>${esc(b)}</option>`).join("");
    if(!t.bagian)html=`<option value="" selected>-- (IN: tidak perlu bagian) --</option>`+html;
    return html;
  };
  const buildPicOptions=()=>{
    let html="";
    if(t.pic&&!picByNama(t.pic)){
      html+=`<option value="${esc(t.pic)}" selected>${esc(t.pic)} (tidak ada di master)</option>`;
    }
    html+=DATA.picList.map(p=>{
      const label=p.aktif!==false?p.nama:`${p.nama} (nonaktif)`;
      const selected=p.nama===t.pic?" selected":"";
      return `<option value="${esc(p.nama)}"${selected}>${esc(label)}</option>`;
    }).join("");
    return html;
  };
  openModal(`<div class="modal-title">Edit Transaksi</div>${isAutoStock?`<div class="modal-sub" style="background:var(--warn-dim);border-color:var(--warn-border);color:var(--warn);padding:8px 10px;border-radius:8px;"><i data-lucide="link"></i> Transaksi ini berasal dari SJ <b>${esc(t.refSJ)}</b>. Tanggal, barang &amp; qty terkunci — ubah lewat tab Pembelian.</div>`:""}<div class="field"><label>Tanggal</label><input type="date" id="m-t-tgl" value="${fmtInputDate(t.tanggal)}" ${isAutoStock?"disabled":""} /></div><div class="field"><label>Barang</label><select id="m-t-barang" ${isAutoStock?"disabled":""}>${DATA.items.map(i=>`<option value="${esc(i.kode)}" ${i.kode===t.kode?"selected":""}>${esc(i.nama)}</option>`).join("")}</select></div><div class="field"><label>Jenis</label><select id="m-t-jenis" ${isAutoStock?"disabled":""}><option value="Masuk" ${t.jenis==="Masuk"?"selected":""}>IN</option><option value="Keluar" ${t.jenis==="Keluar"?"selected":""}>OUT</option></select></div><div class="field"><label>Qty</label><input type="number" id="m-t-qty" value="${t.jumlah}" min="1" step="1" ${isAutoStock?"disabled":""} /></div><div class="field" id="m-t-bagian-wrap"><label style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><span>Bagian Pemakaian</span><button type="button" class="btn btn-secondary btn-tiny" id="m-t-kelola-bagian"><i data-lucide="settings"></i> Kelola</button></label><select id="m-t-bagian" ${isAutoStock?"disabled":""}>${buildBagianOptions()}</select></div><div class="field"><label>PIC</label><select id="m-t-pic">${buildPicOptions()}</select></div><div class="field"><label>Keterangan</label><input type="text" id="m-t-ket" value="${esc(t.ket||"")}" ${isAutoStock?"disabled":""} /></div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-cancel>Batal</button><button class="btn btn-primary" type="button" id="m-save">Simpan</button></div>`);
  const jenisSelect=document.getElementById("m-t-jenis");
  const bagianWrap=document.getElementById("m-t-bagian-wrap");
  const toggleBagian=()=>{
    bagianWrap.style.display=jenisSelect.value==="Keluar"?"":"none";
  };
  jenisSelect.addEventListener("change",toggleBagian);
  toggleBagian();
  document.getElementById("m-t-kelola-bagian").addEventListener("click",()=>{
    openKelolaBagianModal({onChanged:()=>{
      const s=document.getElementById("m-t-bagian");
      if(s){
        const cur=s.value;
        s.innerHTML=buildBagianOptions();
        if(cur&&[...s.options].some(o=>o.value===cur))s.value=cur;
      }
    }});
  });
  document.querySelector("[data-cancel]").addEventListener("click",()=>closeModal(true));
  document.getElementById("m-save").addEventListener("click",async ()=>{
    const tglVal=document.getElementById("m-t-tgl").value;
    if(!checkNotFuture(tglVal,"Tanggal"))return;
    const jenis=document.getElementById("m-t-jenis").value;
    const kode=document.getElementById("m-t-barang").value;
    const qty=parseNumber(document.getElementById("m-t-qty").value);
    if(!isValidInt(qty)||qty<=0){alertModal("Jumlah tidak valid","Jumlah harus berupa bilangan bulat positif (contoh: 1, 2, 10).");return;}
    if(jenis==="Keluar"){
      const s=currentStock(kode,idx);
      if(qty>s){alertModal("Stok tidak cukup",`Stok tersedia: ${s}.`);return;}
    }
    const payload={
      tanggal:new Date(tglVal+"T00:00:00"),
      kode,jenis,jumlah:qty,
      pic:document.getElementById("m-t-pic").value,
      ket:document.getElementById("m-t-ket").value.trim(),
      bagian:jenis==="Keluar"?document.getElementById("m-t-bagian").value:"",
      refKey:t.refKey
    };
    const res=await dbUpdateTransaksi(t.id,payload);
    if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
    logAudit("update","Transaksi",`${jenis} ${kode}`,`qty ${qty}`);
    await loadTransaksi();
    closeModal();render();
    toast("Transaksi diperbarui","success");
    warnNegativeStock();
    setTimeout(checkStockAndNotify,300);
  });
}

// ==================== DELETE SJ & VENDOR ====================
function deleteSJ(key){
  const g=findGroupByKey(key);
  if(!g)return;
  if(!canDelete()){alertModal("Akses ditolak","Hanya Admin yang bisa menghapus Surat Jalan.");return;}
  confirmModal("Hapus Surat Jalan",`Yakin hapus <b>${esc(g.sj)}</b> dari <b>${esc(vendorNama(g.vendor))}</b>? Semua transaksi WMS terkait juga akan dihapus.`,async ()=>{
    const key=sjKey(g.vendor,g.sj);
    // Hapus transaksi auto-stock terkait dulu
    const delTrx=await dbDeleteTransaksiByRefKey(key);
    if(delTrx.error){alertModal("Gagal menghapus transaksi",esc(delTrx.error.message));return;}
    // Hapus baris SJ
    const delSJ=await dbDeletePembelianBySJ(g.vendor,g.sj);
    if(delSJ.error){alertModal("Gagal menghapus SJ",esc(delSJ.error.message));return;}
    logAudit("delete","Pembelian",g.sj,vendorNama(g.vendor));
    toast("SJ dihapus","success",g.sj);
    await loadTransaksiDanPembelian();
    render();
    setTimeout(checkStockAndNotify,300);
  },"Ya, Hapus");
}
function deleteVendor(kode){
  const v=vendorByKode(kode);
  if(!v)return;
  if(!canManageMaster()){alertModal("Akses ditolak","Hanya Admin yang bisa menghapus vendor.");return;}
  const usedCount=DATA.pembelian.filter(r=>r.vendor===kode).length;
  const warnMsg=usedCount>0
    ?`Vendor masih dipakai di ${usedCount} baris pembelian. Lanjutkan?`
    :`Yakin hapus vendor <b>${esc(v.nama)}</b>?`;
  confirmModal("Hapus Vendor",warnMsg,async ()=>{
    const res=await dbDeleteVendor(kode);
    if(res.error){alertModal("Gagal menghapus",esc(res.error.message));return;}
    logAudit("delete","Vendor",kode,v.nama);
    if(state.editingVendorKode===kode)resetVendorForm();
    await loadMasterData();
    render();
    toast("Vendor dihapus","success",v.nama);
  },"Ya, Hapus");
}

// ==================== SIDEBAR NAV ====================
document.querySelectorAll(".sb-item[data-tab]").forEach(b=>{
  b.addEventListener("click",()=>{
    const leavingPembelian = state.activeTab==="pembelian" && b.dataset.tab!=="pembelian";
    state.activeTab=b.dataset.tab;
    if(leavingPembelian) resetFormSJ();
    render();
    closeMobileSidebar();
  });
});

// ==================== EVENT HANDLERS (LAINNYA) ====================
document.getElementById("go-pembelian").addEventListener("click",()=>{
  state.activeTab="pembelian";render();
});
document.getElementById("leader-link").addEventListener("click",()=>{
  state.activeTab="laporan";render();
});
document.getElementById("chart-toggle").addEventListener("click",e=>{
  const btn=e.target.closest("button[data-days]");
  if(!btn)return;
  document.querySelectorAll("#chart-toggle button").forEach(b=>b.removeAttribute("aria-selected"));
  btn.setAttribute("aria-selected","true");
  renderChart(Number(btn.dataset.days));
});
document.getElementById("trend-toggle").addEventListener("click",e=>{
  const btn=e.target.closest("button[data-days]");
  if(!btn)return;
  document.querySelectorAll("#trend-toggle button").forEach(b=>b.removeAttribute("aria-selected"));
  btn.setAttribute("aria-selected","true");
  renderTrendChart(Number(btn.dataset.days));
});
document.getElementById("btn-lihat-semua").addEventListener("click",openSemuaModal);

document.getElementById("f-riwayat-jenis").addEventListener("change",e=>{
  state.filterJenis=e.target.value;state.riwayatPage=1;renderRiwayat();
});
document.getElementById("f-riwayat-barang").addEventListener("change",e=>{
  state.filterBarang=e.target.value;state.riwayatPage=1;renderRiwayat();
});
document.getElementById("f-riwayat-pic").addEventListener("change",e=>{
  state.filterPic=e.target.value;state.riwayatPage=1;renderRiwayat();
});
document.getElementById("f-riwayat-bagian").addEventListener("change",e=>{
  state.filterBagian=e.target.value;state.riwayatPage=1;renderRiwayat();
});
document.getElementById("btn-reset-filter").addEventListener("click",()=>{
  state.filterJenis="";
  state.filterBarang="";
  state.filterPic="";
  state.filterBagian="";
  document.getElementById("f-riwayat-jenis").value="";
  document.getElementById("f-riwayat-barang").value="";
  document.getElementById("f-riwayat-pic").value="";
  document.getElementById("f-riwayat-bagian").value="";
  state.riwayatPage=1;renderRiwayat();
  toast("Filter direset","info");
});

document.getElementById("l-compare").addEventListener("change",e=>{
  state.laporanCompare=e.target.checked;
  if(state.laporanShown)renderLaporan();
});

document.getElementById("f-tanggal").value=fmtInputDate(TODAY);
const fBarangEl=document.getElementById("f-barang");
fBarangEl.addEventListener("change",()=>{ fBarangEl.dataset.prevValue=fBarangEl.value; });
document.getElementById("f-pic").addEventListener("change",e=>{
  if(e.target.value==="__new_pic__"){
    e.target.value=picNamaList()[0]||"";
    state.activeTab="pic";render();resetPicForm();
    setTimeout(()=>{ const el=document.getElementById("pic-nama"); if(el)el.focus(); },100);
  }
});
document.getElementById("btn-kelola-bagian").addEventListener("click",()=>openKelolaBagianModal());
document.getElementById("btn-kelola-barang-master").addEventListener("click",()=>openKelolaBarangModal());
document.getElementById("form-transaksi").addEventListener("submit",async e=>{
  e.preventDefault();
  const kode=document.getElementById("f-barang").value;
  const jenis=document.getElementById("f-jenis").value;
  const qty=parseNumber(document.getElementById("f-qty").value);
  const pic=document.getElementById("f-pic").value.trim();
  const ket=document.getElementById("f-ket").value.trim();
  const tglVal=document.getElementById("f-tanggal").value;
  const bagian=document.getElementById("f-bagian").value;
  if(!kode||!pic){
    alertModal("Data belum lengkap","Lengkapi Barang, QTY, dan PIC dulu.");return;
  }
  if(!isValidInt(qty)||qty<=0){
    alertModal("Jumlah tidak valid","Jumlah harus berupa bilangan bulat positif (contoh: 1, 2, 10).");return;
  }
  if(!checkNotFuture(tglVal,"Tanggal Transaksi"))return;
  if(jenis==="Keluar"){
    const stok=currentStock(kode);
    if(qty>stok){
      const it=itemByKode(kode);
      alertModal("Stok tidak cukup",`${it.nama} - stok: ${stok} ${it.satuan}<br>Diminta: ${qty} ${it.satuan}`);return;
    }
  }
  const payload={
    tanggal:new Date(tglVal+"T00:00:00"),
    kode,jenis,jumlah:qty,pic,ket,
    bagian:jenis==="Keluar"?bagian:"",
    refKey:null
  };
  const res=await dbInsertTransaksi(payload);
  if(res.error){
    alertModal("Gagal menyimpan",esc(res.error.message));return;
  }
  logAudit("create","Transaksi",`${jenis} ${kode}`,`${qty} ${itemByKode(kode).satuan} - PIC ${pic}`);
  document.getElementById("f-qty").value="";
  document.getElementById("f-pic").value="";
  document.getElementById("f-ket").value="";
  await loadTransaksi();
  render();
  toast("Transaksi tersimpan","success",`${jenis} ${qty} ${itemByKode(kode).satuan}`);
  setTimeout(checkStockAndNotify,500);
});
function toggleBagianField(){
  document.getElementById("f-bagian-wrap").style.display=document.getElementById("f-jenis").value==="Keluar"?"":"none";
}
document.getElementById("f-jenis").addEventListener("change",toggleBagianField);
toggleBagianField();
document.getElementById("f-riwayat-from").value=fmtInputDate(state.riwayatFrom);
document.getElementById("f-riwayat-to").value=fmtInputDate(state.riwayatTo);
function setPreset(preset){
  state.rangePreset=preset;
  if(preset==="today"){state.riwayatFrom=getToday();state.riwayatTo=endOfDay(getToday());}
  else if(preset==="7"){state.riwayatFrom=dAgo(6);state.riwayatTo=endOfDay(getToday());}
  else if(preset==="30"){state.riwayatFrom=dAgo(29);state.riwayatTo=endOfDay(getToday());}
  document.getElementById("f-riwayat-from").value=fmtInputDate(state.riwayatFrom);
  document.getElementById("f-riwayat-to").value=fmtInputDate(state.riwayatTo);
  document.querySelectorAll("#range-preset button").forEach(b=>{
    b.setAttribute("aria-selected",String(b.dataset.range===preset));
  });
  state.riwayatPage=1;renderRiwayat();
}
document.getElementById("range-preset").addEventListener("click",e=>{
  const btn=e.target.closest("button[data-range]");
  if(!btn)return;
  setPreset(btn.dataset.range);
});
document.getElementById("f-riwayat-from").addEventListener("change",e=>{
  const v=e.target.value;
  if(!v)return;
  state.riwayatFrom=new Date(v+"T00:00:00");
  state.rangePreset="";
  document.querySelectorAll("#range-preset button").forEach(b=>b.removeAttribute("aria-selected"));
  if(state.riwayatFrom>state.riwayatTo){
    state.riwayatTo=endOfDay(state.riwayatFrom);
    document.getElementById("f-riwayat-to").value=fmtInputDate(state.riwayatTo);
  }
  state.riwayatPage=1;renderRiwayat();
});
document.getElementById("f-riwayat-to").addEventListener("change",e=>{
  const v=e.target.value;
  if(!v)return;
  state.riwayatTo=endOfDay(new Date(v+"T00:00:00"));
  state.rangePreset="";
  document.querySelectorAll("#range-preset button").forEach(b=>b.removeAttribute("aria-selected"));
  if(state.riwayatTo<state.riwayatFrom){
    state.riwayatFrom=new Date(v+"T00:00:00");
    document.getElementById("f-riwayat-from").value=fmtInputDate(state.riwayatFrom);
  }
  state.riwayatPage=1;renderRiwayat();
});
document.querySelector("#panel-transaksi table.data thead").addEventListener("click",e=>{
  const th=e.target.closest("th[data-sort]");
  if(!th)return;
  const by=th.dataset.sort;
  if(state.sortRiwayat.by===by)state.sortRiwayat.dir=state.sortRiwayat.dir==="asc"?"desc":"asc";
  else state.sortRiwayat={by,dir:"asc"};
  renderRiwayat();
});
document.getElementById("riwayat-pager").addEventListener("click",e=>{
  const btn=e.target.closest("[data-page]");
  if(!btn)return;
  state.riwayatPage=Number(btn.dataset.page);
  renderRiwayat();
});
document.getElementById("riwayat-body").addEventListener("click",e=>{
  const del=e.target.closest("[data-del-transaksi]");
  if(del&&!del.disabled){
    const idx=Number(del.dataset.delTransaksi);
    confirmModal("Hapus Transaksi","Yakin ingin menghapus transaksi ini?",async ()=>{
      const t=DATA.transaksi[idx];
      if(!t)return;
      const res=await dbDeleteTransaksi(t.id);
      if(res.error){alertModal("Gagal menghapus",esc(res.error.message));return;}
      logAudit("delete","Transaksi",`${t.jenis} ${t.kode}`,`${t.jumlah} - PIC ${t.pic}`);
      await loadTransaksi();
      render();
      toast("Transaksi dihapus","success");
      warnNegativeStock();
      setTimeout(checkStockAndNotify,300);
    },"Ya, Hapus");
    return;
  }
  const edit=e.target.closest("[data-edit-transaksi]");
  if(edit)openEditTransaksiModal(Number(edit.dataset.editTransaksi));
});
document.getElementById("form-vendor").addEventListener("submit",async e=>{
  e.preventDefault();
  const kodeInput=document.getElementById("v-kode");
  const kode=kodeInput.value.trim().toUpperCase();
  const nama=document.getElementById("v-nama").value.trim();
  if(!kode||!nama){alertModal("Data belum lengkap","Kode dan Nama Vendor wajib diisi.");return;}
  const pic=document.getElementById("v-pic").value.trim();
  const hp=document.getElementById("v-hp").value.trim();
  const alamat=document.getElementById("v-alamat").value.trim();
  const keterangan=document.getElementById("v-ket").value.trim();
  if(state.editingVendorKode){
    if(!DATA.vendors[state.editingVendorKode]){alertModal("Vendor tidak ditemukan","");resetVendorForm();return;}
    const res=await dbSaveVendor({kode:state.editingVendorKode,nama,pic,hp,alamat,keterangan});
    if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
    logAudit("update","Vendor",state.editingVendorKode,nama);
    toast("Vendor diperbarui","success",nama);
    resetVendorForm();
  }else{
    if(DATA.vendors[kode]){alertModal("Kode sudah dipakai",`Vendor "${kode}" sudah ada.`);return;}
    const res=await dbSaveVendor({kode,nama,pic,hp,alamat,keterangan});
    if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
    logAudit("create","Vendor",kode,nama);
    toast("Vendor ditambahkan","success",nama);
    resetVendorForm();
  }
  await loadMasterData();
  render();
});
document.getElementById("btn-vendor-reset").addEventListener("click",()=>resetVendorForm());
document.getElementById("vendor-search").addEventListener("input",e=>{
  state.vendorSearch=e.target.value;renderVendorList();
});
document.getElementById("vendor-list").addEventListener("click",e=>{
  const ed=e.target.closest("[data-edit-vendor]");
  if(ed){loadVendorToForm(ed.dataset.editVendor);return;}
  const del=e.target.closest("[data-del-vendor]");
  if(del){deleteVendor(del.dataset.delVendor);return;}
});
document.getElementById("form-pic").addEventListener("submit",async e=>{
  e.preventDefault();
  const nama=document.getElementById("pic-nama").value.trim();
  const divisi=document.getElementById("pic-divisi").value.trim();
  const posisi=document.getElementById("pic-posisi").value.trim();
  const aktif=document.getElementById("pic-aktif").checked;
  if(!nama){alertModal("Data belum lengkap","Nama PIC wajib diisi.");return;}
  if(state.editingPicNama){
    const oldNama=state.editingPicNama;
    const p=picByNama(oldNama);
    if(!p){alertModal("PIC tidak ditemukan","");resetPicForm();return;}
    if(nama!==oldNama&&picByNama(nama)){alertModal("Sudah ada",`PIC "${nama}" sudah ada.`);return;}
    if(nama!==oldNama){
      const affected=DATA.transaksi.filter(t=>t.pic===oldNama);
      const applyRename=async alsoUpdateTrx=>{
        const res=await dbUpdatePic(p.id,{nama,divisi,posisi,aktif});
        if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
        if(alsoUpdateTrx)affected.forEach(t=>{t.pic=nama;});
        logAudit("update","PIC",`${oldNama} -> ${nama}`);
        await loadMasterData();
        resetPicForm();render();
        toast("PIC diperbarui","success",`${oldNama} -> ${nama}${alsoUpdateTrx?` (${affected.length} trx)`:""}`);
      };
      if(affected.length>0){
        confirmModal("Update Transaksi Lama?",`Ada <b>${affected.length}</b> transaksi lama yang memakai PIC <b>${esc(oldNama)}</b>.`,()=>applyRename(true),"Ya, Update Semua",()=>applyRename(false),"Master Saja");
      }else{
        await applyRename(false);
      }
    }else{
      const res=await dbUpdatePic(p.id,{nama,divisi,posisi,aktif});
      if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
      logAudit("update","PIC",nama);
      await loadMasterData();
      resetPicForm();render();
      toast("PIC diperbarui","success",nama);
    }
  }else{
    if(picByNama(nama)){alertModal("Sudah ada",`PIC "${nama}" sudah ada.`);return;}
    const res=await dbInsertPic({nama,divisi,posisi,aktif});
    if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
    logAudit("create","PIC",nama,`${divisi||"-"} - ${posisi||"-"}`);
    await loadMasterData();
    resetPicForm();render();
    toast("PIC ditambahkan","success",`${nama}${aktif?"":" (nonaktif)"}`);
  }
});
document.getElementById("btn-pic-reset").addEventListener("click",()=>resetPicForm());
document.getElementById("pic-search").addEventListener("input",e=>{
  state.picSearch=e.target.value;renderPicList();
});
document.getElementById("pic-list").addEventListener("click",e=>{
  const ed=e.target.closest("[data-edit-pic]");
  if(ed){loadPicToForm(ed.dataset.editPic);return;}
  const toggle=e.target.closest("[data-toggle-pic]");
  if(toggle){
    const nama=toggle.dataset.togglePic;
    const wasAktif=toggle.dataset.aktif==="true";
    const p=picByNama(nama);
    if(!p)return;
    (async ()=>{
      const res=await dbUpdatePic(p.id,{nama:p.nama,divisi:p.divisi,posisi:p.posisi,aktif:!wasAktif});
      if(res.error){alertModal("Gagal menyimpan",esc(res.error.message));return;}
      logAudit("update","PIC",nama,wasAktif?"dinonaktifkan":"diaktifkan");
      await loadMasterData();
      render();
      toast(wasAktif?"PIC dinonaktifkan":"PIC diaktifkan","success",`${nama}${wasAktif?" - tidak muncul di dropdown input baru":""}`);
    })();
    return;
  }
  const del=e.target.closest("[data-del-pic]");
  if(del){deletePic(del.dataset.delPic);return;}
});
document.getElementById("p-tgl").value=fmtInputDate(TODAY);
// Bersihkan form Terima Barang & SJ secara menyeluruh (field, cart, file, preview).
function resetFormSJ(){
  state.fotoSJFiles=[];
  const pSj=document.getElementById("p-sj"); if(pSj)pSj.value="";
  const pVendor=document.getElementById("p-vendor"); if(pVendor)pVendor.value="";
  const pTgl=document.getElementById("p-tgl"); if(pTgl)pTgl.value=fmtInputDate(TODAY);
  const pFoto=document.getElementById("p-foto"); if(pFoto)pFoto.value="";
  const fp=document.getElementById("foto-preview-box"); if(fp)fp.remove();
  const cartRows=document.querySelectorAll(".cart-row");
  cartRows.forEach((r,i)=>{if(i>0)r.remove();});
  const fc=document.querySelector(".cart-qty"); if(fc)fc.value="";
  const auto=document.getElementById("p-autostock"); if(auto)auto.checked=true;
}
document.getElementById("btn-add-cart-row").addEventListener("click",addCartRow);
document.getElementById("p-foto").addEventListener("change",async e=>{
  const newFiles=await readFiles(e.target.files);
  state.fotoSJFiles.push(...newFiles);
  let prev=document.getElementById("foto-preview-box");
  if(!prev){
    prev=document.createElement("div");
    prev.id="foto-preview-box";
    prev.className="file-preview-box";
    e.target.parentElement.appendChild(prev);
  }
  renderFileChips(prev,state.fotoSJFiles);
  e.target.value="";
});
document.getElementById("form-fase1").addEventListener("submit",async e=>{
  e.preventDefault();
  const vendor=document.getElementById("p-vendor").value;
  const sj=document.getElementById("p-sj").value.trim();
  const tglVal=document.getElementById("p-tgl").value;
  if(!vendor||!sj){alertModal("Data belum lengkap","Pilih vendor dan isi No. Surat Jalan dulu.");return;}
  if(!checkNotFuture(tglVal,"Tgl Barang Datang"))return;
  const normBaru=normalizeSJ(sj);
  const sjDobel=DATA.pembelian.find(po=>po.vendor===vendor&&normalizeSJ(po.sj)===normBaru);
  if(sjDobel){
    alertModal("Surat Jalan sudah ada",`SJ <b>${esc(sj)}</b> dari <b>${esc(vendorNama(vendor))}</b> sudah diinput (${fmtTgl(sjDobel.tglSJ)}).`);
    return;
  }
  const rawRows=Array.from(document.querySelectorAll(".cart-row")).map(r=>({
    kode:r.querySelector(".cart-barang").value,
    qtyRaw:r.querySelector(".cart-qty").value.trim()
  }));
  for(const r of rawRows){
    if(r.kode==="__new_barang__"||r.qtyRaw==="")continue;
    const n=parseNumber(r.qtyRaw);
    if(!isValidInt(n)||n<=0){
      const nm=itemByKode(r.kode)?itemByKode(r.kode).nama:r.kode;
      alertModal("Jumlah tidak valid",`Jumlah untuk <b>${esc(nm)}</b> harus berupa bilangan bulat positif (contoh: 1, 2, 10).`);return;
    }
  }
  const cartRows=rawRows.map(r=>({
    kode:r.kode,
    qty:parseNumber(r.qtyRaw)
  })).filter(r=>r.qty>0&&r.kode&&r.kode!=="__new_barang__");
  if(cartRows.length===0){alertModal("Keranjang kosong","Isi minimal 1 barang dengan qty > 0.");return;}
  const seen=new Set();
  for(const r of cartRows){
    if(seen.has(r.kode)){
      alertModal("Barang duplikat",`<b>${esc(itemByKode(r.kode).nama)}</b> muncul lebih dari sekali.`);
      return;
    }
    seen.add(r.kode);
  }
  const tglSJ=new Date(tglVal+"T00:00:00");

  // Simpan baris SJ ke DB
  const beliRows=cartRows.map(r=>({
    sj,vendor,tglSJ,kode:r.kode,qty:r.qty,
    hargaPcs:null,invoice:null,tglInvoiceDatang:null,
    tglFinance:null,lunas:false,tglLunas:null,buktiLunas:null
  }));
  const resBeli=await dbInsertPembelian(beliRows);
  if(resBeli.error){alertModal("Gagal menyimpan SJ",esc(resBeli.error.message));return;}

  // Upload foto SJ ke Storage
  const refKeySJ=sjKey(vendor,sj);
  if(state.fotoSJFiles.length>0){
    for(const f of state.fotoSJFiles){
      const up=await dbUploadFile(refKeySJ,"SJ",vendor,sj,f);
      if(up.error){toast("Gagal upload file","error",f.name);}
    }
  }

  // Auto-stock: buat transaksi IN untuk tiap barang (validasi stok tak perlu untuk IN)
  if(document.getElementById("p-autostock").checked){
    const newRefKey=sjKey(vendor,sj);
    for(const r of cartRows){
      const resTrx=await dbInsertTransaksi({
        tanggal:tglSJ,kode:r.kode,jenis:"Masuk",jumlah:r.qty,
        pic:"Admin Pembelian",ket:"SJ "+sj,refKey:newRefKey,bagian:""
      });
      if(resTrx.error){alertModal("Gagal auto-stock",esc(resTrx.error.message));break;}
    }
  }

  logAudit("create","Pembelian",sj,`${vendorNama(vendor)} - ${cartRows.length} barang`);
  resetFormSJ();
  await loadTransaksiDanPembelian();
  render();
  toast("Surat Jalan tersimpan","success",`${sj} - ${cartRows.length} barang`);
  setTimeout(checkStockAndNotify,500);
  // Auto-pindah ke tab Tagihan Berjalan
  setTimeout(()=>{
    switchPembelianTab("tagihan");
    state.activeTab="pembelian";
    render();
  }, 600);
});
document.getElementById("panel-pembelian").addEventListener("click",e=>{
  const previewSj=e.target.closest("[data-preview-sj]");
  if(previewSj){
    const g=findGroupByKey(previewSj.dataset.previewSj);
    if(g)openFilePreview(`Foto Surat Jalan — ${g.sj}`,vendorNama(g.vendor),g.fotoSJFiles);
    return;
  }
  const previewInv=e.target.closest("[data-preview-invoice]");
  if(previewInv){
    const g=findGroupByKey(previewInv.dataset.previewInvoice);
    if(g)openFilePreview(`Foto Invoice — ${g.invoice||"-"}`,vendorNama(g.vendor),g.fotoInvoiceFiles);
    return;
  }
  const previewBukti=e.target.closest("[data-preview-bukti]");
  if(previewBukti){
    const g=findGroupByKey(previewBukti.dataset.previewBukti);
    if(g)openFilePreview(`Bukti Lunas — ${g.sj}`,vendorNama(g.vendor),g.buktiLunasFiles);
    return;
  }
  const inv=e.target.closest("[data-invoice-po]");
  if(inv){openInvoiceModal(inv.dataset.invoicePo);return;}
  const fin=e.target.closest("[data-finance-po]");
  if(fin){openFinanceModal(fin.dataset.financePo);return;}
  const lun=e.target.closest("[data-lunas-po]");
  if(lun){openLunasModal(lun.dataset.lunasPo);return;}
  const ed=e.target.closest("[data-edit-po]");
  if(ed){openEditPembelianModal(ed.dataset.editPo);return;}
  const del=e.target.closest("[data-del-po]");
  if(del){deleteSJ(del.dataset.delPo);return;}
  const tog=e.target.closest("[data-toggle-po]");
  if(tog){
    state.expandedPO=state.expandedPO===tog.dataset.togglePo?null:tog.dataset.togglePo;
    render();
  }
});
document.getElementById("btn-refresh-pembelian").addEventListener("click",()=>{
  render();toast("Data di-refresh","info");
});
document.getElementById("riwayat-tagihan-search").addEventListener("input",e=>{
  state.tagihanSearch=e.target.value;renderTagihanSelesai();
});
document.getElementById("riwayat-tagihan-bulan").addEventListener("change",e=>{
  state.tagihanBulan=e.target.value;renderTagihanSelesai();
});
document.getElementById("btn-csv-berjalan").addEventListener("click",()=>{
  const rows=pembelianGroups().filter(g=>!g.lunas).map(g=>[
    g.sj,vendorNama(g.vendor),groupItemsLabel(g),
    g.invoice||"-",
    g.tglInvoiceDatang?fmtTgl(g.tglInvoiceDatang):"-",
    g.total,
    ["Menunggu Invoice","Invoice Masuk","Di Finance"][groupStageIndex(g)]
  ]);
  downloadCSV("tagihan-berjalan.csv",["No SJ","Vendor","Barang","Invoice","Tgl Invoice","Total","Status"],rows);
  toast("CSV diunduh","success","tagihan-berjalan.csv");
});
document.getElementById("btn-csv-tagihan").addEventListener("click",()=>{
  const rows=pembelianGroups().filter(g=>g.lunas).map(g=>[
    g.sj,vendorNama(g.vendor),groupItemsLabel(g),
    g.invoice||"-",
    g.tglInvoiceDatang?fmtTgl(g.tglInvoiceDatang):"-",
    g.total,fmtTgl(g.tglLunas)
  ]);
  downloadCSV("riwayat-tagihan.csv",["No SJ","Vendor","Barang","Invoice","Tgl Invoice","Total","Tgl Lunas"],rows);
  toast("CSV diunduh","success","riwayat-tagihan.csv");
});
document.getElementById("l-dari").value=fmtInputDate(state.laporanFrom);
document.getElementById("l-sampai").value=fmtInputDate(state.laporanTo);

function setLaporanPreset(preset){
  const now=new Date();
  let from,to;
  if(preset==="today"){
    from=new Date(now);from.setHours(0,0,0,0);
    to=new Date(now);to.setHours(23,59,59,999);
  }else if(preset==="7"){
    from=new Date(now);from.setDate(from.getDate()-6);from.setHours(0,0,0,0);
    to=new Date(now);to.setHours(23,59,59,999);
  }else if(preset==="30"){
    from=new Date(now);from.setDate(from.getDate()-29);from.setHours(0,0,0,0);
    to=new Date(now);to.setHours(23,59,59,999);
  }else if(preset==="90"){
    from=new Date(now);from.setDate(from.getDate()-89);from.setHours(0,0,0,0);
    to=new Date(now);to.setHours(23,59,59,999);
  }else if(preset==="month"){
    from=new Date(now.getFullYear(),now.getMonth(),1,0,0,0,0);
    to=new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999);
  }else if(preset==="lastmonth"){
    from=new Date(now.getFullYear(),now.getMonth()-1,1,0,0,0,0);
    to=new Date(now.getFullYear(),now.getMonth(),0,23,59,59,999);
  }else if(preset==="year"){
    from=new Date(now.getFullYear(),0,1,0,0,0,0);
    to=new Date(now.getFullYear(),11,31,23,59,59,999);
  }else{
    return;
  }
  document.getElementById("l-dari").value=fmtInputDate(from);
  document.getElementById("l-sampai").value=fmtInputDate(to);
  // Selaraskan state agar periode pembanding (bulan lalu) memakai batas jam yang benar.
  state.laporanFrom=from;
  state.laporanTo=to;
  document.querySelectorAll("#laporan-preset button").forEach(b=>{
    b.setAttribute("aria-selected",String(b.dataset.lp===preset));
  });
}
document.getElementById("laporan-preset").addEventListener("click",e=>{
  const btn=e.target.closest("button[data-lp]");
  if(!btn)return;
  setLaporanPreset(btn.dataset.lp);
});
// Set default 30 hari saat pertama buka
setLaporanPreset("30");

// Reset badge saat user edit manual
document.getElementById("l-dari").addEventListener("change",()=>{
  document.querySelectorAll("#laporan-preset button").forEach(b=>b.removeAttribute("aria-selected"));
});
document.getElementById("l-sampai").addEventListener("change",()=>{
  document.querySelectorAll("#laporan-preset button").forEach(b=>b.removeAttribute("aria-selected"));
});

document.getElementById("btn-tampilkan").addEventListener("click",()=>{
  const dariVal=document.getElementById("l-dari").value;
  const sampaiVal=document.getElementById("l-sampai").value;
  if(!dariVal||!sampaiVal){alertModal("Tanggal belum lengkap","Isi Dari dan Sampai tanggal dulu.");return;}
  if(new Date(dariVal)>new Date(sampaiVal)){alertModal("Urutan tanggal salah","'Dari' tidak boleh lebih besar dari 'Sampai'.");return;}
  state.laporanFrom=new Date(dariVal+"T00:00:00");
  state.laporanTo=new Date(sampaiVal+"T23:59:59");
  state.laporanShown=true;
  renderLaporan();
});
document.getElementById("btn-csv-barang").addEventListener("click",()=>{
  if(!window._lastPerBarang){alertModal("Belum ada data","Klik Tampilkan dulu.");return;}
  downloadCSV("rekap-per-barang.csv",["Barang","Masuk","Keluar","Rata-rata OUT/hari (hari kalender)"],window._lastPerBarang.map(r=>[r.nama,r.masuk,r.keluar,r.rate]));
  toast("CSV diunduh","success","rekap-per-barang.csv");
});

// ==================== SUB-TABS LAPORAN ====================
function switchLaporanTab(target){
  document.querySelectorAll("#laporan-tabs button").forEach(b=>{
    b.setAttribute("aria-selected",String(b.dataset.lp2===target));
  });
  ["pemakaian","pembelian","pembayaran"].forEach(t=>{
    const el=document.getElementById("lp-"+t);
    if(el) el.hidden = (t!==target);
  });
}
document.getElementById("laporan-tabs").addEventListener("click",e=>{
  const btn=e.target.closest("button[data-lp2]");
  if(!btn) return;
  switchLaporanTab(btn.dataset.lp2);
  if(btn.dataset.lp2==="pembelian") renderLaporanPembelian();
  if(btn.dataset.lp2==="pembayaran") renderLaporanPembayaran();
});
document.getElementById("btn-pb-tampilkan").addEventListener("click",renderLaporanPembelian);
document.getElementById("btn-pay-tampilkan").addEventListener("click",renderLaporanPembayaran);
document.getElementById("btn-pb-csv").addEventListener("click",csvLaporanPembelian);
document.getElementById("btn-pay-csv").addEventListener("click",csvLaporanPembayaran);

// ==================== SUB-TABS VENDOR ====================
function switchVendorTab(target){
  document.querySelectorAll("#vendor-tabs button").forEach(b=>{
    b.setAttribute("aria-selected",String(b.dataset.pv===target));
  });
  ["vendor","barang"].forEach(t=>{
    const el=document.getElementById("pv-"+t);
    if(el) el.hidden = (t!==target);
  });
}
document.getElementById("vendor-tabs").addEventListener("click",e=>{
  const btn=e.target.closest("button[data-pv]");
  if(!btn)return;
  switchVendorTab(btn.dataset.pv);
});
function updateVendorBadge(){
  const vBadge=document.getElementById("pv-vendor-count");
  const bBadge=document.getElementById("pv-barang-count");
  if(vBadge){
    const countV=Object.keys(DATA.vendors).length;
    vBadge.textContent=countV>99?"99+":countV;
    vBadge.hidden=(countV===0);
  }
  if(bBadge){
    const countB=DATA.items.length;
    bBadge.textContent=countB>99?"99+":countB;
    bBadge.hidden=(countB===0);
  }
}
// ==================== SUB-TABS PEMBELIAN ====================
function switchPembelianTab(target){
  document.querySelectorAll("#pembelian-tabs button").forEach(b=>{
    b.setAttribute("aria-selected",String(b.dataset.pb===target));
  });
  ["terima","tagihan","riwayat"].forEach(t=>{
    const el=document.getElementById("pb-"+t);
    if(el) el.hidden = (t!==target);
  });
}
document.getElementById("pembelian-tabs").addEventListener("click",e=>{
  const btn=e.target.closest("button[data-pb]");
  if(!btn)return;
  const current=document.querySelector("#pembelian-tabs button[aria-selected='true']");
  const sudahDiTerima=current&&current.dataset.pb==="terima";
  // Saat kembali ke sub-tab "Terima" dari sub-tab lain, bersihkan sisa file/preview.
  if(btn.dataset.pb==="terima"&&!sudahDiTerima) resetFormSJ();
  switchPembelianTab(btn.dataset.pb);
});
function updatePembelianBadge(){
  const badge=document.getElementById("pembelian-tagihan-count");
  if(!badge)return;
  const count=pembelianGroups().filter(g=>!g.lunas).length;
  if(count>0){
    badge.textContent = count > 99 ? "99+" : count;
    badge.hidden=false;
  }else{
    badge.hidden=true;
  }
}
// ==================== SUB-TABS PETUNJUK ====================
document.getElementById("petunjuk-tabs").addEventListener("click",e=>{
  const btn=e.target.closest("button[data-pt]");
  if(!btn)return;
  const target=btn.dataset.pt;
  document.querySelectorAll("#petunjuk-tabs button").forEach(b=>{
    b.setAttribute("aria-selected",String(b.dataset.pt===target));
  });
  ["panduan","fitur","hitung","tips","glosarium"].forEach(t=>{
    const el=document.getElementById("pt-"+t);
    if(el) el.hidden = (t!==target);
  });
});
// ==================== INIT ====================
// Migrasi: selaraskan refKey transaksi auto-stock dengan format ternormalisasi.
// - Transaksi tanpa refKey diisi dari refVendor+refSJ.
// - refVendor kosong: ditebak dari baris pembelian dengan no. SJ yang sama.
// - Semua refKey lama (format mentah) ditulis ulang ke format ternormalisasi.
(function migrateRefKey(){
  DATA.transaksi.forEach(t=>{
    if(t.refSJ==null)return;
    let vendor=t.refVendor;
    if(!vendor){
      const cocok=DATA.pembelian.filter(r=>normalizeSJ(r.sj)===normalizeSJ(t.refSJ));
      if(cocok.length===1) vendor=cocok[0].vendor;
    }
    if(vendor) t.refKey=sjKey(vendor,t.refSJ);
  });
})();
applyTheme(getTheme());
applySidebarPrefs();
if(window.lucide&&lucide.createIcons)lucide.createIcons();
renderCartRows();
(async function checkExistingSession(){
  try{
    if(!isSupabaseConfigured())return;
    const cur=await authGetCurrent();
    if(cur && cur.profile && cur.profile.aktif!==false){
      const p=cur.profile;
      const session={
        id:p.id,
        username:p.username,
        nama:p.nama,
        role:p.role,
        avatar:p.avatar||p.username.slice(0,2).toUpperCase(),
        expiresAt:Date.now()+SESSION_MS
      };
      enterDashboard(session);
      return;
    }
  }catch(e){ /* abaikan, tampilkan login */ }
  document.getElementById("login-user").focus();
})();

