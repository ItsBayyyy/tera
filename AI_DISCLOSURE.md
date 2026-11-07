# Pernyataan Penggunaan AI

## 1. AI dalam pembuatan kode

Kode, migrasi database, test, dan dokumentasi repo ini ditulis dengan bantuan AI coding assistant **Claude Code** (Anthropic). Tim meninjau, menjalankan, dan bertanggung jawab atas hasilnya. Keputusan desain dicatat di `docs/DECISIONS.md`.

## 2. AI di dalam produk

AI di KenalAsu adalah **computer vision**, bukan model bahasa (LLM). Tidak ada chatbot dan tidak ada teks yang dibangkitkan AI di produk.

| Tahap | Komponen | Berjalan di |
|---|---|---|
| Pemeriksaan kualitas foto | OpenCV (variance of Laplacian, kecerahan, resolusi) | AI service milik sendiri (`ai-service/`) |
| Deteksi wajah/kepala anjing | Detektor open-vocabulary (detail & lisensi di `docs/AI.md`) | AI service milik sendiri |
| Embedding re-identifikasi | MiewID (`conservationxlabs/miewid-msv3`) | AI service milik sendiri |
| Pencocokan | Cosine similarity `pgvector` di fungsi SQL `match_dogs()` | Postgres (Supabase) milik proyek |

Keputusan akhir selalu di tangan manusia: petugas mengonfirmasi kandidat ("Ya, anjing ini" / "Bukan"), dan kandidat dari laporan warga ditandai "Saran AI, bukan kepastian". Status vaksin anjing tidak pernah ditampilkan ke warga dan tidak dipakai untuk menyatakan korban aman.

## 3. Layanan pihak ketiga

| Layanan | Kegunaan | Data yang dikirim |
|---|---|---|
| Supabase (Postgres, Auth, Storage, Realtime) | Database, login petugas, penyimpanan foto privat | Data operasional |
| Hugging Face Spaces (rencana deploy) | Hosting AI service milik sendiri | Foto yang dianalisis (tidak disimpan) |
| Hugging Face Hub | Mengunduh bobot model saat build/start | Tidak ada data pengguna |
| Vercel (rencana deploy) | Hosting aplikasi Next.js | Lalu lintas web |
| Google Fonts via `next/font` | Font Plus Jakarta Sans diunduh saat build dan disajikan sendiri | Tidak ada data pengguna saat runtime |

Tidak ada API AI pihak ketiga (OpenAI, Gemini, OpenRouter, dll.).

## 4. Asal konsep Mode Warga

Konsep **Mode Warga** (panduan pertolongan pertama darurat, tombol telepon darurat, dan ringkasan kasus untuk petugas) dikembangkan dari karya tim sebelumnya, **Vishara** (FIT Competition 2026). Implementasi di repo ini ditulis baru.

## 5. Sumber dan lisensi data

Lihat `docs/AI.md` (model, detektor, dataset evaluasi, foto contoh) dan `README.md`. Angka konteks rabies Bali di README berasal dari Dinkes Bali via ANTARA Bali (9 Jan 2026) dan Bali Post (17 Juli 2026). Foto uji e2e di `e2e/fixtures/` adalah gambar sintetis buatan skrip.
