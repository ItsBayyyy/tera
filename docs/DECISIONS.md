# DECISIONS — catatan keputusan

Setiap keputusan yang tidak ditetapkan eksplisit oleh `KENALASU_BUILD_PROMPT.md`, beserta alasannya.

## Lingkungan & proses

- **D1 — `CLAUDE.md` di folder induk tidak berlaku.** File `Downloads/CLAUDE.md` adalah aturan proyek lain (Bursa Metana, HTML murni tanpa framework). KenalAsu mengikuti build prompt-nya sendiri (Next.js + Supabase + FastAPI).
- **D2 — Root repo = `frontend/`.** Folder `frontend/` sudah berisi repo git Next.js; build prompt menyebut "Next.js sudah ada di root repo". Semua folder (`ai-service/`, `supabase/`, `scripts/`, `docs/`) diletakkan di dalamnya.
- **D3 — Tetap memakai konfigurasi bawaan scaffold Next 16** (`cacheComponents`, `partialPrefetching`). Halaman berbasis data dibuat sebagai Client Component yang membaca Supabase lewat klien browser (RLS) sehingga shell statis tetap bisa di-prerender; data request-time di route handler memakai `connection()`.
- **D4 — Supabase CLI dipasang sebagai devDependency** (`npx supabase`), bukan global, agar tidak mengubah konfigurasi sistem. Layanan lokal yang tidak dipakai (analytics, edge runtime, vector bucket, SMTP) dimatikan di `supabase/config.toml`; `enable_signup = false` karena akun petugas dibuat admin.
- **D5 — `@types/node` dinaikkan ke 22** agar cocok dengan Node 22 terpasang dan peer dependency Vitest 5.

## Data & database

- **D6 — Embedding disimpan sebagai `halfvec(2152)`.** MiewID msv3 menghasilkan 2152 dimensi; indeks HNSW pgvector untuk tipe `vector` dibatasi 2000 dimensi, `halfvec` sampai 4000. Presisi setengah cukup untuk cosine similarity.
- **D7 — `match_dogs()` memakai scan eksak per banjar, bukan ANN.** Galeri per banjar kecil (ratusan foto), dan HNSW + filter banjar bisa melewatkan kecocokan sebenarnya. Indeks HNSW tetap dibuat (sesuai spesifikasi) untuk pencarian lintas-banjar di masa depan. `p_banjar_id = null` = semua banjar non-demo (laporan warga sering tanpa banjar).
- **D8 — Nilai enum `match_source` ditambah `demo`** agar uji coba juri tidak mencemari metrik pencocokan petugas/warga.
- **D9 — Kolom tambahan di luar spesifikasi minimum:** `banjars.is_demo` (penanda banjar DEMO), `dogs.demo_seed` (agar reset demo mempertahankan data seed), `bite_reports.confirmed_dog_id` (kandidat AI dipisah dari konfirmasi petugas), `bite_reports.match_log_id`, `bite_reports.officer_note`, tabel `duplicate_flags` (hasil job rematch).
- **D10 — Banjar contoh diberi nama "Banjar Contoh 1–3"** dengan kecamatan/kabupaten nyata, kolom desa kosong, `is_sample = true`. Tidak mengarang nama banjar yang tampak nyata.
- **D11 — Ambang awal `match_strong = 0,70`, `match_unsure = 0,50`, ditandai "sementara"** di `app_config.note`. Nilai ini bukan hasil kalibrasi; `scripts/eval.py` memberi rekomendasi dari data nyata dan admin bisa mengubahnya di `/admin`.
- **D12 — Akun uji lokal dibuat di `supabase/seed.sql`** (hanya untuk stack lokal & e2e). Seed tidak pernah dijalankan ke proyek cloud.

## API & alur

- **D13 — Embedding dikembalikan ke perangkat petugas** setelah `/api/scan/analyze`, lalu dikirim lagi ke `/api/scan/match` dan saat menyimpan foto. Ini menjaga route handler tetap stateless (tidak ada penyimpanan sementara foto yang belum tentu dipakai). Petugas sudah terautentikasi; penyalahgunaan hanya merusak data banjarnya sendiri dan tercatat di `match_logs`.
- **D14 — Arti `ai_status`:** `verified` = foto dianalisis AI dan identitas dikonfirmasi/didaftarkan petugas; `pending` = dicatat saat AI tidak tersedia, menunggu job rematch; `manual` = AI tersedia tetapi foto tidak lolos kualitas dan petugas memilih "Catat manual".
- **D15 — Pencocokan laporan warga berjalan setelah respons (`after()`).** Warga langsung mendapat kode kasus; kegagalan AI tidak pernah menunda atau menggagalkan laporan.
- **D16 — Rate limit in-memory per instance** (5 laporan / 10 menit / IP). Cukup untuk meredam banjir tak sengaja; bukan batas keamanan. Dicatat sebagai keterbatasan.
- **D17 — Job rematch:** foto tanpa embedding diproses ulang; kandidat anjing lain dengan skor ≥ `match_unsure` di banjar yang sama ditandai `duplicate_flags`. Vaksinasi `pending` naik ke `verified` hanya bila tidak ada tanda duplikat terbuka. Foto yang ditolak kualitas diberi `model_version = 'rejected:<alasan>'` agar tidak diproses berulang.
