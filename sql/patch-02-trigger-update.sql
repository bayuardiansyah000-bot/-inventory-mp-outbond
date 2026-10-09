-- =====================================================================
-- PATCH 02 — Trigger validasi stok untuk UPDATE
-- Jalankan di Supabase SQL Editor.
-- Tujuan: saat transaksi OUT diedit, server tetap memvalidasi stok,
--         dengan mengecualikan baris yang sedang di-update (exclude id).
-- =====================================================================

create or replace function cek_stok_keluar_update()
returns trigger
language plpgsql security definer as $$
declare
  stok_kini int;
begin
  if new.jenis = 'Keluar' then
    select i.stok_awal
      + coalesce((select sum(case when t.jenis='Masuk' then t.jumlah else -t.jumlah end)
                  from transaksi t
                  where t.kode_barang = new.kode_barang
                    and t.id <> new.id), 0)
      into stok_kini
    from items i where i.kode = new.kode_barang;

    if stok_kini is null then
      raise exception 'Barang % tidak ditemukan', new.kode_barang;
    end if;
    if new.jumlah > stok_kini then
      raise exception 'Stok tidak cukup: tersedia % , diminta %', stok_kini, new.jumlah;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cek_stok_keluar_update on transaksi;
create trigger trg_cek_stok_keluar_update
  before update on transaksi
  for each row execute function cek_stok_keluar_update();
