-- =====================================================================
-- PATCH 06 — Sinkronisasi skema: tabel vendor_items + kolom ukuran/jam
-- Jalankan di Supabase SQL Editor.
-- Tujuan: kolom/tabel yang selama ini dibuat manual lewat dashboard
--         (tidak tercatat di repo) kini punya definisi resmi, sehingga
--         schema.sql + patch bisa merebuild database dari nol.
-- Idempotent: aman dijalankan berulang.
-- =====================================================================

-- ---------- TABEL vendor_items ----------
-- Relasi barang yang disuplai tiap vendor (1 vendor bisa punya >1 ukuran
-- untuk kode barang yang sama). Dipakai js/data.js (dbLoadVendorItems,
-- dbSetVendorItems) dan js/app.js (editor barang vendor).

create table if not exists public.vendor_items (
  id bigserial primary key,
  vendor text not null references public.vendors(kode) on delete cascade,
  kode_barang text not null references public.items(kode) on delete cascade,
  ukuran text not null default '',
  created_at timestamptz default now(),
  unique (vendor, kode_barang, ukuran)
);

-- ---------- KOLOM ukuran (snapshot) ----------

alter table public.transaksi add column if not exists ukuran text;
alter table public.pembelian add column if not exists ukuran text;

-- ---------- KOLOM jam di transaksi ----------
-- (patch-05 hanya menambah jam di pembelian; transaksi.jam dipakai
--  dbInsertTransaksi/dbUpdateTransaksi dan telegram-bot.)

alter table public.transaksi add column if not exists jam time;

-- ---------- RLS vendor_items ----------

alter table public.vendor_items enable row level security;

drop policy if exists p_vendor_items_read on public.vendor_items;
create policy p_vendor_items_read on public.vendor_items for select
  using (auth.uid() is not null);

drop policy if exists p_vendor_items_write on public.vendor_items;
create policy p_vendor_items_write on public.vendor_items for all
  using (is_admin()) with check (is_admin());
