-- =====================================================================
-- PATCH 09 — Pengambil Barang: Operator boleh menambah + rename riwayat
-- Jalankan di Supabase SQL Editor (setelah patch-08).
-- Tujuan:
--   1. Operator boleh INSERT ke tabel `pic` (tambah pengambil baru dari
--      form transaksi). Edit/nonaktif/hapus tetap hanya Admin.
--   2. Fungsi `rename_pic_transaksi` untuk memperbarui nama pengambil di
--      seluruh transaksi lama sekaligus (dipakai saat Admin memilih
--      "Ya, Update Semua" ketika mengubah nama pengambil).
-- Catatan: nama tabel & kolom tetap `pic` supaya tidak ada migrasi besar.
--          Kolom `posisi` tidak dipakai lagi di UI, tapi tetap dibiarkan.
-- Untuk database yang sudah berjalan (patch 02-08 sudah dijalankan),
-- cukup jalankan patch-09 ini saja.
-- =====================================================================

-- ---------- 1. Policy INSERT untuk Operator ----------

drop policy if exists p_pic_insert on pic;
create policy p_pic_insert on pic for insert
  with check (auth.uid() is not null);

-- Policy lama p_pic_write (Admin) tetap berlaku untuk UPDATE/DELETE.
-- Catatan: dua policy yang sama-sama mengizinkan akan digabung dengan OR,
-- jadi Admin tetap bisa insert dan Operator sekarang juga bisa insert.

-- ---------- 2. Fungsi rename nama pengambil di transaksi lama ----------

-- Versi trigger update stok yang menghormati flag "lewati cek stok".
-- Diperlukan karena rename hanya mengubah kolom `pic`, bukan qty — jadi
-- pengecekan stok tidak relevan dan bisa gagal kalau stok sudah negatif.
create or replace function cek_stok_keluar_update()
returns trigger
language plpgsql security definer
set search_path = public as $$
declare
  stok_kini int;
begin
  if coalesce(current_setting('app.skip_stok_check', true), '') = 'on' then
    return new;
  end if;
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

create or replace function rename_pic_transaksi(old_nama text, new_nama text)
returns int
language plpgsql security definer
set search_path = public as $$
declare
  jumlah int;
begin
  if not is_admin() then
    raise exception 'Hanya Admin yang boleh mengubah riwayat pengambil';
  end if;
  if old_nama is null or new_nama is null or btrim(new_nama) = '' then
    raise exception 'Nama pengambil tidak valid';
  end if;

  -- Rename tidak mengubah qty, jadi lewati validasi stok sekali ini saja.
  perform set_config('app.skip_stok_check', 'on', true);

  update transaksi
     set pic = btrim(new_nama)
   where pic = old_nama
     and jenis = 'Keluar';

  get diagnostics jumlah = row_count;

  perform set_config('app.skip_stok_check', 'off', true);

  return jumlah;
end;
$$;

-- Hanya user login yang boleh memanggil (fungsi tetap memeriksa is_admin).
revoke all on function rename_pic_transaksi(text, text) from public;
grant execute on function rename_pic_transaksi(text, text) to authenticated;

-- ---------- 3. Cegah hapus pengambil yang sudah dipakai ----------
-- Riwayat transaksi menyimpan nama sebagai teks, jadi menghapus master
-- tidak merusak data. Tapi supaya konsisten dengan aturan aplikasi
-- ("hanya nonaktifkan"), blokir hapus bila nama masih dipakai di OUT.

create or replace function cek_hapus_pic()
returns trigger
language plpgsql security definer
set search_path = public as $$
begin
  if exists (select 1 from transaksi where jenis = 'Keluar' and pic = old.nama) then
    raise exception 'Pengambil % sudah dipakai di transaksi OUT. Nonaktifkan saja, jangan hapus.', old.nama;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_cek_hapus_pic on pic;
create trigger trg_cek_hapus_pic
  before delete on pic
  for each row execute function cek_hapus_pic();

-- ---------- 4. Realtime untuk tabel pic ----------
-- Supaya pengambil baru yang ditambahkan Operator langsung muncul di
-- dropdown transaksi milik user lain tanpa refresh.
do $$
begin
  execute 'alter publication supabase_realtime add table pic';
exception
  when duplicate_object then null;  -- sudah terdaftar, abaikan
  when undefined_object then null;  -- publication tidak ada (abaikan)
end $$;

