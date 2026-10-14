// =====================================================================
// Edge Function: telegram-bot
// Bot Telegram interaktif — membalas perintah dari grup / chat pribadi.
//
// Perintah:
//   /stok    - ringkasan semua stok
//   /kritis  - barang yang perlu restock (stok <= minimum)
//   /cari X  - cari barang berdasarkan nama/kode
//   /masuk   - transaksi IN hari ini
//   /keluar  - transaksi OUT hari ini
//   /help    - daftar perintah
//
// Webhook Telegram memanggil fungsi ini (didaftarkan via setWebhook).
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET (opsional), SUPABASE_*
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function fmtTglWIB(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function todayWIB(): string {
  // yyyy-mm-dd menurut WIB
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA menghasilkan yyyy-mm-dd
}

async function kirim(botToken: string, chatId: number | string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (_e) {
    // abaikan
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!BOT_TOKEN) {
    return new Response("bot token kosong", { status: 500 });
  }

  // Verifikasi asal dari Telegram (kalau secret diset)
  if (WEBHOOK_SECRET) {
    const hdr = req.headers.get("x-telegram-bot-api-secret-token") || "";
    if (hdr !== WEBHOOK_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  let update: any = {};
  try {
    update = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  const msg = update?.message || update?.edited_message;
  if (!msg || !msg.text) {
    return new Response("ok", { status: 200 });
  }

  const chatId = msg.chat.id;
  const text: string = String(msg.text).trim();
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Ambil perintah
  const cmdMatch = text.match(/^\/([a-zA-Z]+)(?:@[^\s]+)?\s*(.*)$/);
  const cmd = cmdMatch ? cmdMatch[1].toLowerCase() : "";
  const arg = cmdMatch ? cmdMatch[2].trim() : "";

  async function balas(s: string) {
    await kirim(BOT_TOKEN, chatId, s);
  }

  try {
    if (cmd === "help" || cmd === "start") {
      await balas(
        [
          "📦 Inventory MP Outbond — Bot",
          "",
          "Perintah tersedia:",
          "/stok    - ringkasan semua stok",
          "/kritis  - barang perlu restock",
          "/cari X  - cari barang (contoh: /cari lakban)",
          "/masuk   - transaksi IN hari ini",
          "/keluar  - transaksi OUT hari ini",
          "/help    - daftar perintah ini",
        ].join("\n"),
      );
      return new Response("ok", { status: 200 });
    }

    if (cmd === "stok") {
      const { data } = await admin
        .from("v_stok")
        .select("kode,nama,satuan,minimum,stok")
        .order("nama");
      const rows = data || [];
      if (rows.length === 0) {
        await balas("(Belum ada barang di master)");
      } else {
        const kritis = rows.filter((r) => Number(r.stok) <= Number(r.minimum));
        const lines = rows.map((r) => {
          const flag = Number(r.stok) <= Number(r.minimum) ? "⚠️" : "✅";
          return `${flag} ${r.nama}: ${r.stok} ${r.satuan || ""} (min ${r.minimum})`.trimEnd();
        });
        await balas(
          [
            `📦 Stok per ${fmtTglWIB(new Date())}`,
            "",
            ...lines,
            "",
            `Total ${rows.length} barang · ${kritis.length} perlu restock`,
          ].join("\n"),
        );
      }
      return new Response("ok", { status: 200 });
    }

    if (cmd === "kritis") {
      const { data } = await admin
        .from("v_stok")
        .select("kode,nama,satuan,minimum,stok")
        .order("nama");
      const kritis = (data || []).filter((r) => Number(r.stok) <= Number(r.minimum));
      if (kritis.length === 0) {
        await balas("✅ Tidak ada barang yang perlu restock. Semua stok aman.");
      } else {
        await balas(
          [
            `⚠️ ${kritis.length} barang PERLU RESTOCK:`,
            "",
            ...kritis.map((r) => `• ${r.nama}: ${r.stok} / min ${r.minimum} ${r.satuan || ""}`.trimEnd()),
          ].join("\n"),
        );
      }
      return new Response("ok", { status: 200 });
    }

    if (cmd === "cari") {
      if (!arg) {
        await balas("Contoh: /cari lakban");
        return new Response("ok", { status: 200 });
      }
      const q = arg.toLowerCase();
      const { data } = await admin
        .from("v_stok")
        .select("kode,nama,satuan,minimum,stok")
        .order("nama");
      const hasil = (data || []).filter(
        (r) =>
          String(r.nama).toLowerCase().includes(q) ||
          String(r.kode).toLowerCase().includes(q),
      );
      if (hasil.length === 0) {
        await balas(`Tidak ditemukan barang dengan kata "${arg}".`);
      } else {
        await balas(
          [
            `🔍 Hasil cari "${arg}":`,
            "",
            ...hasil.map((r) => {
              const flag = Number(r.stok) <= Number(r.minimum) ? "⚠️" : "✅";
              return `${flag} ${r.kode} — ${r.nama}: ${r.stok} ${r.satuan || ""} (min ${r.minimum})`.trimEnd();
            }),
          ].join("\n"),
        );
      }
      return new Response("ok", { status: 200 });
    }

    if (cmd === "masuk" || cmd === "keluar") {
      const jenis = cmd === "masuk" ? "Masuk" : "Keluar";
      const tgl = todayWIB();
      const { data } = await admin
        .from("transaksi")
        .select("kode_barang,jenis,jumlah,pic,bagian,jam")
        .eq("tanggal", tgl)
        .eq("jenis", jenis)
        .order("jam", { ascending: true });
      const rows = data || [];
      // ambil nama barang
      const { data: items } = await admin.from("items").select("kode,nama,satuan");
      const mapItem: Record<string, any> = {};
      (items || []).forEach((i) => (mapItem[i.kode] = i));
      if (rows.length === 0) {
        await balas(`${jenis === "Masuk" ? "📥 IN" : "📤 OUT"} hari ini (${fmtTglWIB(new Date())}): belum ada transaksi.`);
      } else {
        const totalQty = rows.reduce((a, r) => a + Number(r.jumlah || 0), 0);
        const lines = rows.map((r) => {
          const it = mapItem[r.kode_barang] || { nama: r.kode_barang, satuan: "" };
          const jam = r.jam ? String(r.jam).slice(0, 5) + " " : "";
          return `• ${jam}${it.nama}: ${r.jumlah} ${it.satuan || ""} — ${r.pic || "-"}`.trimEnd();
        });
        await balas(
          [
            `${jenis === "Masuk" ? "📥 Transaksi IN" : "📤 Transaksi OUT"} hari ini (${fmtTglWIB(new Date())})`,
            "",
            ...lines,
            "",
            `Total: ${rows.length} transaksi · ${totalQty} qty`,
          ].join("\n"),
        );
      }
      return new Response("ok", { status: 200 });
    }

    // perintah tidak dikenal → diam (atau balas help bila diawali /)
    if (cmd) {
      await balas(`Perintah /${cmd} tidak dikenal. Ketik /help untuk daftar perintah.`);
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    await balas("Terjadi kesalahan saat memproses perintah.");
    return new Response("ok", { status: 200 });
  }
});
