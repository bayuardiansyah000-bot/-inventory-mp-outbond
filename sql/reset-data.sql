-- =====================================================================
-- RESET DATA OPERASIONAL — mengosongkan data contoh/test
-- Jalankan di Supabase SQL Editor.
-- TIDAK menghapus user/profil (auth.users & profiles tetap aman).
-- =====================================================================

-- Urutan penting: hapus yang berelasi dulu (transaksi & pembelian), lalu master.
truncate table public.files        restart identity cascade;
truncate table public.transaksi    restart identity cascade;
truncate table public.pembelian    restart identity cascade;
truncate table public.items        restart identity cascade;
truncate table public.vendors      restart identity cascade;
truncate table public.pic          restart identity cascade;
truncate table public.bagian       restart identity cascade;
truncate table public.audit_log    restart identity cascade;

-- Verifikasi (opsional): jalankan untuk memastikan kosong
-- select 'items' t, count(*) from public.items
-- union all select 'vendors', count(*) from public.vendors
-- union all select 'pic', count(*) from public.pic
-- union all select 'bagian', count(*) from public.bagian
-- union all select 'transaksi', count(*) from public.transaksi
-- union all select 'pembelian', count(*) from public.pembelian
-- union all select 'files', count(*) from public.files
-- union all select 'audit_log', count(*) from public.audit_log;

-- CATATAN: bucket Storage 'docs' TIDAK dikosongkan oleh SQL ini.
-- File foto (kalau ada) tetap di Storage. Untuk membersihkannya:
--   Storage -> bucket 'docs' -> pilih semua -> Delete.
