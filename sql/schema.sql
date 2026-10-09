-- =====================================================================
-- Inventory MP Outbond — Skema Database (Supabase / PostgreSQL)
-- Tahap 1: skema + view + trigger + RLS
-- Jalankan di Supabase SQL Editor (setelah project dibuat).
-- =====================================================================

-- ---------- TABEL ----------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  nama text not null,
  role text not null default 'Operator',
  aktif boolean not null default true,
  avatar text,
  created_at timestamptz default now()
);

create table if not exists items (
  kode text primary key,
  nama text not null,
  kategori text,
  satuan text not null default 'Roll',
  stok_awal int not null default 0,
  minimum int not null default 0,
  created_at timestamptz default now()
);

create table if not exists vendors (
  kode text primary key,
  nama text not null,
  pic text,
  hp text,
  alamat text,
  keterangan text,
  created_at timestamptz default now()
);

create table if not exists pic (
  id bigserial primary key,
  nama text unique not null,
  divisi text,
  posisi text,
  aktif boolean not null default true
);

create table if not exists bagian (
  id bigserial primary key,
  nama text unique not null
);

create table if not exists transaksi (
  id bigserial primary key,
  tanggal date not null,
  kode_barang text not null references items(kode),
  jenis text not null check (jenis in ('Masuk','Keluar')),
  jumlah int not null check (jumlah > 0),
  pic text,
  ket text,
  bagian text,
  ref_key text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists pembelian (
  id bigserial primary key,
  sj text not null,
  vendor text not null references vendors(kode),
  tgl_sj date not null,
  kode_barang text not null references items(kode),
  qty int not null check (qty > 0),
  harga_pcs bigint,
  invoice text,
  tgl_invoice date,
  tgl_finance date,
  lunas boolean not null default false,
  tgl_lunas date,
  bukti_lunas text,
  created_at timestamptz default now()
);

create table if not exists files (
  id bigserial primary key,
  pembelian_ref text not null,
  tipe text not null check (tipe in ('SJ','Invoice','Bukti')),
  path text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  ts timestamptz default now(),
  user_id uuid references profiles(id),
  action text,
  category text,
  target text,
  detail text
);

-- ---------- VIEW STOK ----------

create or replace view v_stok as
select i.kode, i.nama, i.satuan, i.minimum,
       i.stok_awal
       + coalesce(sum(case when t.jenis = 'Masuk'  then t.jumlah
                           when t.jenis = 'Keluar' then -t.jumlah end), 0) as stok
from items i
left join transaksi t on t.kode_barang = i.kode
group by i.kode, i.nama, i.satuan, i.minimum, i.stok_awal;

-- ---------- HELPER: role admin ----------

create or replace function is_admin()
returns boolean
language sql stable security definer as $$
  select exists(
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'Admin' and p.aktif = true
  );
$$;

-- ---------- TRIGGER: validasi stok OUT di server ----------

create or replace function cek_stok_keluar()
returns trigger
language plpgsql security definer as $$
declare
  stok_kini int;
begin
  if new.jenis = 'Keluar' then
    select i.stok_awal
      + coalesce((select sum(case when t.jenis='Masuk' then t.jumlah else -t.jumlah end)
                  from transaksi t where t.kode_barang = new.kode_barang), 0)
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

drop trigger if exists trg_cek_stok_keluar on transaksi;
create trigger trg_cek_stok_keluar
  before insert on transaksi
  for each row execute function cek_stok_keluar();

-- ---------- ROW LEVEL SECURITY ----------

alter table profiles   enable row level security;
alter table items      enable row level security;
alter table vendors    enable row level security;
alter table pic        enable row level security;
alter table bagian     enable row level security;
alter table transaksi  enable row level security;
alter table pembelian  enable row level security;
alter table files      enable row level security;
alter table audit_log  enable row level security;

-- profiles: user baca diri sendiri; Admin semua; hanya Admin yang ubah
drop policy if exists p_profiles_self_read on profiles;
create policy p_profiles_self_read on profiles for select
  using (id = auth.uid() or is_admin());

drop policy if exists p_profiles_admin_write on profiles;
create policy p_profiles_admin_write on profiles for all
  using (is_admin()) with check (is_admin());

-- items/vendors/pic/bagian: semua user baca; Admin tulis
drop policy if exists p_items_read on items;
create policy p_items_read on items for select using (auth.uid() is not null);
drop policy if exists p_items_write on items;
create policy p_items_write on items for all using (is_admin()) with check (is_admin());

drop policy if exists p_vendors_read on vendors;
create policy p_vendors_read on vendors for select using (auth.uid() is not null);
drop policy if exists p_vendors_write on vendors;
create policy p_vendors_write on vendors for all using (is_admin()) with check (is_admin());

drop policy if exists p_pic_read on pic;
create policy p_pic_read on pic for select using (auth.uid() is not null);
drop policy if exists p_pic_write on pic;
create policy p_pic_write on pic for all using (is_admin()) with check (is_admin());

drop policy if exists p_bagian_read on bagian;
create policy p_bagian_read on bagian for select using (auth.uid() is not null);
drop policy if exists p_bagian_write on bagian;
create policy p_bagian_write on bagian for all using (is_admin()) with check (is_admin());

-- transaksi: semua baca; Admin+Operator insert; Admin hapus/ubah
drop policy if exists p_transaksi_read on transaksi;
create policy p_transaksi_read on transaksi for select using (auth.uid() is not null);
drop policy if exists p_transaksi_insert on transaksi;
create policy p_transaksi_insert on transaksi for insert
  with check (auth.uid() is not null);
drop policy if exists p_transaksi_update on transaksi;
create policy p_transaksi_update on transaksi for update using (is_admin());
drop policy if exists p_transaksi_delete on transaksi;
create policy p_transaksi_delete on transaksi for delete using (is_admin());

-- pembelian: semua baca; Admin+Operator insert; Admin hapus/ubah
drop policy if exists p_pembelian_read on pembelian;
create policy p_pembelian_read on pembelian for select using (auth.uid() is not null);
drop policy if exists p_pembelian_insert on pembelian;
create policy p_pembelian_insert on pembelian for insert with check (auth.uid() is not null);
drop policy if exists p_pembelian_update on pembelian;
create policy p_pembelian_update on pembelian for update using (is_admin());
drop policy if exists p_pembelian_delete on pembelian;
create policy p_pembelian_delete on pembelian for delete using (is_admin());

-- files: semua baca; Admin+Operator insert; Admin hapus
drop policy if exists p_files_read on files;
create policy p_files_read on files for select using (auth.uid() is not null);
drop policy if exists p_files_insert on files;
create policy p_files_insert on files for insert with check (auth.uid() is not null);
drop policy if exists p_files_delete on files;
create policy p_files_delete on files for delete using (is_admin());

-- audit_log: Admin baca; insert oleh user login
drop policy if exists p_audit_read on audit_log;
create policy p_audit_read on audit_log for select using (is_admin());
drop policy if exists p_audit_insert on audit_log;
create policy p_audit_insert on audit_log for insert with check (auth.uid() is not null);

-- =====================================================================
-- CATATAN SEED ADMIN PERTAMA (jalankan manual setelah Admin dibuat di Auth):
--
--   1) Buat user di Authentication -> Users:
--        email    : bayu-cra@inventory.local
--        password : <pilih password kuat>
--   2) Ambil UUID user tsb, lalu jalankan:
--
--   insert into profiles (id, username, nama, role, aktif, avatar)
--   values ('<UUID_USER>', 'bayu-CRA', 'Bayu', 'Admin', true, 'BA');
--
--   Ganti <UUID_USER> dengan id dari langkah 1.
-- =====================================================================
