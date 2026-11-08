# Deploy

Semua komponen berjalan di tier gratis tanpa kartu kredit: **Supabase** (database), **Modal** (AI service, kredit gratis bulanan), dan **Vercel** (web). Repo ini tetap menjadi satu-satunya sumber kode; Modal membangun image langsung dari folder `ai-service/`.

> Hugging Face Spaces kini mewajibkan paket berbayar untuk Space Docker, jadi AI service dipindah ke Modal. `ai-service/Dockerfile` tetap tersedia untuk host container lain.

## 1. Supabase

1. Buat proyek di supabase.com (region Singapore).
2. Dari root repo:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-proyek>
   npx supabase db push
   ```
   Ekstensi pgvector dibuat oleh migrasi. `supabase/seed.sql` **tidak** ikut ke cloud; akun uji di dalamnya hanya untuk stack lokal.
3. Buat akun admin: Authentication → Users → Add user, lalu di SQL Editor:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Nama Admin' where user_id = '<uuid user>';
   ```
   Akun petugas dibuat dengan cara yang sama (role default `officer`). Pakai kata sandi baru, bukan kata sandi akun uji lokal.
4. Ganti banjar contoh (`banjars.is_sample = true`) dengan banjar nyata bila diperlukan.

## 2. Environment variable

| Tempat | Variabel | Lihat |
|---|---|---|
| Vercel → Settings → Environment Variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `AI_SERVICE_URL`, `AI_SERVICE_KEY`, `JOBS_SECRET` | `.env.example` |
| Secret Modal `tera-ai` | `AI_SERVICE_KEY` (sama dengan di Vercel) | `ai-service/modal_app.py` |

Buat nilai acak panjang untuk `AI_SERVICE_KEY` dan `JOBS_SECRET`, misalnya `openssl rand -hex 32`.

## 3. AI service di Modal

1. Daftar di modal.com (paket Starter: kredit gratis bulanan, tanpa kartu kredit), lalu pasang CLI dan login:
   ```bash
   uv pip install --python ai-service/.venv/Scripts/python.exe modal
   ai-service/.venv/Scripts/modal setup
   ```
2. Simpan kunci layanan sebagai secret (nilai yang sama dipakai di Vercel):
   ```bash
   ai-service/.venv/Scripts/modal secret create tera-ai AI_SERVICE_KEY=<nilai acak panjang>
   ```
3. Deploy. Image dibangun dari `ai-service/requirements.txt`; bobot model (±0,8 GB) dimasukkan ke image saat build:
   ```bash
   ai-service/.venv/Scripts/modal deploy ai-service/modal_app.py
   ```
4. URL `https://<workspace>--tera-ai-web.modal.run` yang dicetak dipakai untuk `AI_SERVICE_URL`. Cek `<URL>/health`, lalu ukur latensinya:
   ```bash
   ai-service/.venv/Scripts/python scripts/benchmark_latency.py --url <URL> --key <AI_SERVICE_KEY>
   ```

Container dibatasi satu dan mati setelah 15 menit tanpa permintaan, jadi biaya hanya berjalan saat dipakai. Layar scan dan `/demo` memanggil `/api/ai/warm` saat dibuka untuk membangunkannya lebih awal.

## 4. Web di Vercel

1. Import repo ini, framework Next.js, isi environment variable, deploy.
2. Di Supabase → Authentication → URL Configuration, isi Site URL dengan domain Vercel.
3. Opsional: jadwalkan `POST /api/jobs/rematch` dengan header `Authorization: Bearer <JOBS_SECRET>`. Admin juga bisa menekan "Proses ulang sekarang" di `/admin`.

## 5. Menjaga layanan tetap aktif

- Proyek Supabase Free dijeda bila database tidak dipakai sekitar seminggu.
- AI service di Modal mati sendiri setelah 15 menit tanpa permintaan; permintaan pertama setelahnya menunggu container menyala. Layar scan dan `/demo` membangunkannya saat dibuka, dan aplikasi tetap menangani timeout 15 detik dengan "Catat tanpa verifikasi AI". Tidak perlu ping terjadwal ke AI service (itu hanya menghabiskan kredit).
- Ping terjadwal sekali sehari ke halaman yang membaca database menjaga Supabase tetap aktif.

## 6. Data demo

Isi `data/demo/<nama_anjing>/*.jpg` (minimal 2 foto per anjing, lisensi jelas), set environment ke nilai cloud, lalu jalankan `scripts/seed_demo.py`. Foto terakhir tiap anjing menjadi "foto uji". Foto demo bawaan (6 anjing DogFaceNet, CC BY 4.0) dipilih karena kecocokannya jelas; itu untuk menunjukkan alur, bukan bukti akurasi.

## 7. Sebelum dipakai publik

- **Lisensi MiewID**: bobot dan kode tidak mencantumkan lisensi (lihat [`AI.md`](AI.md#lisensi)). Perlu izin tertulis dari Conservation X Labs / Wild Me, atau ganti embedder di `ai-service/app/embedder.py` dengan model berlisensi jelas lalu jalankan ulang `scripts/eval.py` (dimensi embedding bisa berubah dan butuh migrasi `halfvec(N)` baru).
- **Panduan pertolongan pertama** (`content/first-aid.ts`): tinjau bersama tenaga kesehatan, lalu ubah `FIRST_AID_REVIEWED` menjadi `true`.
- **Daftar faskes**: isi di `/admin` hanya dari sumber resmi. Selama kosong, warga diarahkan ke puskesmas atau rumah sakit terdekat dan 119.
- **Atribusi DogFaceNet** tetap ditampilkan bila foto DogFaceNet dipakai di demo yang di-deploy.

## 8. Tag versi

Setelah deploy berjalan dan CI hijau:
```bash
git tag v1.0-submission
git push origin master --tags
```
