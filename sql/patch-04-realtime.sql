-- =====================================================================
-- PATCH 04 — Aktifkan Realtime untuk tabel operasional
-- Jalankan di Supabase SQL Editor.
-- Menambahkan tabel ke publikasi realtime supaya perubahan tersiar ke
-- semua client yang berlangganan.
-- =====================================================================

-- Tabel yang perlu realtime
alter publication supabase_realtime add table transaksi;
alter publication supabase_realtime add table pembelian;
alter publication supabase_realtime add table items;
alter publication supabase_realtime add table files;

-- Catatan:
-- - Jika muncul error "already member of publication", abaikan (sudah aktif).
-- - RLS tetap berlaku pada siaran realtime (user hanya menerima baris yang
--   boleh dilihat sesuai policy).
