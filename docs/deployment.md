# Deployment — Inventory MP Outbond

Aplikasi ini **static site** (HTML/CSS/JS), backend-nya Supabase. Jadi hostnya
cukup layanan hosting statis gratis.

---

## Pilihan hosting

| Layanan | Cara | Biaya |
|---------|------|-------|
| **Netlify Drop** (paling mudah) | Drag-and-drop folder | Gratis |
| **Vercel** | Import dari GitHub / CLI | Gratis |
| **Cloudflare Pages** | Hubungkan repo Git | Gratis |
| **GitHub Pages** | Repo Git + setting | Gratis |

Rekomendasi untuk mulai cepat: **Netlify Drop** (tanpa git, tanpa CLI).

---

## Cara A — Netlify Drop (tanpa install apa pun)

1. Buka https://app.netlify.com/drop
2. Login/daftar (bisa pakai Google/GitHub).
3. **Drag folder `inventory-project`** ke area drop.
   - ⚠️ Jangan drag folder `sql/` & `docs/` bila tidak mau publik — tapi tidak berbahaya karena hanya skema/deskripsi, tanpa kredensial rahasia.
4. Netlify memberi URL publik, mis. `https://nama-acak.netlify.app`.
5. Buka URL itu → login → aplikasi jalan online.
6. (Opsional) Di Netlify → Site settings → ganti nama domain.

Catatan: `netlify.toml` sudah disertakan (header keamanan otomatis).

---

## Cara B — Vercel

1. Buka https://vercel.com → New Project.
2. Hubungkan repo GitHub berisi folder ini, atau jalankan `npx vercel` di folder.
3. Framework: **Other**. Output directory: `./`.
4. Deploy → dapat URL `*.vercel.app`.

`vercel.json` sudah disertakan.

---

## Cara C — GitHub Pages

1. Buat repo GitHub, upload semua file (kecuali `sql/` bila mau).
2. Settings → Pages → Source: branch `main`, folder `/root`.
3. Akses `https://<user>.github.io/<repo>/`.

---

## Hal penting setelah deploy

1. **URL Supabase diizinkan?** Supabase Auth bawaan mengizinkan semua origin,
   jadi belum perlu ubah. Bila nanti dibatasi, tambahkan URL hosting di
   Supabase → Authentication → URL Configuration → **Site URL / Redirect URLs**.

2. **Bucket & RLS** sudah publik/aman (anon key + RLS). Tidak ada rahasia di
   frontend selain anon key (memang aman dipublikasikan).

3. **Update kode**: karena `index.html` memakai `?v=N` untuk cache-busting,
   naikkan `N` setiap kali mengubah file JS agar pengguna dapat versi terbaru.

---

## Setelah online

- Realtime (Tahap 4) & Audit log ke DB (Tahap 6) dapat dilanjutkan tanpa
  mengganggu deployment: cukup deploy ulang setelah perubahan.
