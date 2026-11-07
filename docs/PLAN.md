# PLAN — KenalAsu MVP

Rencana kerja yang disesuaikan dengan kondisi repo dan mesin nyata (audit 8 Nov 2026).

## Audit lingkungan

| Item | Temuan |
|---|---|
| Repo | `frontend/` = repo git (1 commit "Initial commit from Create Next App"). Root repo = root Next.js. `KENALASU_BUILD_PROMPT.md` berada satu tingkat di atas repo. |
| Next.js | 16.4.5, React 19.3, App Router, TypeScript `strict`, Tailwind v4 (via `@tailwindcss/turbopack`). `next.config.ts` sudah mengaktifkan `cacheComponents`, `partialPrefetching`, `experimental.agentFeedback`. `middleware` di Next 16 bernama `proxy`. |
| Node / npm | Node 22.13.1, npm 11.1 |
| Python | Sistem 3.10 dan 3.14. `uv` 0.11 tersedia → venv Python 3.11 khusus `ai-service/.venv`. |
| Docker | 29.5.3, daemon berjalan. |
| Supabase CLI | Tidak terpasang global → dipasang sebagai devDependency (`npx supabase`, v3.0.0). |
| GPU | RTX 2050 ada, tetapi target produksi CPU (HF Spaces gratis) → benchmark di CPU. |
| Konfigurasi global | Tidak diubah. Cache model HF diarahkan ke `ai-service/.cache/`, browser Playwright ke `node_modules` (`PLAYWRIGHT_BROWSERS_PATH=0`). |

## Catatan konflik instruksi

`CLAUDE.md` di folder induk (`Downloads/`) adalah aturan proyek lain (Bursa Metana, HTML/CSS/JS murni). Itu tidak berlaku untuk KenalAsu; yang berlaku adalah `KENALASU_BUILD_PROMPT.md`. Dicatat di `docs/DECISIONS.md`.

## Rencana milestone

| # | Isi | Catatan kondisi nyata |
|---|---|---|
| M0 | Audit + rencana ini | — |
| M1 | `supabase/migrations/`: skema, RLS, storage bucket privat, `match_dogs()`, `banjar_coverage()`, seed banjar contoh + DEMO, tipe TS hasil `supabase gen types` | Dimensi embedding MiewID diverifikasi dari output model (perkiraan 2152 > batas HNSW `vector` 2000) → `halfvec(N)` + HNSW `halfvec_cosine_ops`. |
| M2 | `ai-service/` FastAPI (quality gate OpenCV, OWLv2, MiewID), pytest, benchmark, Dockerfile HF Space | Dikerjakan paralel oleh sub-agent; kontrak endpoint ditetapkan di awal agar route handler bisa dibangun bersamaan. |
| M3 | Route handler scan (`/api/scan/analyze`, `/api/scan/match`) + logika zona fungsi murni + Vitest | — |
| M4 | UI Petugas: masuk, pilih banjar, scan 1–3 foto, hasil zona, daftar anjing, catat vaksin, detail anjing | e2e Playwright dengan AI mock (server Node lokal). |
| M5 | Fallback "Catat tanpa verifikasi AI" + `/api/jobs/rematch` + calon duplikat | e2e dengan AI mati (URL tak terjangkau). |
| M6 | Mode Warga `/darurat` + service worker offline + antrean kasus `/petugas/kasus` (Realtime) | e2e AI hidup & mati. |
| M7 | `/admin` (cakupan, faskes, ambang), `/demo`, `scripts/seed_demo.py` | State kosong dirancang bila `data/demo/` kosong. |
| M8 | Polish desain + loop screenshot 360/1280 → `docs/screenshots/` | — |
| M9 | `scripts/eval.py`, dokumentasi lengkap, GitHub Actions, pemeriksaan akhir | Angka evaluasi hanya yang terukur. |

## Prinsip

- Pencocokan di Postgres; AI service stateless.
- Kunci service role hanya di server; operasi petugas memakai sesi pengguna (RLS), service role hanya untuk laporan warga, job rematch, dan mode demo.
- Tidak ada angka/teks yang dikarang; kontak faskes hanya dari input admin.
