-- =====================================================================
-- PATCH 03 — Storage bucket untuk dokumen (SJ / Invoice / Bukti Lunas)
-- Jalankan di Supabase SQL Editor.
-- Membuat bucket 'docs' + aturan akses (semua user login boleh lihat & upload;
-- hanya Admin boleh menghapus file).
-- =====================================================================

-- Buat bucket 'docs' (publik dibaca) bila belum ada
insert into storage.buckets (id, name, public)
values ('docs','docs', true)
on conflict (id) do nothing;

-- ===== POLICY STORAGE (schema storage.objects) =====

-- Baca: semua user yang login boleh melihat file
drop policy if exists p_docs_read on storage.objects;
create policy p_docs_read on storage.objects for select
  using ( bucket_id = 'docs' and auth.uid() is not null );

-- Upload: semua user yang login boleh upload
drop policy if exists p_docs_insert on storage.objects;
create policy p_docs_insert on storage.objects for insert
  with check ( bucket_id = 'docs' and auth.uid() is not null );

-- Update (overwrite): semua user yang login
drop policy if exists p_docs_update on storage.objects;
create policy p_docs_update on storage.objects for update
  using ( bucket_id = 'docs' and auth.uid() is not null );

-- Hapus: hanya Admin
drop policy if exists p_docs_delete on storage.objects;
create policy p_docs_delete on storage.objects for delete
  using ( bucket_id = 'docs' and is_admin() );
