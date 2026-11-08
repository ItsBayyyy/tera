# MORNING_TODO — langkah untuk pemilik repo

Diurutkan dari yang paling mendesak. Semua kode sudah ada; yang tersisa butuh akun, keputusan, atau data milik Anda.

> **Perhatian sebelum publikasi:** lisensi bobot dan kode MiewID **tidak dinyatakan** oleh pembuatnya (lihat langkah 7). Tanpa izin tertulis, statusnya "all rights reserved". Kirim email ke Conservation X Labs / Wild Me secepatnya karena jawabannya bisa butuh beberapa hari.

## 1. Buat proyek Supabase cloud (gratis)

1. Buat proyek di supabase.com (region Singapore). Jangan masukkan kartu kredit.
2. Ekstensi pgvector dibuat oleh migrasi; tidak perlu dipasang manual.
3. Dari folder repo:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-proyek>
   npx supabase db push
   ```
   `supabase/seed.sql` **tidak** ikut ke cloud (hanya untuk lokal).
4. Buat akun admin pertama: Authentication → Users → Add user (email + password). Lalu di SQL Editor:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Nama Admin' where user_id = '<uuid user>';
   ```
   Petugas lain dibuat dengan cara yang sama (role default `officer`).
5. Ganti banjar contoh dengan banjar nyata (SQL Editor, tabel `banjars`); hapus atau biarkan baris `is_sample = true`.

## 2. Isi environment variable

- Next.js (Vercel → Settings → Environment Variables), lihat `.env.example`:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `AI_SERVICE_URL`, `AI_SERVICE_KEY`, `JOBS_SECRET`.
- AI service (HF Space → Settings → Variables and secrets), lihat `ai-service/.env.example`: minimal `AI_SERVICE_KEY` (sama dengan di Vercel).
- Buat nilai acak panjang untuk `AI_SERVICE_KEY` dan `JOBS_SECRET` (mis. `openssl rand -hex 32`).

## 3. Deploy

1. **Hugging Face Spaces** (AI service): buat Space tipe Docker (CPU basic, gratis), unggah isi `ai-service/` (Dockerfile + README dengan front-matter sudah ada). Catat URL `https://<user>-<space>.hf.space` → isi `AI_SERVICE_URL`. Space gratis tidur saat tidak dipakai; permintaan pertama bisa lambat (fallback "Catat tanpa verifikasi AI" menangani timeout 15 detik). Image Docker **belum pernah di-build** di mesin ini (bobot ±0,8 GB diunduh saat build); latensi di CPU Space gratis **belum diukur** — jalankan `scripts/benchmark_latency.py --url <URL Space> --key <AI_SERVICE_KEY>` dan catat hasilnya di `docs/AI.md`.
2. **Vercel** (Next.js): import repo, framework Next.js, isi env, deploy. Isi Site URL di Supabase → Authentication → URL Configuration dengan domain Vercel.
3. Opsional: jadwalkan `POST /api/jobs/rematch` dengan header `Authorization: Bearer <JOBS_SECRET>` (mis. cron-job.org gratis). Admin juga bisa menekan tombol "Proses ulang sekarang" di `/admin`.
4. Isi URL live di README.

## 4. Foto demo dan evaluasi

- Demo: isi `data/demo/<nama_anjing>/*.jpg` (≥2 foto per anjing, lisensi jelas atau foto milik tim), lalu jalankan `scripts/seed_demo.py` terhadap proyek cloud (set env ke nilai cloud). Foto terakhir tiap anjing menjadi "foto uji".
- Evaluasi: lihat `docs/EVALUATION.md` untuk cara menjalankan `scripts/eval.py` dan memperbarui ambang di `/admin`.
- Foto demo lokal saat ini (6 anjing DogFaceNet) **dipilih karena cocoknya jelas**; untuk presentasi sebutkan itu, atau ganti dengan foto anjing Bali.
- Idealnya kumpulkan foto anjing Bali nyata (beberapa foto per anjing, hari/sudut berbeda) dengan izin pemilik/petugas — data publik tidak mewakili anjing kampung Bali.

## 5. Tinjau konten pertolongan pertama

`content/first-aid.ts` (tanda `FIRST_AID_REVIEWED = false`) belum ditinjau tenaga kesehatan. Minta dokter/Rabies Center/Dinkes meninjau, perbaiki teks bila perlu, lalu ubah `FIRST_AID_REVIEWED` menjadi `true` (catatan "menunggu tinjauan" di halaman akan hilang).

## 6. Isi daftar faskes

Login sebagai admin → `/admin` → Fasilitas kesehatan. Isi hanya dari sumber resmi (Dinkes/situs faskes) dan cek nomornya. Selama kosong, warga diarahkan ke puskesmas/RS terdekat dan 119.

## 7. Verifikasi lisensi

- **MiewID (mendesak):** kartu HF `conservationxlabs/miewid-msv3` tanpa field lisensi dan tanpa file LICENSE; repo `WildMeOrg/wbia-plugin-miew-id` tanpa lisensi ("Copyright Conservation X Labs 2025"). Minta izin tertulis untuk pemakaian non-komersial di karya lomba, atau catat jawabannya di `docs/AI.md`. Bila ditolak: ganti embedder di `ai-service/app/embedder.py` dengan model berlisensi jelas lalu jalankan ulang `scripts/eval.py` (dimensi embedding bisa berubah → migrasi `halfvec(N)` baru).
- DogFaceNet (CC BY 4.0): bila foto DogFaceNet dipakai di demo yang di-deploy, tampilkan atribusi (Mougeot, Li, Jia, PRICAI 2019) di halaman `/demo` atau README.
- OWL-ViT (Apache-2.0) sudah jelas.

## 8. Lengkapi README

Isi placeholder: URL live, nama tim, versi yang dinilai.

## 9. Buat tag rilis

Setelah semua di atas beres dan CI hijau:
```bash
git tag v1.0-submission
git push origin master --tags
```
