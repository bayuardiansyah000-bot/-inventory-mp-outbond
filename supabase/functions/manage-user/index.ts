// =====================================================================
// Edge Function: manage-user
// Kelola user (buat/ubah/nonaktif/hapus) dengan aman dari sisi server.
// Service role key TIDAK pernah dikirim ke browser.
//
// Aksi yang didukung (body JSON):
//   { action:"create", username, nama, role, password, aktif }
//   { action:"update", username, nama, role, password(opsional), aktif }
//   { action:"delete", username }
//
// Pemanggil HARUS user login yang ber-role Admin (dicek di sini).
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_DOMAIN = "inventory.local";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function emailFor(username: string) {
  return String(username || "").trim().toLowerCase() + "@" + EMAIL_DOMAIN;
}

function avatarFor(nama: string) {
  return String(nama || "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

  // 1. Verifikasi pemanggil = user login & Admin
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Tidak ada token" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "Sesi tidak valid" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: profilPemanggil } = await admin
    .from("profiles")
    .select("role, aktif")
    .eq("id", userData.user.id)
    .single();

  if (!profilPemanggil || profilPemanggil.role !== "Admin" || profilPemanggil.aktif === false) {
    return json({ error: "Hanya Admin yang bisa kelola user" }, 403);
  }

  // 2. Proses aksi
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON tidak valid" }, 400);
  }

  const action = body.action;

  try {
    if (action === "create") {
      const username = String(body.username || "").trim().toLowerCase();
      const nama = String(body.nama || "").trim();
      const role = body.role === "Admin" ? "Admin" : "Operator";
      const password = String(body.password || "");
      const aktif = body.aktif !== false;

      if (!/^[a-z0-9_]+$/.test(username)) {
        return json({ error: "Username tidak valid (huruf kecil, angka, _)" }, 400);
      }
      if (!nama) return json({ error: "Nama wajib diisi" }, 400);
      if (password.length < 6) {
        return json({ error: "Password minimal 6 karakter" }, 400);
      }

      // cek username sudah dipakai
      const { data: ada } = await admin
        .from("profiles").select("id").eq("username", username).maybeSingle();
      if (ada) return json({ error: "Username sudah dipakai" }, 409);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: emailFor(username),
        password: password,
        email_confirm: true,
      });
      if (createErr || !created?.user) {
        return json({ error: createErr?.message || "Gagal membuat user" }, 400);
      }

      const { error: profErr } = await admin.from("profiles").insert({
        id: created.user.id,
        username,
        nama,
        role,
        aktif,
        avatar: avatarFor(nama),
      });
      if (profErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: profErr.message }, 400);
      }
      return json({ ok: true, id: created.user.id });
    }

    if (action === "update") {
      const username = String(body.username || "").trim().toLowerCase();
      const { data: target } = await admin
        .from("profiles").select("id").eq("username", username).maybeSingle();
      if (!target) return json({ error: "User tidak ditemukan" }, 404);

      const patch: any = {};
      if (body.nama != null) patch.nama = String(body.nama).trim();
      if (body.role != null) patch.role = body.role === "Admin" ? "Admin" : "Operator";
      if (body.aktif != null) patch.aktif = body.aktif !== false;
      if (body.nama != null) patch.avatar = avatarFor(String(body.nama));

      const { error: upErr } = await admin
        .from("profiles").update(patch).eq("id", target.id);
      if (upErr) return json({ error: upErr.message }, 400);

      if (body.password) {
        const password = String(body.password);
        if (password.length < 6) {
          return json({ error: "Password minimal 6 karakter" }, 400);
        }
        const { error: pwErr } = await admin.auth.admin.updateUserById(target.id, {
          password,
        });
        if (pwErr) return json({ error: pwErr.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      const username = String(body.username || "").trim().toLowerCase();
      const { data: target } = await admin
        .from("profiles").select("id").eq("username", username).maybeSingle();
      if (!target) return json({ error: "User tidak ditemukan" }, 404);
      if (target.id === userData.user.id) {
        return json({ error: "Tidak bisa menghapus akun sendiri" }, 400);
      }
      // hapus profil (RLS dilewati oleh service role), lalu akun auth
      await admin.from("profiles").delete().eq("id", target.id);
      const { error: delErr } = await admin.auth.admin.deleteUser(target.id);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
