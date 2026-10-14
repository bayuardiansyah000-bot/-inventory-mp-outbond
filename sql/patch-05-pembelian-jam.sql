-- =====================================================================
-- PATCH 05 — Tambah kolom `jam` di tabel pembelian
-- Jalankan di Supabase SQL Editor.
-- Tujuan: menyimpan jam barang datang dari form Terima Barang & SJ,
--         agar tampil di Tagihan Berjalan / Riwayat Tagihan.
-- =====================================================================

alter table public.pembelian add column if not exists jam time;
