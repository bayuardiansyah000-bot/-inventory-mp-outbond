// ==================== REALTIME (Supabase) ====================
// Berlangganan perubahan tabel operasional. Saat user lain mengubah data,
// data dimuat ulang lalu UI di-render otomatis.

var _realtimeChannel = null;
var _realtimeReloadTimer = null;
var _realtimeActive = false;

// Jadwalkan reload dengan debounce (hindari reload beruntun saat banyak event).
function _realtimeScheduleReload(){
  if(_realtimeReloadTimer) clearTimeout(_realtimeReloadTimer);
  _realtimeReloadTimer = setTimeout(async ()=>{
    _realtimeReloadTimer = null;
    try{
      if(typeof loadMasterData==="function") await loadMasterData();
      else if(typeof loadTransaksiDanPembelian==="function") await loadTransaksiDanPembelian();
      if(typeof render==="function") render();
      if(typeof toast==="function") toast("Data diperbarui","info","Ada pembaruan dari pengguna lain");
    }catch(e){ console.error("realtime reload:", e); }
  }, 600);
}

function startRealtime(){
  var sb = supabaseClient();
  if(!sb || _realtimeActive) return;
  try{
    _realtimeChannel = sb
      .channel("inv-realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"transaksi"},_realtimeScheduleReload)
      .on("postgres_changes",{event:"*",schema:"public",table:"pembelian"},_realtimeScheduleReload)
      .on("postgres_changes",{event:"*",schema:"public",table:"items"},_realtimeScheduleReload)
      .on("postgres_changes",{event:"*",schema:"public",table:"files"},_realtimeScheduleReload)
      .subscribe();
    _realtimeActive = true;
    console.log("[realtime] aktif");
  }catch(e){
    console.error("[realtime] gagal:", e);
  }
}

function stopRealtime(){
  var sb = supabaseClient();
  if(_realtimeChannel && sb){
    try{ sb.removeChannel(_realtimeChannel); }catch(e){}
  }
  _realtimeChannel = null;
  _realtimeActive = false;
  if(_realtimeReloadTimer){ clearTimeout(_realtimeReloadTimer); _realtimeReloadTimer=null; }
}
