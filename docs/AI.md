# AI di Tera

AI produk = **computer vision** di layanan milik sendiri (`ai-service/`, FastAPI, CPU). Tidak ada LLM dan tidak ada API AI pihak ketiga. Detail teknis lengkap (kalibrasi, cara menjalankan, Docker) ada di [`ai-service/README.md`](../ai-service/README.md); hasil evaluasi di [`EVALUATION.md`](EVALUATION.md). Semua angka di bawah diukur di repo ini pada 8 Nov 2026 (laptop Intel Core generasi 11, 12 thread, CPU saja, torch 6 thread).

## Pipeline `POST /v1/analyze`

| # | Tahap | Implementasi | Keluaran |
|---|---|---|---|
| 1 | Decode + resize | Pillow, sisi terpanjang ≤1024 px (foto dari PWA sudah dikompres di perangkat) | — |
| 2 | Quality gate | OpenCV: variance of Laplacian pada crop kepala (256 px), rata-rata kecerahan, resolusi minimum | `BLUR`, `TOO_DARK`, `TOO_BRIGHT`, `TOO_SMALL` |
| 3 | Deteksi | **OWL-ViT base-patch32** (`google/owlvit-base-patch32`, revisi dipatok `cbc355fb…`), dua kueri dalam satu forward pass: "a photo of a dog" dan "a photo of a dog's face" | `NO_DOG`, `FACE_NOT_VISIBLE`, kotak wajah/kepala |
| 4 | Embedding | **MiewID msv3** (`conservationxlabs/miewid-msv3`, revisi `4f1d7f2b…`): EfficientNetV2-RW-M + GeM, input 440×440, normalisasi ImageNet | vektor **2152 dimensi**, float32, L2-normalized |
| 5 | Pencocokan | **Bukan di AI service.** `match_dogs()` di Postgres: cosine similarity `halfvec(2152)`, skor maksimum per anjing, top-5 | zona strong / unsure / none |

Model dimuat sekali saat startup. Service stateless: foto tidak ditulis ke disk dan tidak di-log.

**Catatan MiewID:** kode `trust_remote_code` milik checkpoint gagal di transformers 5.x, jadi `ai-service/app/embedder.py` membangun ulang jaringan yang sama (timm + GeM + BatchNorm1d) dan memuat safetensors dengan `strict=True`. Kesetaraan dicek terhadap kode resmi (transformers 4.46.3) pada 14 foto: cosine similarity terendah **1,000000** (`ai-service/tools/verify_miewid_equivalence.py`).

## Pemilihan detektor (diukur)

| Detektor | Deteksi p50 | Catatan |
|---|---|---|
| OWLv2 base-ensemble @960 | 5152 ms | Terlalu lambat untuk target p50 ≤3 s total |
| OWLv2 @480 | 1021 ms | Skor "dog" untuk monyet (0,248) di atas anjing jalanan asli (0,219): tidak ada ambang bersih |
| **OWL-ViT B/32 (dipakai)** | **571 ms** | Anjing 0,251–0,930; kucing 0,082; monyet 0,087; kopi ≤0,005 |
| OWL-ViT B/16 | tidak terukur | Gagal alokasi memori saat dimuat di laptop bersama |

Dampak ke re-ID (60 anjing acak, 301 foto): OWL-ViT B/32 rank-1 82,2% / TAR@FAR=1% 74,3% (p50 903 ms) vs OWLv2 @960 rank-1 73,8% / 68,9% (p50 5426 ms). Ekspor ONNX tidak dicoba: target latensi sudah terpenuhi tanpa menambah dependensi.

**Keterbatasan yang diketahui:** dengan B/32, kotak "dog's face" hampir selalu sama dengan kotak seluruh anjing. Pada foto seluruh badan, MiewID meng-embed seluruh anjing; pada foto close-up, kotaknya praktis kepala. Detektor wajah anjing khusus (lisensi permisif) adalah perbaikan dengan dampak terbesar: potongan wajah yang sudah disejajarkan mencapai rank-1 98,7% vs 60,2% pada foto mentah.

## Latensi `/v1/analyze` (CPU laptop)

| Pengukuran | N | p50 | p95 |
|---|---|---|---|
| HTTP end-to-end (run 1 / run 2) | 40 / 40 | 831 / 902 ms | 882 / 946 ms |
| In-process total | 40 | 876 ms | 905 ms |
| — deteksi | 40 | 572 ms | 594 ms |
| — embedding | 36 | 297 ms | 325 ms |
| Seluruh foto evaluasi DogFaceNet mentah | 1516 | 899 ms | 954 ms |

Target p50 ≤ 3 s terpenuhi. Latensi di HF Spaces CPU gratis **belum diukur**. Alat: `scripts/benchmark_latency.py`.

## Ambang kualitas (awal)

Dikalibrasi dari 298 foto nyata yang berisi anjing (DogFaceNet mentah + foto Commons) dan salinannya yang dirusak secara sintetis (`ai-service/tools/calibrate_quality.py`):

| Kode | Aturan | Dasar |
|---|---|---|
| `BLUR` | Laplacian var. < 20 | foto nyata p1 24,2; blur sintetis maks 16,5 |
| `TOO_DARK` / `TOO_BRIGHT` | rata-rata abu < 45 / > 215 | foto nyata 56,4–197,9 |
| `TOO_SMALL` | sisi pendek gambar < 224 px atau kotak kepala < 64 px | kotak kepala p1 76,8 px |
| `NO_DOG` | skor anjing < 0,15 | anjing p1 0,195; kucing/monyet ≤ 0,087 |
| `FACE_NOT_VISIBLE` | anjing ada, skor wajah < 0,02 | wajah p1 0,017 (~1–2% foto wajah-terlihat ikut ditolak) |

## Ambang pencocokan

Default di `app_config` (migrasi `20261108000400`): **`match_strong = 0,667`, `match_unsure = 0,39`**, rekomendasi `scripts/eval.py` pada foto mentah DogFaceNet. Masih **sementara**: data publik bukan anjing kampung Bali. Admin dapat mengubahnya di `/admin`.

## Hasil evaluasi (ringkas)

Lihat [`EVALUATION.md`](EVALUATION.md) untuk tabel lengkap. Hasil utama (foto mentah, pipeline penuh, 300 anjing / 1516 foto, split per anjing): **rank-1 60,2%, rank-5 72,4%, TAR@FAR=1% 62,8%**. Potongan wajah ter-align (139 anjing, split uji resmi): rank-1 98,7%. Peringatan: kartu model MiewID menyebut DogFaceNet sebagai sumber data anjingnya, jadi ada kemungkinan tumpang tindih data latih → hasil bisa terlalu optimistis. **Belum dievaluasi pada data lapangan Bali.**

## Lisensi

| Komponen | Lisensi | Sumber | Status |
|---|---|---|---|
| MiewID msv3 (bobot) | **Tidak dinyatakan** (tidak ada field lisensi di kartu HF, tidak ada file LICENSE) | https://huggingface.co/conservationxlabs/miewid-msv3 | ⚠ Belum pasti — lihat `MORNING_TODO.md` |
| MiewID (kode, wbia-plugin-miew-id) | **Tidak dinyatakan** (GitHub tidak mendeteksi lisensi; README: "Copyright Conservation X Labs 2025") | https://github.com/WildMeOrg/wbia-plugin-miew-id | ⚠ Belum pasti |
| OWL-ViT base-patch32 | Apache-2.0 | https://huggingface.co/google/owlvit-base-patch32 | OK |
| OWLv2 (dievaluasi, tidak dipakai) | Apache-2.0 | https://huggingface.co/google/owlv2-base-patch16-ensemble | — |
| timm (arsitektur) | Apache-2.0 | https://github.com/huggingface/pytorch-image-models | OK |
| DogFaceNet (evaluasi + foto demo lokal) | CC BY 4.0 (metadata rekaman Zenodo); kode MIT | https://zenodo.org/records/12578449 · https://github.com/GuillaumeMougeot/DogFaceNet | OK dengan atribusi: Mougeot, Li, Jia. *A Deep Learning Approach for Dog Face Verification and Recognition.* PRICAI 2019 |
| Foto sampel test (`data/samples/`, lokal) | CC0 / domain publik, per file di `data/samples/SOURCES.json` | Wikimedia Commons | OK |
| Plus Jakarta Sans | SIL OFL 1.1 | https://github.com/tokotype/PlusJakartaSans | OK |
| Foto e2e (`e2e/fixtures/`) | Gambar sintetis buatan skrip | — | OK |

Tanpa lisensi yang dinyatakan, secara default bobot dan kode MiewID berstatus "all rights reserved". Penggunaan di karya lomba non-komersial perlu dikonfirmasi ke Conservation X Labs / Wild Me sebelum dipublikasikan.

## Data demo

`data/demo/` (lokal, tidak di-commit) berisi 6 anjing DogFaceNet × 3 foto, **dipilih karena kecocokannya jelas** (kemiripan dalam-anjing ≥ 0,668, lintas-anjing ≤ 0,213). Ini untuk demonstrasi alur, bukan bukti akurasi. Saat diuji dengan AI asli, keenam foto uji dikenali di zona kuat (skor 0,69–0,91; kandidat kedua ≤ 0,20) dan foto kucing ditolak `NO_DOG`.
