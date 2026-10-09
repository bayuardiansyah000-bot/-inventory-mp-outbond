# Deploy Edge Function — manage-user

Fungsi ini memungkinkan **Kelola User dari dalam aplikasi** (tambah/edit/nonaktif/hapus)
dengan aman. Service role key disimpan di server Supabase, bukan di browser.

File fungsi: `supabase/functions/manage-user/index.ts`

---

## Cara 1 — Lewat Supabase Dashboard (paling mudah, tanpa install)

1. Buka **Supabase Dashboard** → pilih project Anda.
2. Menu kiri → **Edge Functions**.
3. Klik **Create a new function** (atau **Deploy a new function**).
4. Nama function: **`manage-user`** (harus persis).
5. Hapus isi contoh, lalu **copy-paste seluruh isi**
   `supabase/functions/manage-user/index.ts`.
6. Deploy / Save.

> Dashboard biasanya otomatis menyediakan env `SUPABASE_URL`,
> `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` untuk Edge Function.
> **Tidak perlu** menambah apa pun.

7. (Opsional) Matikan **Verify JWT** jika ada tombolnya? **JANGAN** —
   biarkan JWT verification aktif (fungsi juga memverifikasi admin sendiri).

---

## Cara 2 — Lewat Supabase CLI (jika CLI tersedia)

```
supabase link --project-ref wftfrccvghzudsfqfqvj
supabase functions deploy manage-user
```

---

## Setelah deploy

Coba di aplikasi (sudah versi v16 setelah deploy ulang Netlify):

1. Login sebagai Admin (`bayu-CRA`).
2. Menu user (kanan atas) → **Kelola User**.
3. **➕ Tambah User Baru** → isi username, nama, role, password → Simpan.
4. User baru langsung bisa login (username + password).
5. **Edit / Nonaktifkan / Hapus** juga berfungsi.
6. Nonaktifkan user → saat user itu login, muncul "Akun dinonaktifkan".

---

## Catatan keamanan

- Fungsi **memverifikasi** bahwa pemanggil adalah user login ber-role **Admin**.
- Membuat akun memakai **Admin API** dengan **service_role** yang hanya ada di server.
- Password di-hash otomatis oleh Supabase Auth.
- Username dipetakan ke email internal `<username>@inventory.local`.

## Jika terjadi error

- **"Sesi tidak valid"** → login ulang.
- **"Hanya Admin..."** → akun bukan Admin.
- **"Function not found" (404)** → Edge Function belum di-deploy / nama salah.
- **"Gagal membuat user"** → cek apakah email `<username>@inventory.local`
  sudah ada di Authentication → Users.
