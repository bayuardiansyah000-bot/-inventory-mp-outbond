# Inventory MP Outbond

Aplikasi manajemen gudang (barang masuk/keluar, pembelian/SJ, tagihan, laporan).
Target: **online, multi-user (2–5 orang)**, login pakai username.

## Status

- **Level 1 (Desain):** selesai — lihat `docs/level1-desain.md`
- **Level 2 (Implementasi):** belum dimulai

Saat ini `index.html` masih berjalan **mode lokal** (seperti versi lama). Selama
`js/config.js` belum diisi, aplikasi berfungsi tanpa Supabase.

## Struktur

```
inventory-project/
├─ index.html          # tampilan aplikasi
├─ css/style.css       # seluruh style
├─ js/
│  ├─ config.js        # isi SUPABASE_URL & anon key (rahasia tidak di-commit)
│  ├─ supabase.js      # koneksi Supabase (placeholder)
│  └─ app.js           # logika aplikasi
├─ sql/schema.sql      # skema database + RLS + trigger
├─ docs/
│  └─ level1-desain.md # dokumen desain
└─ README.md
```

## Menjalankan (lokal)

Buka `index.html` langsung di browser (double-click), atau jalankan server statis:

```
npx serve .
```

## Roadmap Level 2

| Tahap | Isi |
|-------|-----|
| 1 | Setup Supabase + import `sql/schema.sql` + seed Admin `bayu-CRA` |
| 2 | Auth login/logout/role (username → email internal `@inventory.local`) |
| 3 | Data master: items, vendors, PIC, bagian |
| 4 | Transaksi + validasi stok server + realtime |
| 5 | Pembelian + tagihan + upload file ke Storage |
| 6 | Audit log + realtime penuh |
| 7 | Deployment (Netlify/Vercel) |

## Konfigurasi Supabase

1. Buat project di https://supabase.com
2. Salin **Project URL** & **anon key** ke `js/config.js`
3. Jalankan `sql/schema.sql` di Supabase SQL Editor
4. Buat Admin pertama (lihat catatan di akhir `sql/schema.sql`)

## Keamanan

- `anon key` aman dipublikasikan; yang wajib benar adalah **RLS** di database.
- Password dikelola Supabase Auth (ter-hash) — tidak disimpan plaintext.
