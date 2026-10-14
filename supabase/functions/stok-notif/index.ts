// =====================================================================
// Edge Function: stok-notif
// Mengirim notifikasi stok kritis ke Telegram (grup + pribadi).
//
// Cara panggil:
//   A. Dari cron server: POST + header "x-notif-secret: <NOTIF_SECRET>"
//   B. Dari aplikasi: user login ber-role Admin (Authorization: Bearer <token>)
//
// Env yang dibutuhkan:
//   TELEGRAM_BOT_TOKEN  - token bot Telegram
//   TELEGRAM_CHAT_IDS   - daftar chat id dipisah koma (grup & pribadi)
//   NOTIF_SECRET        - kunci rahasia untuk pemanggilan cron
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-notif-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fmtWaktuWIB(d: Date) {
  const opsi: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return new Intl.DateTimeFormat("id-ID", opsi).format(d);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Metode tidak diizinkan" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  const CHAT_IDS = (Deno.env.get("TELEGRAM_CHAT_IDS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const NOTIF_SECRET = Deno.env.get("NOTIF_SECRET") || "";

  if (!BOT_TOKEN || CHAT_IDS.length === 0) {
    return json({ error: "Konfigurasi Telegram belum lengkap" }, 500);
  }

  // ---- Otorisasi ----
  const secretHeader = req.headers.get("x-notif-secret") || "";
  const viaSecret = NOTIF_SECRET && secretHeader === NOTIF_SECRET;

  if (!viaSecret) {
    // harus user login & Admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Tidak ada token" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Sesi tidak valid" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profil } = await admin
      .from("profiles")
      .select("role, aktif")
      .eq("id", userData.user.id)
      .single();
    if (!profil || profil.role !== "Admin" || profil.aktif === false) {
      return json({ error: "Hanya Admin yang bisa mengirim notifikasi" }, 403);
    }
  }

  // ---- Ambil data stok ----
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: rows, error: stokErr } = await admin
    .from("v_stok")
    .select("kode,nama,satuan,minimum,stok")
    .order("nama");
  if (stokErr) return json({ error: "Gagal baca stok: " + stokErr.message }, 500);

  const semua = rows || [];
  const kritis = semua.filter((r) => Number(r.stok) <= Number(r.minimum));
  const aman = semua.filter((r) => Number(r.stok) > Number(r.minimum));

  // ---- Susun pesan ----
  const waktu = fmtWaktuWIB(new Date());
  const lines: string[] = [];
  lines.push(`📦 Inventory MP Outbond — ${waktu}`);
  lines.push("");

  if (semua.length === 0) {
    lines.push("(Belum ada barang di master)");
  } else if (kritis.length === 0) {
    lines.push(`✅ Semua ${aman.length} barang stok AMAN.`);
  } else {
    lines.push(`⚠️ ${kritis.length} barang PERLU RESTOCK:`);
    kritis.slice(0, 15).forEach((r) => {
      lines.push(`• ${r.nama}: ${r.stok} / min ${r.minimum} ${r.satuan || ""}`.trimEnd());
    });
    if (kritis.length > 15) lines.push(`+${kritis.length - 15} lainnya`);
    lines.push("");
    lines.push(`✓ ${aman.length} barang stok aman.`);
  }

  const pesan = lines.join("\n");

  // ---- Kirim ke semua chat id ----
  const hasil: unknown[] = [];
  for (const chatId of CHAT_IDS) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: pesan }),
        },
      );
      const d = await res.json();
      hasil.push({ chat_id: chatId, ok: !!d.ok, desc: d.description || "" });
    } catch (e) {
      hasil.push({ chat_id: chatId, ok: false, desc: String((e as Error)?.message || e) });
    }
  }

  return json({
    ok: true,
    total_barang: semua.length,
    kritis: kritis.length,
    aman: aman.length,
    terkirim: hasil,
  });
});
