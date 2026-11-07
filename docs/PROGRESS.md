# PROGRESS

## Laporan akhir (8 Nov 2026)

**Semua milestone M0–M9 selesai secara lokal.** Yang tidak bisa dikerjakan tanpa pemilik (akun cloud, deploy, lisensi MiewID, tinjauan medis, tag rilis) ada di [`MORNING_TODO.md`](../MORNING_TODO.md).

### Milestone

| # | Status | Bukti |
|---|---|---|
| M0 Audit + rencana | Selesai | `docs/PLAN.md` |
| M1 Supabase | Selesai | 4 migrasi + seed lokal; `supabase db reset` sukses; `npm run test:db` 11/11 (RLS anon/officer, `match_dogs`, `banjar_coverage`) |
| M2 AI service | Selesai | pytest 38/38 (28 kontrak/pipeline + 10 model asli); benchmark terukur; Dockerfile HF Space (belum di-build) |
| M3 Route scan + zona | Selesai | Vitest 42/42; integrasi dengan AI service asli lewat mode demo (6/6 foto uji dikenali, kucing ditolak) |
| M4 UI Petugas | Selesai | e2e alur scan → daftar → catat vaksin → dikenali ulang |
| M5 Fallback + rematch | Selesai | e2e AI mati → "Catat tanpa verifikasi AI" → rematch → terverifikasi |
| M6 Mode Warga + kasus | Selesai | e2e warga AI hidup, AI mati, offline (service worker); laporan muncul di antrean real-time |
| M7 Admin + demo + seed | Selesai | `/admin`, `/demo`, `scripts/seed_demo.py` (dijalankan dengan AI asli: 6 anjing, 12 foto, 6 foto uji) |
| M8 Polish + screenshot | Selesai | 44 screenshot 360/1280 px di `docs/screenshots/`, ditinjau; perbaikan: tab aktif, label tombol, fokus konfirmasi laporan, kontras tombol status, teks P3K dipangkas ke isi spesifikasi |
| M9 Eval, docs, CI | Selesai | `docs/EVALUATION.md` (terukur), README, ARCHITECTURE, AI, PRIVACY, DECISIONS, AI_DISCLOSURE, `.github/workflows/ci.yml` (belum pernah dijalankan di GitHub karena repo tidak di-push) |

### Hasil test (dijalankan di mesin ini)

| Perintah | Hasil |
|---|---|
| `npm run lint` | bersih |
| `npm run typecheck` | bersih |
| `npm test` (Vitest) | 42 lulus |
| `npm run test:db` | 11 lulus |
| `npm run build` | sukses |
| `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright test` | 8 lulus, 4 dilewati (spec screenshot, hanya dengan `SCREENSHOTS=1`) |
| `cd ai-service && .venv/Scripts/python -m pytest -q` | 38 lulus |
| `ai-service/.venv/Scripts/python -m pytest scripts/tests -q` | 21 lulus |

### Angka terukur

- Latensi `/v1/analyze` CPU laptop (Intel gen-11, 12 thread): HTTP p50 831–902 ms / p95 882–946 ms (n=40); seluruh foto evaluasi p50 899 ms / p95 954 ms (n=1516). Deteksi ~572 ms, embedding ~297 ms.
- Evaluasi DogFaceNet foto mentah (300 anjing, 1516 foto): rank-1 60,2%, rank-5 72,4%, TAR@FAR=1% 62,8%. Wajah ter-align (139 anjing): rank-1 98,7%. Belum ada data Bali.
- Dimensi embedding MiewID: 2152 (float32), diverifikasi dari output model.

### Keputusan penting

Lihat [`docs/DECISIONS.md`](DECISIONS.md): `halfvec(2152)` (D6), scan eksak per banjar (D7), arti `ai_status` (D14), laporan warga tidak menunggu AI (D15), OWL-ViT B/32 (D18), MiewID tanpa `trust_remote_code` (D19), ambang 0,667/0,39 dari evaluasi (D21).

### Menjalankan semuanya lokal

```bash
npm install
npx supabase start
npx supabase db reset
cp .env.example .env.local          # isi dari: npx supabase status -o env
# AI service (terminal lain)
uv venv --python 3.11 ai-service/.venv
uv pip install --python ai-service/.venv/Scripts/python.exe -r ai-service/requirements-dev.txt
cd ai-service && cp .env.example .env   # AI_SERVICE_KEY sama dengan .env.local
.venv/Scripts/uvicorn --factory app.main:create_app --env-file .env --host 127.0.0.1 --port 8000
# kembali ke root
ai-service/.venv/Scripts/python scripts/seed_demo.py   # butuh data/demo/
npm run dev
```

Akun lokal: `petugas@kenalasu.test`, `admin@kenalasu.test` (kata sandi di `supabase/seed.sql`).

### MORNING_TODO (urut paling mendesak)

1. Proyek Supabase cloud + `supabase db push` + akun admin pertama.
2. Isi environment variable (Vercel, HF Space).
3. Deploy HF Spaces (AI) dan Vercel (web); ukur latensi Space.
4. Isi foto demo/eval (idealnya anjing Bali) dan jalankan ulang eval.
5. Tinjau panduan pertolongan pertama dengan tenaga kesehatan.
6. Isi daftar faskes dari sumber resmi.
7. **Verifikasi lisensi MiewID (tidak dinyatakan pembuatnya — paling berisiko)**, atribusi DogFaceNet.
8. Lengkapi placeholder README (URL live, tim, kategori).
9. Buat tag `v1.0-submission`.

### Catatan lingkungan

- Disk C: ±97% terpakai. Data lokal besar yang aman dihapus bila perlu (semuanya gitignored): `data/downloads/` (~2 GB arsip DogFaceNet), `ai-service/.cache/uv` (cache instalasi).
- Repo tidak di-push dan tidak ada tag rilis, sesuai instruksi.
