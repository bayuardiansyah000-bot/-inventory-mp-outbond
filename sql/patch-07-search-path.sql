-- =====================================================================
-- PATCH 07 — Set search_path pada fungsi SECURITY DEFINER
-- Jalankan di Supabase SQL Editor.
-- Tujuan: menghilangkan warning linter Supabase (function_search_path_mutable)
--         dan mengamankan fungsi dari skema berbahaya di search_path.
-- =====================================================================

alter function public.is_admin() set search_path = public;
alter function public.cek_stok_keluar() set search_path = public;
alter function public.cek_stok_keluar_update() set search_path = public;
