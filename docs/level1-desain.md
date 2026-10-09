# Level 1 — Desain Dasar Migrasi ke Online Multi-User

**Proyek:** Inventory MP Outbond
**Platform:** Supabase (PostgreSQL + Auth + Storage + Realtime)
**Target:** 2–5 user, tanpa budget (free tier), login pakai **username**, mulai dari data kosong.
**Domain internal email:** `inventory.local`
**Admin pertama:** `bayu-CRA`
**Bahasa:** Indonesia

---

## 1. Ringkasan

Aplikasi saat ini 100% client-side (data di memori + localStorage). Untuk online &
multi-user, data dipindah ke **Supabase PostgreSQL**, autentikasi ke **Supabase Auth**
(password ter-hash), file ke **Supabase Storage**, dan pembaruan otomatis via **Realtime**.

Efek samping: bug #1 (password plaintext) dan #2 (data hilang saat refresh) otomatis selesai.

---

## 2. Skema Tabel

```sql
-- profiles: melengkapi auth.users (Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  nama text not null,
  role text not null default 'Operator',   -- 'Admin' | 'Operator'
  aktif boolean not null default true,
  avatar text,
  created_at timestamptz default now()
);

-- items: master barang
create table items (
  kode text primary key,          -- 'BP-001'
  nama text not null,
  kategori text,
  satuan text not null default 'Roll',
  stok_awal int not null default 0,
  minimum int not null default 0,  -- ROP
  created_at timestamptz default now()
);

-- vendors
create table vendors (
  kode text primary key,           -- 'NMS'
  nama text not null,
  pic text, hp text, alamat text, keterangan text,
  created_at timestamptz default now()
);

-- pic
create table pic (
  id bigserial primary key,
  nama text unique not null,
  divisi text, posisi text,
  aktif boolean not null default true
);

-- bagian (bagian pemakaian)
create table bagian (
  id bigserial primary key,
  nama text unique not null
);

-- transaksi gudang
create table transaksi (
  id bigserial primary key,
  tanggal date not null,
  kode_barang text not null references items(kode),
  jenis text not null check (jenis in ('Masuk','Keluar')),
  jumlah int not null check (jumlah > 0),
  pic text,
  ket text,
  bagian text,
  ref_key text,                    -- pengikat auto-stock SJ (contoh: NMS::sj|105)
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- pembelian (1 baris = 1 barang dalam 1 SJ)
create table pembelian (
  id bigserial primary key,
  sj text not null,
  vendor text not null references vendors(kode),
  tgl_sj date not null,
  kode_barang text not null references items(kode),
  qty int not null check (qty > 0),
  harga_pcs bigint,
  invoice text,
  tgl_invoice date,
  tgl_finance date,
  lunas boolean not null default false,
  tgl_lunas date,
  bukti_lunas text,
  created_at timestamptz default now()
);

-- files: foto SJ/invoice/bukti (path di Storage, bukan base64)
create table files (
  id bigserial primary key,
  pembelian_ref text not null,     -- sama dengan ref_key SJ
  tipe text not null check (tipe in ('SJ','Invoice','Bukti')),
  path text not null,              -- contoh: 'sj/NMS/SJ-0105/1.jpg'
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- audit_log
create table audit_log (
  id bigserial primary key,
  ts timestamptz default now(),
  user_id uuid references profiles(id),
  action text, category text, target text, detail text
);
```

Stok **tidak disimpan** sebagai kolom; dihitung via view agar selalu konsisten:

```sql
create view v_stok as
select i.kode, i.nama, i.satuan, i.minimum,
       i.stok_awal
       + coalesce(sum(case when t.jenis='Masuk' then t.jumlah
                           when t.jenis='Keluar' then -t.jumlah end),0) as stok
from items i left join transaksi t on t.kode_barang = i.kode
group by i.kode, i.nama, i.satuan, i.minimum, i.stok_awal;
```

---

## 3. Auth & Role

- **Login pakai username.** Email internal: `<username>@inventory.local`.
  Alur: user ketik username+password → app ubah ke email internal → `signInWithPassword`.
- Password otomatis ter-hash oleh Supabase (menyelesaikan bug #1).
- Role & nama diambil dari tabel `profiles`.
- Admin pertama (`bayu-CRA`) dibuat manual sekali lewat dashboard Supabase.

### Row Level Security (RLS)

| Tabel | Baca | Tulis | Hapus |
|-------|------|-------|-------|
| profiles | sendiri; Admin semua | Admin | Admin |
| items | semua | Admin | Admin |
| vendors | semua | Admin | Admin |
| pic | semua | Admin | Admin |
| bagian | semua | Admin | Admin |
| transaksi | semua | Admin+Operator | Admin |
| pembelian | semua | Admin+Operator | Admin |
| files | semua | Admin+Operator | Admin |
| audit_log | Admin | sistem | Admin |

Prinsip: hak akses divalidasi **di server (RLS)**, bukan hanya UI.

---

## 4. Realtime

- Aktifkan Realtime pada: `transaksi`, `pembelian`, `items`, `files`.
- Frontend subscribe; saat data berubah dari user lain → panggil render terkait.

---

## 5. Validasi Stok di Server

- Trigger `before insert` pada `transaksi`: jika `jenis='Keluar'` dan stok < jumlah → tolak.
- Mencegah stok minus akibat input bersamaan (race condition).

---

## 6. File Storage

- Bucket: `docs`.
- Struktur: `sj/<vendor>/<no_sj>/<file>`, `invoice/...`, `bukti/...`.
- DB hanya menyimpan `path`; file ditampilkan via **signed URL**.

---

## 7. Struktur Frontend

```
inventory-project/
├─ index.html
├─ css/style.css
├─ js/
│  ├─ config.js      (SUPABASE_URL + anon key)
│  ├─ supabase.js    (inisialisasi client)
│  ├─ auth.js        (login username, logout, role guard)
│  ├─ data.js        (pengganti DATA object → query DB)
│  ├─ storage.js     (upload/preview file)
│  ├─ realtime.js    (subscribe perubahan)
│  └─ ui.js          (fungsi render — hampir tak berubah)
├─ sql/schema.sql    (skema + RLS + trigger)
└─ README.md
```

`anon key` aman dipublikasikan (dirancang untuk browser); yang wajib benar adalah **RLS**.

---

## 8. Urutan Pengerjaan (Level 2)

| Tahap | Isi | Hasil |
|-------|-----|-------|
| 1 | Setup project Supabase + skema + RLS + seed Admin | DB siap |
| 2 | Auth: login/logout/role (username) | Login online |
| 3 | Data master: items, vendors, PIC, bagian | CRUD ke DB |
| 4 | Transaksi + validasi stok server + realtime | Input online |
| 5 | Pembelian + tagihan + upload file ke Storage | Alur SJ lengkap |
| 6 | Audit log ke DB + realtime penuh | Selesai |
| 7 | Deployment (Netlify/Vercel) | Online publik |

---

## 9. Keputusan yang Disetujui

| No | Keputusan |
|----|-----------|
| 1 | Platform: **Supabase** |
| 2 | Dipisah jadi **folder proyek ringan** |
| 3 | Login pakai **username** (email internal `inventory.local`) |
| 4 | Mulai dari **data kosong** (+ 1 Admin: `bayu-CRA`) |
| 5 | Dokumen ini disimpan di `inventory-project/docs/` |
| 6 | Proyek baru di folder terpisah; `inventory v3-copy.html` lama tidak diubah |
