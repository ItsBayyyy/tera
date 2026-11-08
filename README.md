<img src="public/icon.svg" width="96" height="96" alt="Logo Tera: kepala anjing dengan lencana centang">

# Tera

*Tera* (KBBI): cap atau tanda resmi. Setiap anjing yang divaksin mendapat "tera" digital — identitas yang bisa dicek ulang dari fotonya.

Aplikasi web (PWA, mobile-first) untuk pengendalian rabies di Bali. **Petugas vaksinator** memotret wajah anjing; AI mengenali anjing yang sudah terdaftar dan menampilkan status vaksinnya. **Warga yang digigit anjing** langsung mendapat panduan pertolongan pertama, tombol darurat, dan arahan ke fasilitas kesehatan — tanpa login.

| | |
|---|---|
| Lomba | Bali DigiFest 2026 — AI Web Innovation Challenge |
| Kategori | Mahasiswa/Umum |
| Subtema | Bali Smart Society |
| URL live | https://tera-three-gamma.vercel.app (mode demo tanpa login: `/demo`) |
| Versi yang dinilai | tag `v1.0-submission` |
| Peserta | Made Bayu Ardana Putra (individu), Universitas Primakara |

## Masalah

Sepanjang 2025, **66.760 orang** di Bali tergigit hewan penular rabies dan **16 korban meninggal**; menurut Dinkes Bali, korban yang meninggal tidak dibawa ke faskes (ANTARA Bali, 9 Jan 2026). Cakupan vaksinasi anjing **49,51%** per 17 Juli 2026 (Bali Post, 20 Jul 2026), sekitar 60% per 20 September dengan target 87% akhir 2026 (Bali Post, 21 Sep 2026). Dua hambatan lapangan yang disasar Tera:

1. **Petugas tidak tahu apakah anjing di depannya sudah divaksin.** Anjing kampung jarang berkalung atau bertanda; vaksinasi ulang atau terlewat terjadi karena identitas anjing tidak bisa dicek di tempat.
2. **Korban gigitan panik dan tidak tahu langkah pertama.** Cuci luka segera dan datang ke faskes hari itu adalah langkah yang paling menentukan.

## Pengguna

- **Petugas vaksinator** di banjar: satu tangan, di bawah terik, sinyal lemah.
- **Admin dinas**: memantau cakupan per banjar, mengelola faskes dan ambang pencocokan.
- **Warga yang digigit**: tanpa akun, dalam keadaan panik.

## Fitur

### Sudah berjalan

| Fitur | Halaman |
|---|---|
| Panduan pertolongan pertama bernomor dengan kalimat penenang, tombol **Bacakan langkah** (suara bahasa Indonesia bawaan HP, kartu aktif disorot), **timer cuci luka 15 menit** (layar tetap menyala, pengingat suara), tombol **peta puskesmas & rumah sakit terdekat**, tombol telepon **119** dan **112** yang selalu terlihat, bisa dibuka offline (service worker) | `/darurat` |
| Laporan gigitan opsional (waktu, bagian tubuh, lokasi dibulatkan, foto anjing dari jarak aman, HP + persetujuan) → kode kasus pendek; tetap jalan saat AI mati | `/darurat` |
| Login petugas (Supabase Auth), pilih banjar aktif | `/masuk`, `/petugas` |
| Scan 1–3 foto, umpan balik kualitas per foto ("Terlalu gelap, cari cahaya"), hasil tiga zona: **kuat** (1 kandidat besar), **ragu** (5 kandidat berdampingan), **tidak cocok** (daftar baru + 3 terdekat) | `/petugas/scan` |
| Daftarkan anjing baru, catat vaksin, tambah foto, riwayat vaksin | `/petugas/scan`, `/petugas/anjing/[id]` |
| Fallback AI: "Catat tanpa verifikasi AI" → `ai_status = pending` → job rematch mengisi embedding dan menandai calon duplikat | `/petugas/scan`, `/admin` |
| Antrean laporan gigitan real-time, kandidat anjing dari AI yang **harus dikonfirmasi petugas**, ubah status | `/petugas/kasus` |
| Dasbor cakupan per banjar, kelola faskes, ubah ambang, tinjau calon duplikat | `/admin` |
| Mode demo untuk juri tanpa login, banjar DEMO terpisah, tombol reset | `/demo` |

### Rencana (belum dibuat)

- Peta sebaran kasus tingkat banjar untuk dinas.
- Mode offline untuk petugas (antrean scan saat tanpa sinyal).
- Ekspor laporan cakupan (CSV) dan kebijakan retensi data.
- Kalibrasi ambang dengan foto anjing Bali nyata.

## Arsitektur

```
Browser (Next.js PWA)
  └─ kompres foto + hapus EXIF di perangkat (canvas, ≤1024 px, JPEG 0,8)
      └─ Next.js Route Handlers (server, TypeScript, zod)
          ├─ AI Service (FastAPI, Python, CPU) ← stateless: kualitas + deteksi + embedding
          └─ Supabase (Postgres + pgvector, Auth, Storage privat, Realtime)
               └─ match_dogs() → top-5 kandidat (skor terbaik per anjing)
```

Diagram lengkap dan alasan desain: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Keputusan: [`docs/DECISIONS.md`](docs/DECISIONS.md).

## AI pipeline

Semua berjalan di AI service milik sendiri (`ai-service/`, FastAPI, CPU); pencocokan di Postgres. Detail dan angka pengukuran: [`docs/AI.md`](docs/AI.md).

1. **Quality gate** (OpenCV): blur (variance of Laplacian), terlalu gelap/terang, terlalu kecil → pesan spesifik untuk petugas.
2. **Deteksi anjing + wajah** dengan OWL-ViT base-patch32 (open-vocabulary, Apache-2.0) → `NO_DOG` / `FACE_NOT_VISIBLE` atau crop kepala.
3. **Embedding re-identifikasi** MiewID msv3 → vektor 2152 dimensi, L2-normalized.
4. **Pencocokan** `match_dogs()` (pgvector `halfvec`, cosine): skor terbaik per anjing di banjar aktif, 1–3 foto per scan → zona **kuat ≥ 0,667**, **ragu ≥ 0,39**, selain itu **tidak cocok** (ambang sementara, bisa diubah admin).

Latensi `/v1/analyze` di CPU laptop: **p50 ≈ 0,9 s**, p95 ≈ 0,95 s (n=1516); target p50 ≤ 3 s.

## Hasil evaluasi

Diukur dengan `scripts/eval.py` (split per individu anjing, open-set) pada dataset publik **DogFaceNet** — **belum pada anjing Bali**. Lengkap: [`docs/EVALUATION.md`](docs/EVALUATION.md).

| Data | Rank-1 | Rank-5 | TAR@FAR=1% | Anjing tak terdaftar tidak masuk zona kuat |
|---|---|---|---|---|
| Foto mentah, pipeline penuh (300 anjing, 1516 foto) | 60,2% | 72,4% | 62,8% | 100% |
| Potongan wajah ter-align, split uji resmi (139 anjing) | 98,7% | 100% | 99,1% | 99,5% |

Pada ambang yang direkomendasikan untuk foto mentah, hanya 14,4% probe terdaftar masuk zona kuat (semuanya benar); sisanya masuk zona ragu/tidak cocok dan butuh pemeriksaan petugas. Model MiewID kemungkinan pernah dilatih dengan DogFaceNet, jadi angka ini bisa terlalu optimistis.

## Fallback saat AI gagal

- Panggilan AI dibatasi **15 detik**; timeout, error HTTP, atau respons di luar kontrak dianggap "AI tidak tersedia" (`lib/ai/client.ts`). Detail teknis hanya masuk log server terstruktur, tidak ke pengguna.
- **Petugas**: layar scan menawarkan "Catat tanpa verifikasi AI". Foto disimpan tanpa embedding, vaksinasi tercatat dengan `ai_status = pending`. `POST /api/jobs/rematch` (tombol di `/admin` atau scheduler dengan `JOBS_SECRET`) memproses ulang foto, menandai calon duplikat, dan menaikkan status ke `verified` bila tidak ada duplikat.
- **Foto tidak lolos kualitas**: petugas mendapat pesan spesifik; setelah dua kali gagal tersedia "Catat manual" (`ai_status = manual`).
- **Warga**: laporan tidak pernah menunggu AI. Kode kasus langsung dikembalikan; analisis foto berjalan setelah respons. Foto buruk tidak memicu permintaan foto ulang.

## Privasi

EXIF dihapus di perangkat, lokasi dibulatkan ±100 m, tidak ada peta publik (agregat hanya per banjar untuk staf), data pemilik dan nomor HP opsional dengan persetujuan, foto di bucket privat dengan signed URL, tidak ada API AI pihak ketiga. Detail: [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Untuk Juri

**Cara menguji dengan foto sendiri**

1. Buka `/demo` (tanpa login). Di "Coba dengan foto Anda", unggah **foto A** seekor anjing → isi warna → "Daftarkan anjing demo".
2. Unggah **foto B** anjing yang sama (sudut/waktu berbeda) di langkah 2 → lihat zona dan skor kemiripan. Coba juga foto anjing lain untuk melihat zona "tidak cocok".
3. Bila galeri demo terisi, pilih "Foto uji" untuk melihat apakah sistem mengenali anjing seed; jawaban sebenarnya ditampilkan setelahnya.
4. "Reset data demo" menghapus anjing yang Anda tambahkan.
5. `/darurat` dapat dicoba langsung; laporan masuk ke antrean petugas.

**Di mana AI dipanggil**

| Langkah | File |
|---|---|
| Klien HTTP ke AI service (timeout, validasi kontrak) | `lib/ai/client.ts` |
| Route handler scan petugas | `app/api/scan/analyze/route.ts`, `app/api/scan/match/route.ts` |
| Pencocokan + log + zona | `lib/match/run.ts`, `lib/match/zone.ts`, fungsi SQL `match_dogs()` di `supabase/migrations/20261108000300_functions.sql` |
| Laporan warga (setelah respons) | `app/api/reports/route.ts`, `lib/reports.ts` |
| Job rematch | `app/api/jobs/rematch/route.ts`, `lib/rematch.ts` |
| Mode demo | `app/api/demo/scan/route.ts`, `app/api/demo/register/route.ts` |
| AI service (kualitas, deteksi, embedding) | `ai-service/app/` |

**Bagaimana sistem menangani AI gagal**: lihat bagian "Fallback saat AI gagal" di atas; diuji e2e (`e2e/fallback.spec.ts`, `e2e/citizen.spec.ts`) dengan AI mock yang dimatikan.

**Data apa yang dikirim ke model dan di mana diproses**: hanya foto JPEG yang sudah dikompres dan dibersihkan metadata di perangkat. Foto dikirim dari server Next.js ke AI service milik sendiri (header `X-Service-Key`), diproses di memori, dan tidak disimpan oleh AI service. Embedding dikembalikan ke server dan disimpan di Postgres proyek. Tidak ada data yang dikirim ke API AI pihak ketiga.

## Menjalankan lokal

Prasyarat: Node 22, Docker, Python 3.11 + [uv](https://docs.astral.sh/uv/).

```bash
npm install
npx supabase start            # pertama kali mengunduh image Docker
npx supabase db reset         # migrasi + seed lokal (akun uji ada di supabase/seed.sql)
cp .env.example .env.local    # isi dari: npx supabase status -o env
npm run dev                   # http://localhost:3000
```

AI service (terminal lain):

```bash
uv venv --python 3.11 ai-service/.venv
uv pip install --python ai-service/.venv/Scripts/python.exe -r ai-service/requirements-dev.txt   # Linux/macOS: .venv/bin/python
cd ai-service && cp .env.example .env    # isi AI_SERVICE_KEY = nilai yang sama di .env.local
.venv/Scripts/uvicorn --factory app.main:create_app --env-file .env --host 127.0.0.1 --port 8000
```

Pertama kali mengunduh ±0,8 GB bobot model ke `ai-service/.cache/`. Data demo: isi `data/demo/<nama_anjing>/*.jpg` lalu `ai-service/.venv/Scripts/python scripts/seed_demo.py`. Evaluasi: lihat `docs/EVALUATION.md`.

Akun lokal: `petugas@tera.test` dan `admin@tera.test` (kata sandi di `supabase/seed.sql`, hanya untuk stack lokal).

Pemeriksaan:

```bash
npm run lint && npm run typecheck && npm test   # Vitest
npm run test:db                                  # integrasi Postgres/RLS (stack lokal harus jalan)
npm run build
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright test   # e2e dengan AI mock (hidup & mati)
```

## Deploy

Langkah deploy (Supabase cloud, Vercel, Hugging Face Spaces): [`docs/DEPLOY.md`](docs/DEPLOY.md). Semua di tier gratis, tanpa kartu kredit.

## Model, dataset, dan lisensi

| Komponen | Lisensi |
|---|---|
| MiewID msv3 (`conservationxlabs/miewid-msv3`) | **Tidak dinyatakan** oleh pembuatnya; izin tertulis belum diperoleh (lihat [`docs/AI.md`](docs/AI.md#lisensi)) |
| OWL-ViT base-patch32 (`google/owlvit-base-patch32`) | Apache-2.0 |
| timm, FastAPI, OpenCV, PyTorch, Next.js, Supabase | Apache-2.0 / MIT / BSD (lihat masing-masing paket) |
| DogFaceNet (evaluasi, foto demo) | CC BY 4.0 — Mougeot, Li, Jia, PRICAI 2019 |
| Foto sampel test | CC0 / domain publik (Wikimedia Commons) |
| Plus Jakarta Sans | SIL OFL 1.1 |

Rincian dan URL sumber: [`docs/AI.md`](docs/AI.md#lisensi).

## Keterbatasan

- Ambang pencocokan masih **sementara**: dikalibrasi pada DogFaceNet, belum pada foto anjing Bali nyata.
- Detektor saat ini hampir selalu memotong seluruh anjing, bukan hanya wajah; akurasi pada foto mentah jauh di bawah potongan wajah ter-align (60% vs 99% rank-1).
- Lisensi bobot MiewID belum dinyatakan pembuatnya.
- Re-identifikasi dari wajah bisa keliru pada anjing berwarna seragam (mis. hitam polos) dan foto buruk; karena itu keputusan akhir selalu dikonfirmasi petugas.
- AI service berjalan di CPU gratis; latensi bisa lebih tinggi saat Space baru bangun.
- Panduan pertolongan pertama belum ditinjau tenaga kesehatan (ditandai di halaman).
- Rate limit laporan warga per instance server, bukan global.
- Belum ada mode offline untuk petugas.

## Dokumen lain

[`docs/AI.md`](docs/AI.md) · [`docs/EVALUATION.md`](docs/EVALUATION.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/PRIVACY.md`](docs/PRIVACY.md) · [`docs/DECISIONS.md`](docs/DECISIONS.md) · [`docs/DEPLOY.md`](docs/DEPLOY.md) · [`AI_DISCLOSURE.md`](AI_DISCLOSURE.md) · [`docs/screenshots/`](docs/screenshots/)
