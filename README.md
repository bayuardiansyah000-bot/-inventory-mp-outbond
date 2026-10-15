# Inventory MP Outbond

Aplikasi manajemen gudang (barang masuk/keluar, pembelian/SJ, tagihan, laporan).
Target: **online, multi-user (2–5 orang)**, login pakai username.

## Status

- **Level 1 (Desain):** selesai — lihat `docs/level1-desain.md`
- **Level 2 (Implementasi):** selesai — aplikasi berjalan penuh di atas Supabase
  (Auth, database + RLS, Storage, Realtime, Edge Functions, notifikasi Telegram).
- **Deployment:** live di Vercel — https://inventory-mp-outbond.vercel.app
  (push ke `main` → auto-deploy).

## Struktur

```
inventory-project/
├─ index.html          # tampilan aplikasi
├─ css/style.css       # seluruh style
├─ js/
│  ├─ config.js        # SUPABASE_URL & anon key
│  ├─ supabase.js      # inisialisasi client
│  ├─ auth.js          # login/logout/role (username → email @inventory.local)
│  ├─ data.js          # layer data (CRUD Supabase + Storage)
│  ├─ realtime.js      # langganan perubahan realtime
│  └─ app.js           # logika aplikasi & render UI
├─ sql/                # schema + patch (lihat urutan di bawah)
├─ supabase/functions/ # Edge Functions: manage-user, stok-notif, telegram-bot
├─ docs/               # dokumen desain & cara deploy
└─ README.md
```

## Menjalankan (lokal)

Buka `index.html` langsung di browser (double-click), atau jalankan server statis:

```
npx serve .
```

## Setup Database (urutan SQL)

Jalankan berurutan di Supabase SQL Editor:

1. `sql/schema.sql` — tabel + view + trigger + RLS (rebuild dari nol)
2. `sql/patch-02-trigger-update.sql` — validasi stok saat UPDATE
3. `sql/patch-03-storage.sql` — bucket `docs` + policy Storage
4. `sql/patch-04-realtime.sql` — aktifkan realtime
5. `sql/patch-05-pembelian-jam.sql` — kolom `jam` di pembelian
6. `sql/patch-06-sync-skema.sql` — tabel `vendor_items` + kolom `ukuran`/`jam`
7. `sql/patch-07-search-path.sql` — `search_path` fungsi SECURITY DEFINER
8. `sql/patch-08-bucket-privat.sql` — bucket `docs` privat (signed URL)

Lalu buat Admin pertama (lihat catatan di akhir `sql/schema.sql`).
`sql/reset-data.sql` = mengosongkan data operasional (opsional, hati-hati).

## Konfigurasi Supabase

1. Buat project di https://supabase.com
2. Salin **Project URL** & **anon key** ke `js/config.js`
3. Jalankan seluruh SQL di atas
4. Deploy Edge Functions (lihat `docs/deploy-edge-function.md`)

## Keamanan

- `anon key` aman dipublikasikan; yang wajib benar adalah **RLS** di database.
- Password dikelola Supabase Auth (ter-hash) — tidak disimpan plaintext.
- Bucket Storage `docs` **privat** — file diakses lewat signed URL berbatas waktu.
