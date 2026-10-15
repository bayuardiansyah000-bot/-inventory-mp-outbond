-- =====================================================================
-- PATCH 08 — Bucket 'docs' jadi PRIVAT (signed URL)
-- Jalankan di Supabase SQL Editor.
-- Tujuan: file SJ/Invoice/Bukti tidak bisa dibuka tanpa login.
--         Aplikasi (js/data.js) mengakses file lewat signed URL berbatas waktu.
-- Catatan: policy di patch-03 tetap dipakai (baca/upload: user login;
--          hapus: Admin) — bucket publik sebelumnya mem-bypass policy baca.
-- =====================================================================

update storage.buckets set public = false where id = 'docs';
