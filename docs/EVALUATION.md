# Evaluasi AI — re-identifikasi anjing

> Dokumen ini dibuat otomatis oleh `scripts/eval.py` dari hasil yang benar-benar diukur
> (`data/eval_results/*.json`). Jangan mengedit angka secara manual.

**Status:** dievaluasi pada dataset publik (lihat tabel). **Belum dievaluasi pada data lapangan Bali**;
angka di bawah tidak boleh dikutip sebagai akurasi di lapangan.

## dogfacenet-aligned-pipeline

- Diukur: 2026-11-07 18:53 UTC · mode `pipeline` · model `owlvit-base-patch32+miewid-msv3`
- Dataset: `data/eval_aligned` — 139 anjing, 697 foto (DogFaceNet, DogFaceNet_224resized official test split: 139 identities; sumber https://zenodo.org/records/12578449; lisensi cc-by-4.0 (as stated on the Zenodo record metadata))
- Foto lolos pipeline: 597 dari 697; ditolak per alasan pertama: `BLUR` 63, `FACE_NOT_VISIBLE` 10, `NO_DOG` 11, `TOO_DARK` 10, `TOO_SMALL` 6
- Pembersihan label: 0 folder digabung karena berisi foto (hampir) identik dengan folder lain (anjing yang sama tercatat dua kali), 2 foto duplikat dalam satu anjing dibuang (kosinus >= 0.97)
- Split (seed 0): 94 anjing terdaftar (175 foto galeri, maks. 2/anjing; 223 probe), 41 anjing tak terdaftar (194 probe); 3 anjing terdaftar dibuang karena < 2 foto lolos
- Perangkat: Intel64 Family 6 Model 141 Stepping 1, GenuineIntel, 12 logical CPUs, torch 2.15.0+cpu threads=6, CPU only

| Metrik | Nilai |
|---|---|
| Rank-1 | 98.7% |
| Rank-5 | 100.0% |
| TAR@FAR=1% | 99.1% (ambang 0.312) |
| Rekomendasi `match_strong` | 0.478 |
| Rekomendasi `match_unsure` | 0.435 |
| Probe terdaftar di zona strong & benar / salah | 92.8% / 0.4% |
| Probe terdaftar yang skor anjing aslinya >= `match_unsure` | 95.1% |
| Anjing tak terdaftar ditolak pada `match_unsure` (zona none) | 94.8% |
| Anjing tak terdaftar tidak masuk zona strong | 99.5% |
| Median skor anjing asli / skor teratas anjing tak terdaftar | 0.684 / 0.330 |
| Latensi per foto p50 / p95 (semua foto, n=697) | 888 / 933 ms |
| Latensi per foto lolos p50 / p95 (n=597) | 893 / 936 ms |
| Tahap `decode` p50 / p95 (n=697) | 1 / 1 ms |
| Tahap `quality` p50 / p95 (n=697) | 0 / 0 ms |
| Tahap `detect` p50 / p95 (n=687) | 591 / 618 ms |
| Tahap `embed` p50 / p95 (n=597) | 300 / 327 ms |

Pengaruh satu ambang (probe terdaftar dijawab benar / salah pada skor >= ambang; probe anjing tak terdaftar yang lolos ambang):

| Ambang | Terdaftar benar | Terdaftar salah | Tak terdaftar lolos |
|---|---|---|---|
| 0.30 | 98.7% | 0.9% | 65.5% |
| 0.35 | 97.8% | 0.9% | 40.7% |
| 0.40 | 96.4% | 0.9% | 16.0% |
| 0.45 | 94.2% | 0.4% | 3.6% |
| 0.50 | 90.6% | 0.4% | 0.5% |
| 0.55 | 83.4% | 0.0% | 0.0% |
| 0.60 | 71.7% | 0.0% | 0.0% |
| 0.65 | 61.4% | 0.0% | 0.0% |
| 0.70 | 43.0% | 0.0% | 0.0% |
| 0.75 | 26.5% | 0.0% | 0.0% |
| 0.80 | 13.5% | 0.0% | 0.0% |

Catatan: Potongan wajah DogFaceNet 224x224 yang sudah disejajarkan, split uji resmi (139 anjing). Bukan kondisi lapangan: wajah sudah dipotong rapi. Kemungkinan besar terlalu optimistis.

## dogfacenet-raw-pipeline

- Diukur: 2026-11-07 18:52 UTC · mode `pipeline` · model `owlvit-base-patch32+miewid-msv3`
- Dataset: `data/eval` — 300 anjing, 1516 foto (DogFaceNet, DogFaceNet_large: 300 random identities (seed 0) with 3-20 photos; sumber https://zenodo.org/records/12578449; lisensi cc-by-4.0 (as stated on the Zenodo record metadata))
- Foto lolos pipeline: 1403 dari 1516; ditolak per alasan pertama: `BLUR` 18, `FACE_NOT_VISIBLE` 21, `INVALID_IMAGE` 1, `NO_DOG` 4, `TOO_BRIGHT` 1, `TOO_SMALL` 68
- Pembersihan label: 5 folder digabung karena berisi foto (hampir) identik dengan folder lain (anjing yang sama tercatat dua kali), 16 foto duplikat dalam satu anjing dibuang (kosinus >= 0.97)
- Split (seed 0): 200 anjing terdaftar (390 foto galeri, maks. 2/anjing; 583 probe), 86 anjing tak terdaftar (412 probe); 2 anjing terdaftar dibuang karena < 2 foto lolos
- Perangkat: Intel64 Family 6 Model 141 Stepping 1, GenuineIntel, 12 logical CPUs, torch 2.15.0+cpu threads=6, CPU only

| Metrik | Nilai |
|---|---|
| Rank-1 | 60.2% |
| Rank-5 | 72.4% |
| TAR@FAR=1% | 62.8% (ambang 0.354) |
| Rekomendasi `match_strong` | 0.667 |
| Rekomendasi `match_unsure` | 0.390 |
| Probe terdaftar di zona strong & benar / salah | 14.4% / 0.0% |
| Probe terdaftar yang skor anjing aslinya >= `match_unsure` | 56.6% |
| Anjing tak terdaftar ditolak pada `match_unsure` (zona none) | 56.6% |
| Anjing tak terdaftar tidak masuk zona strong | 100.0% |
| Median skor anjing asli / skor teratas anjing tak terdaftar | 0.431 / 0.381 |
| Latensi per foto p50 / p95 (semua foto, n=1516) | 899 / 954 ms |
| Latensi per foto lolos p50 / p95 (n=1403) | 901 / 955 ms |
| Tahap `decode` p50 / p95 (n=1515) | 4 / 8 ms |
| Tahap `quality` p50 / p95 (n=1515) | 1 / 2 ms |
| Tahap `detect` p50 / p95 (n=1469) | 592 / 625 ms |
| Tahap `embed` p50 / p95 (n=1403) | 301 / 334 ms |

Pengaruh satu ambang (probe terdaftar dijawab benar / salah pada skor >= ambang; probe anjing tak terdaftar yang lolos ambang):

| Ambang | Terdaftar benar | Terdaftar salah | Tak terdaftar lolos |
|---|---|---|---|
| 0.30 | 59.7% | 35.8% | 93.0% |
| 0.35 | 57.6% | 28.3% | 69.9% |
| 0.40 | 52.7% | 14.4% | 36.4% |
| 0.45 | 46.5% | 6.0% | 14.3% |
| 0.50 | 37.9% | 2.4% | 4.4% |
| 0.55 | 30.7% | 0.9% | 1.9% |
| 0.60 | 21.6% | 0.3% | 0.5% |
| 0.65 | 16.6% | 0.0% | 0.5% |
| 0.70 | 10.6% | 0.0% | 0.0% |
| 0.75 | 6.0% | 0.0% | 0.0% |
| 0.80 | 2.9% | 0.0% | 0.0% |

Catatan: Foto mentah DogFaceNet_large (foto penampungan/adopsi, campuran wajah dan seluruh badan, banyak ras campuran). Belum tentu terpisah dari data latih MiewID; lihat ai-service/README.md.

## dogfacenet-raw-whole-image

- Diukur: 2026-11-07 18:54 UTC · mode `whole-image` · model `miewid-msv3 (seluruh gambar)`
- Dataset: `data/eval` — 300 anjing, 1516 foto (DogFaceNet, DogFaceNet_large: 300 random identities (seed 0) with 3-20 photos; sumber https://zenodo.org/records/12578449; lisensi cc-by-4.0 (as stated on the Zenodo record metadata))
- Foto lolos pipeline: 1515 dari 1516; ditolak per alasan pertama: `INVALID_IMAGE` 1
- Pembersihan label: 5 folder digabung karena berisi foto (hampir) identik dengan folder lain (anjing yang sama tercatat dua kali), 18 foto duplikat dalam satu anjing dibuang (kosinus >= 0.97)
- Split (seed 0): 207 anjing terdaftar (414 foto galeri, maks. 2/anjing; 621 probe), 88 anjing tak terdaftar (462 probe); 0 anjing terdaftar dibuang karena < 2 foto lolos
- Perangkat: Intel64 Family 6 Model 141 Stepping 1, GenuineIntel, 12 logical CPUs, torch 2.15.0+cpu threads=6, CPU only

| Metrik | Nilai |
|---|---|
| Rank-1 | 58.3% |
| Rank-5 | 75.4% |
| TAR@FAR=1% | 65.7% (ambang 0.356) |
| Rekomendasi `match_strong` | - |
| Rekomendasi `match_unsure` | 0.389 |
| Probe terdaftar di zona strong & benar / salah | - / - |
| Probe terdaftar yang skor anjing aslinya >= `match_unsure` | 59.1% |
| Anjing tak terdaftar ditolak pada `match_unsure` (zona none) | 59.1% |
| Anjing tak terdaftar tidak masuk zona strong | - |
| Median skor anjing asli / skor teratas anjing tak terdaftar | 0.438 / 0.374 |
| Latensi per foto p50 / p95 (semua foto, n=1516) | 309 / 339 ms |
| Latensi per foto lolos p50 / p95 (n=1515) | 309 / 339 ms |

Pengaruh satu ambang (probe terdaftar dijawab benar / salah pada skor >= ambang; probe anjing tak terdaftar yang lolos ambang):

| Ambang | Terdaftar benar | Terdaftar salah | Tak terdaftar lolos |
|---|---|---|---|
| 0.30 | 57.6% | 40.1% | 93.9% |
| 0.35 | 56.8% | 31.9% | 68.8% |
| 0.40 | 52.2% | 17.9% | 35.9% |
| 0.45 | 46.2% | 9.0% | 13.4% |
| 0.50 | 37.7% | 3.4% | 6.3% |
| 0.55 | 28.7% | 1.8% | 2.8% |
| 0.60 | 21.4% | 1.1% | 1.3% |
| 0.65 | 15.1% | 1.0% | 0.4% |
| 0.70 | 10.0% | 1.0% | 0.4% |
| 0.75 | 6.1% | 1.0% | 0.4% |
| 0.80 | 4.2% | 1.0% | 0.4% |

Catatan: Ablasi: seluruh gambar langsung ke MiewID tanpa quality gate dan detektor; data dan seed sama dengan dogfacenet-raw-pipeline, tetapi tidak ada foto yang ditolak sehingga split anjingnya tidak identik.

## zz-detector-compare-60dogs-owlv2-960

- Diukur: 2026-11-07 19:31 UTC · mode `pipeline` · model `owlv2-base-patch16-ensemble+miewid-msv3`
- Dataset: `data/eval` — 60 anjing, 301 foto (DogFaceNet, DogFaceNet_large: 300 random identities (seed 0) with 3-20 photos; sumber https://zenodo.org/records/12578449; lisensi cc-by-4.0 (as stated on the Zenodo record metadata))
- Foto lolos pipeline: 282 dari 301; ditolak per alasan pertama: `BLUR` 1, `FACE_NOT_VISIBLE` 1, `TOO_SMALL` 17
- Pembersihan label: 0 folder digabung karena berisi foto (hampir) identik dengan folder lain (anjing yang sama tercatat dua kali), 2 foto duplikat dalam satu anjing dibuang (kosinus >= 0.97)
- Split (seed 0): 41 anjing terdaftar (82 foto galeri, maks. 2/anjing; 103 probe), 17 anjing tak terdaftar (95 probe); 0 anjing terdaftar dibuang karena < 2 foto lolos
- Perangkat: Intel64 Family 6 Model 141 Stepping 1, GenuineIntel, 12 logical CPUs, torch 2.15.0+cpu threads=6, CPU only

| Metrik | Nilai |
|---|---|
| Rank-1 | 73.8% |
| Rank-5 | 85.4% |
| TAR@FAR=1% | 68.9% (ambang 0.348) |
| Rekomendasi `match_strong` | 0.592 |
| Rekomendasi `match_unsure` | 0.338 |
| Probe terdaftar di zona strong & benar / salah | 34.0% / 0.0% |
| Probe terdaftar yang skor anjing aslinya >= `match_unsure` | 69.9% |
| Anjing tak terdaftar ditolak pada `match_unsure` (zona none) | 69.5% |
| Anjing tak terdaftar tidak masuk zona strong | 100.0% |
| Median skor anjing asli / skor teratas anjing tak terdaftar | 0.472 / 0.310 |
| Latensi per foto p50 / p95 (semua foto, n=301) | 5426 / 5561 ms |
| Latensi per foto lolos p50 / p95 (n=282) | 5431 / 5565 ms |
| Tahap `decode` p50 / p95 (n=301) | 4 / 8 ms |
| Tahap `quality` p50 / p95 (n=301) | 1 / 2 ms |
| Tahap `detect` p50 / p95 (n=289) | 5117 / 5240 ms |
| Tahap `embed` p50 / p95 (n=282) | 302 / 329 ms |

Pengaruh satu ambang (probe terdaftar dijawab benar / salah pada skor >= ambang; probe anjing tak terdaftar yang lolos ambang):

| Ambang | Terdaftar benar | Terdaftar salah | Tak terdaftar lolos |
|---|---|---|---|
| 0.30 | 72.8% | 12.6% | 56.8% |
| 0.35 | 68.0% | 6.8% | 26.3% |
| 0.40 | 61.2% | 5.8% | 7.4% |
| 0.45 | 54.4% | 1.9% | 1.1% |
| 0.50 | 43.7% | 0.0% | 1.1% |
| 0.55 | 37.9% | 0.0% | 1.1% |
| 0.60 | 33.0% | 0.0% | 0.0% |
| 0.65 | 19.4% | 0.0% | 0.0% |
| 0.70 | 16.5% | 0.0% | 0.0% |
| 0.75 | 10.7% | 0.0% | 0.0% |
| 0.80 | 5.8% | 0.0% | 0.0% |

Catatan: Perbandingan detektor pada 60 anjing yang sama: OWLv2 base-patch16-ensemble pada resolusi asli 960 px, ambang sama (dog 0.15, face 0.02). Tidak dipakai di produksi karena latensi deteksi ~5 detik di CPU.

## zz-detector-compare-60dogs-owlvit-b32

- Diukur: 2026-11-07 19:04 UTC · mode `pipeline` · model `owlvit-base-patch32+miewid-msv3`
- Dataset: `data/eval` — 60 anjing, 301 foto (DogFaceNet, DogFaceNet_large: 300 random identities (seed 0) with 3-20 photos; sumber https://zenodo.org/records/12578449; lisensi cc-by-4.0 (as stated on the Zenodo record metadata))
- Foto lolos pipeline: 278 dari 301; ditolak per alasan pertama: `BLUR` 2, `FACE_NOT_VISIBLE` 6, `NO_DOG` 1, `TOO_SMALL` 14
- Pembersihan label: 0 folder digabung karena berisi foto (hampir) identik dengan folder lain (anjing yang sama tercatat dua kali), 2 foto duplikat dalam satu anjing dibuang (kosinus >= 0.97)
- Split (seed 0): 41 anjing terdaftar (80 foto galeri, maks. 2/anjing; 101 probe), 17 anjing tak terdaftar (95 probe); 0 anjing terdaftar dibuang karena < 2 foto lolos
- Perangkat: Intel64 Family 6 Model 141 Stepping 1, GenuineIntel, 12 logical CPUs, torch 2.15.0+cpu threads=6, CPU only

| Metrik | Nilai |
|---|---|
| Rank-1 | 82.2% |
| Rank-5 | 94.1% |
| TAR@FAR=1% | 74.3% (ambang 0.355) |
| Rekomendasi `match_strong` | 0.575 |
| Rekomendasi `match_unsure` | 0.358 |
| Probe terdaftar di zona strong & benar / salah | 35.6% / 0.0% |
| Probe terdaftar yang skor anjing aslinya >= `match_unsure` | 74.3% |
| Anjing tak terdaftar ditolak pada `match_unsure` (zona none) | 74.7% |
| Anjing tak terdaftar tidak masuk zona strong | 100.0% |
| Median skor anjing asli / skor teratas anjing tak terdaftar | 0.480 / 0.306 |
| Latensi per foto p50 / p95 (semua foto, n=301) | 902 / 969 ms |
| Latensi per foto lolos p50 / p95 (n=278) | 904 / 970 ms |
| Tahap `decode` p50 / p95 (n=301) | 4 / 8 ms |
| Tahap `quality` p50 / p95 (n=301) | 1 / 2 ms |
| Tahap `detect` p50 / p95 (n=289) | 594 / 634 ms |
| Tahap `embed` p50 / p95 (n=278) | 302 / 337 ms |

Pengaruh satu ambang (probe terdaftar dijawab benar / salah pada skor >= ambang; probe anjing tak terdaftar yang lolos ambang):

| Ambang | Terdaftar benar | Terdaftar salah | Tak terdaftar lolos |
|---|---|---|---|
| 0.30 | 80.2% | 10.9% | 56.8% |
| 0.35 | 72.3% | 6.9% | 29.5% |
| 0.40 | 63.4% | 2.0% | 10.5% |
| 0.45 | 54.5% | 2.0% | 2.1% |
| 0.50 | 41.6% | 1.0% | 1.1% |
| 0.55 | 37.6% | 0.0% | 1.1% |
| 0.60 | 30.7% | 0.0% | 0.0% |
| 0.65 | 18.8% | 0.0% | 0.0% |
| 0.70 | 12.9% | 0.0% | 0.0% |
| 0.75 | 9.9% | 0.0% | 0.0% |
| 0.80 | 5.0% | 0.0% | 0.0% |

Catatan: Perbandingan detektor pada 60 anjing acak dari data/eval (seed 1): detektor produksi OWL-ViT B/32. Bandingkan dengan zz-detector-compare-60dogs-owlv2-960.

## Cara menjalankan

1. Siapkan foto: `data/eval/<id_anjing>/*.jpg` (minimal 2 foto per anjing; folder `data/` di-gitignore).
   Untuk DogFaceNet: unduh dari https://zenodo.org/records/12578449 lalu jalankan
   `ai-service/tools/prepare_dogfacenet.py` (lihat docstring-nya).
2. Siapkan venv layanan AI (lihat `ai-service/README.md`).
3. Dari root repo:

```bash
ai-service/.venv/Scripts/python scripts/eval.py                      # data/eval, pipeline lengkap
ai-service/.venv/Scripts/python scripts/eval.py --data-dir data/eval_aligned --name dogfacenet-aligned
ai-service/.venv/Scripts/python scripts/eval.py --mode whole-image   # ablasi tanpa quality gate/detektor
ai-service/.venv/Scripts/python -m pytest scripts/tests               # uji fungsi metrik
```

## Definisi

- **Pembagian per individu anjing** (bukan per foto): sebagian anjing *terdaftar* (foto galeri + foto probe),
  sisanya *tak terdaftar* (semua fotonya jadi probe open-set). Seed tetap, jadi hasil dapat diulang.
- **Skor anjing** = kemiripan kosinus maksimum antara foto probe dan semua foto galeri anjing itu
  (sama dengan `match_dogs()` di Postgres).
- **Rank-1 / Rank-5**: probe dari anjing terdaftar yang anjing aslinya ada di urutan 1 / 5 besar.
- **TAR@FAR=1%**: proporsi pasangan asli (probe, anjingnya) yang diterima pada ambang yang hanya
  meloloskan 1% pasangan palsu (probe, anjing lain) — termasuk semua pasangan dari anjing tak terdaftar.
- **match_strong**: ambang terendah sehingga dari semua probe yang skor teratasnya >= ambang, paling banyak
  1% menunjuk anjing yang salah (probe anjing tak terdaftar selalu dihitung salah).
- **match_unsure**: titik *equal error*: proporsi probe terdaftar yang skor anjing aslinya < ambang
  sama dengan proporsi probe anjing tak terdaftar yang skor teratasnya >= ambang (maks. sama dengan match_strong).
  Ambang strong yang hanya mencakup < 20 probe diabaikan; jika tidak ada ambang yang memenuhi, ditulis `-`.
- **Pembersihan label**: foto dengan kosinus >= 0.97 dianggap gambar yang sama (bukan pengambilan baru). Folder yang berbagi foto seperti itu digabung, duplikat dalam satu anjing disimpan sekali.
- **Penolakan anjing tak terdaftar**: proporsi probe anjing tak terdaftar yang skor teratasnya di bawah ambang
  (di bawah match_unsure = zona *none*, aplikasi menawarkan pendaftaran anjing baru).
- **Latensi** diukur in-process (decode → kualitas → deteksi → embedding), tanpa overhead HTTP;
  lihat `scripts/benchmark_latency.py` untuk latensi lewat HTTP.
