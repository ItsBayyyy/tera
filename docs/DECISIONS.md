# DECISIONS — catatan keputusan

Keputusan teknis dan produk yang tidak terlihat jelas dari kode, beserta alasannya.

## Lingkungan & proses

- **D1 — Tetap memakai konfigurasi bawaan scaffold Next 16** (`cacheComponents`, `partialPrefetching`). Halaman berbasis data dibuat sebagai Client Component yang membaca Supabase lewat klien browser (RLS) sehingga shell statis tetap bisa di-prerender; data request-time di route handler memakai `connection()`.
- **D2 — Supabase CLI dipasang sebagai devDependency** (`npx supabase`), bukan global, agar tidak mengubah konfigurasi sistem. Layanan lokal yang tidak dipakai (analytics, edge runtime, vector bucket, SMTP) dimatikan di `supabase/config.toml`; `enable_signup = false` karena akun petugas dibuat admin.
- **D3 — `@types/node` dinaikkan ke 22** agar cocok dengan Node 22 terpasang dan peer dependency Vitest 5.

## Data & database

- **D4 — Embedding disimpan sebagai `halfvec(2152)`.** MiewID msv3 menghasilkan 2152 dimensi; indeks HNSW pgvector untuk tipe `vector` dibatasi 2000 dimensi, `halfvec` sampai 4000. Presisi setengah cukup untuk cosine similarity.
- **D5 — `match_dogs()` memakai scan eksak per banjar, bukan ANN.** Galeri per banjar kecil (ratusan foto), dan HNSW + filter banjar bisa melewatkan kecocokan sebenarnya. Indeks HNSW tetap dibuat untuk pencarian lintas-banjar di masa depan. `p_banjar_id = null` = semua banjar non-demo (laporan warga sering tanpa banjar).
- **D6 — Nilai enum `match_source` ditambah `demo`** agar uji coba juri tidak mencemari metrik pencocokan petugas/warga.
- **D7 — Kolom tambahan:** `banjars.is_demo` (penanda banjar DEMO), `dogs.demo_seed` (agar reset demo mempertahankan data seed), `bite_reports.confirmed_dog_id` (kandidat AI dipisah dari konfirmasi petugas), `bite_reports.match_log_id`, `bite_reports.officer_note`, tabel `duplicate_flags` (hasil job rematch).
- **D8 — Banjar contoh diberi nama "Banjar Contoh 1–3"** dengan kecamatan/kabupaten nyata, kolom desa kosong, `is_sample = true`. Tidak mengarang nama banjar yang tampak nyata.
- **D9 — Ambang awal `match_strong = 0,70`, `match_unsure = 0,50`, ditandai "sementara"** di `app_config.note`. Nilai ini bukan hasil kalibrasi; `scripts/eval.py` memberi rekomendasi dari data nyata dan admin bisa mengubahnya di `/admin`.
- **D10 — Akun uji lokal dibuat di `supabase/seed.sql`** (hanya untuk stack lokal & e2e). Seed tidak pernah dijalankan ke proyek cloud.

## API & alur

- **D11 — Embedding dikembalikan ke perangkat petugas** setelah `/api/scan/analyze`, lalu dikirim lagi ke `/api/scan/match` dan saat menyimpan foto. Ini menjaga route handler tetap stateless (tidak ada penyimpanan sementara foto yang belum tentu dipakai). Petugas sudah terautentikasi; penyalahgunaan hanya merusak data banjarnya sendiri dan tercatat di `match_logs`.
- **D12 — Arti `ai_status`:** `verified` = foto dianalisis AI dan identitas dikonfirmasi/didaftarkan petugas; `pending` = dicatat saat AI tidak tersedia, menunggu job rematch; `manual` = AI tersedia tetapi foto tidak lolos kualitas dan petugas memilih "Catat manual".
- **D13 — Pencocokan laporan warga berjalan setelah respons (`after()`).** Warga langsung mendapat kode kasus; kegagalan AI tidak pernah menunda atau menggagalkan laporan.
- **D14 — Rate limit in-memory per instance** (5 laporan / 10 menit / IP). Cukup untuk meredam banjir tak sengaja; bukan batas keamanan. Dicatat sebagai keterbatasan.
- **D15 — Job rematch:** foto tanpa embedding diproses ulang; kandidat anjing lain dengan skor ≥ `match_unsure` di banjar yang sama ditandai `duplicate_flags`. Vaksinasi `pending` naik ke `verified` hanya bila tidak ada tanda duplikat terbuka. Foto yang ditolak kualitas diberi `model_version = 'rejected:<alasan>'` agar tidak diproses berulang.

## AI service

- **D16 — Detektor OWL-ViT base-patch32, bukan OWLv2.** OWLv2 @960 butuh ~5,2 s untuk deteksi saja di CPU (target total p50 ≤ 3 s) dan @480 tidak punya ambang bersih anjing vs bukan-anjing. B/32: deteksi p50 571 ms dan rank-1 lebih tinggi pada 60 anjing yang sama (82,2% vs 73,8%). Angka di `docs/AI.md`.
- **D17 — MiewID dimuat tanpa `trust_remote_code`.** Kode checkpoint tidak kompatibel dengan transformers 5.x; arsitektur dibangun ulang dengan timm dan bobot dimuat `strict=True`. Kesetaraan dicek (cosine ≥ 0,999999 pada 14 foto). Revisi model dan detektor dipatok agar ambang tetap berlaku.
- **D18 — Tanpa ONNX.** Target latensi sudah terpenuhi (p50 ≈ 0,9 s); ekspor menambah dependensi dan kode tanpa kebutuhan.
- **D19 — Ambang default diganti ke 0,667 / 0,39** (migrasi `20261108000400`) mengikuti rekomendasi `scripts/eval.py` pada foto mentah DogFaceNet — set yang paling mirip foto lapangan. Hanya baris yang belum diubah admin yang diganti; tetap ditandai "sementara".
- **D20 — Bobot model dimasukkan ke image Docker saat build** dan container berjalan dengan `HF_HUB_OFFLINE=1`, agar Space yang bangun dari tidur tidak bergantung pada unduhan ulang.
- **D21 — Screenshot dikompres ke PNG 256 warna** (26 MB → 10 MB) agar repo tetap ringan; cukup untuk tinjauan visual.

## Nama

- **D22 — Aplikasi diganti nama dari KenalAsu menjadi Tera** (KBBI: *tera* = cap/tanda resmi). Semua nama tampilan, identifier internal (nama paket, logger, cache service worker, `project_id` Supabase lokal, domain akun uji `tera.test`) ikut diganti.
- **D23 — Logo: kepala anjing berkuping tegak (anjing kampung Bali) dengan lencana centang** sebagai "tera" (cap resmi bahwa anjing tercatat), warna aksen `#1f4f7a`. Semua ikon (SVG, PNG 192/512, maskable, apple-icon, favicon) dibangkitkan dari satu sumber vektor oleh `scripts/build-icons.mjs` memakai Chromium Playwright yang sudah terpasang, tanpa dependensi baru. Favicon 16–48 px memakai kepala saja karena lencana tidak terbaca di ukuran itu.
- **D24 — AI service di-host di Modal, bukan Hugging Face Spaces.** Hugging Face kini mewajibkan paket berbayar untuk Space Docker. Modal memberi kredit gratis bulanan tanpa kartu kredit; `ai-service/modal_app.py` menyajikan aplikasi FastAPI yang sama tanpa perubahan kode. Container dibatasi satu (`max_containers=1`) agar kredit tidak bisa terkuras, dan mati 15 menit setelah permintaan terakhir. Untuk menutup waktu nyala ulang, layar scan dan `/demo` memanggil `/api/ai/warm` saat dibuka, dan route yang memanggil AI diberi `maxDuration = 60`.
