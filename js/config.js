// ==================== KONFIGURASI SUPABASE ====================
// Isi dua nilai di bawah sesuai project Supabase Anda.
// Cara ambil: Supabase Dashboard -> Project Settings -> API
//   - Project URL        -> SUPABASE_URL
//   - anon public key    -> SUPABASE_ANON_KEY
//
// Catatan keamanan:
//   anon key AMAN dipublikasikan (dirancang untuk dipakai di browser).
//   Yang WAJIB benar adalah Row Level Security (RLS) di database.
window.SUPABASE_CONFIG = {
  SUPABASE_URL: "https://wftfrccvghzudsfqfqvj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmdGZyY2N2Z2h6dWRzZnFmcXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NDEyNzYsImV4cCI6MjEwNzAxNzI3Nn0.jrQQL9E80ogr8BhTdZ-xBxQ2pyTHVd0-E1GEZ-iYhuA",
  EMAIL_DOMAIN: "inventory.local" // email internal untuk login username
};
