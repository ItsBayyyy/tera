# AI & Technology Disclosure

Format mengikuti Lampiran C *Panduan Peserta AI Web Innovation Challenge Bali DigiFest 2026*. Isinya identik dengan Lampiran A proposal Tahap 1 (`docs/proposal/proposal.html`).

| Komponen | Isi |
|---|---|
| Nama Produk | Tera |
| Framework / Frontend | Next.js 16.4 (MIT), React 19 (MIT), Tailwind CSS 4 (MIT); PWA dengan service worker |
| Backend / Runtime | Next.js Route Handlers di Node.js 22 (TypeScript); AI service Python 3.11 dengan FastAPI (MIT) dan Uvicorn (BSD-3-Clause) |
| Database / Storage | Supabase: PostgreSQL + pgvector (PostgreSQL License), Auth, Storage privat, Realtime |
| Hosting / Deployment | Rencana: Vercel (web), Supabase cloud (database), Hugging Face Spaces CPU (AI service). Semua tier gratis. |
| AI Model / API / Method | (1) Quality gate OpenCV (Apache-2.0); (2) deteksi OWL-ViT base-patch32, `google/owlvit-base-patch32` (Apache-2.0); (3) embedding re-identifikasi MiewID msv3, `conservationxlabs/miewid-msv3` (**lisensi tidak dinyatakan pembuat; izin tertulis belum diperoleh**), dimuat dengan timm (Apache-2.0); (4) pencocokan cosine similarity pgvector di fungsi SQL `match_dogs()`. Semua inferensi di AI service milik sendiri. Tidak ada LLM dan tidak ada API AI pihak ketiga. |
| Peran AI dalam Produk | Mengenali individu anjing dari foto: memeriksa kualitas foto, mendeteksi anjing dan wajahnya, membuat vektor identitas, lalu mencari anjing terdaftar yang paling mirip di banjar yang sama. Hasil ditampilkan dalam tiga zona; keputusan akhir selalu dikonfirmasi petugas. Pada laporan warga, AI hanya memberi saran kandidat anjing untuk petugas. |
| Dataset / Data Source | DogFaceNet (Mougeot, Li, Jia, PRICAI 2019; CC BY 4.0; zenodo.org/records/12578449) untuk evaluasi dan data demo; foto Wikimedia Commons (CC0/domain publik) untuk kalibrasi dan test; gambar sintetis untuk e2e. Tidak ada data pribadi yang dipakai untuk pelatihan. Statistik rabies dari media yang dikutip di Lampiran B. |
| Open-source Libraries | @supabase/ssr, @supabase/supabase-js, zod (MIT), lucide-react (ISC); PyTorch, torchvision (BSD-3-Clause), transformers, timm, safetensors, huggingface-hub (Apache-2.0), opencv-python-headless (Apache-2.0), Pillow (MIT-CMU), NumPy (BSD-3-Clause), python-multipart (Apache-2.0), tokenizers (Apache-2.0), Starlette (BSD-3-Clause); untuk pengujian: Vitest (MIT), Playwright (Apache-2.0), pytest (MIT) |
| Template / Boilerplate | `create-next-app` (commit awal repo "Initial commit from Create Next App") |
| AI Coding Assistant | Claude Code (Anthropic) dipakai untuk menulis kode, migrasi database, test, dokumentasi, dan draf proposal ini. Tim meninjau, menjalankan, dan bertanggung jawab atas hasilnya; keputusan desain dicatat di `docs/DECISIONS.md`. |
| Pre-existing Components | Konsep Mode Warga (panduan pertolongan pertama darurat, tombol telepon darurat, ringkasan kasus untuk petugas) dikembangkan dari karya tim sebelumnya, Vishara (FIT Competition 2026); implementasinya ditulis baru. Inti AI re-identifikasi, Mode Petugas, dasbor admin, dan mode demo dikembangkan baru untuk lomba ini. |
| Third-party Assets / Credits | Font Plus Jakarta Sans (SIL OFL 1.1); ikon lucide-react (ISC); foto DogFaceNet (CC BY 4.0) di mode demo; foto Wikimedia Commons (domain publik): *Kintamani dog white* dan *Street dog-Gianyar Bali-2009* (Imk0278; Jack Merridew). Logo Tera dibuat untuk proyek ini. |
| Layanan pihak ketiga | Supabase (data operasional), Vercel (lalu lintas web), Hugging Face Spaces (menjalankan AI service milik sendiri; foto diproses di memori dan tidak disimpan), Hugging Face Hub (mengunduh bobot model saat build; tanpa data pengguna). |

**Pernyataan:** Kami menyatakan bahwa informasi di atas benar dan lengkap. Kami bertanggung jawab atas penggunaan teknologi, source code, data, library, API, model AI, dan aset yang digunakan pada produk.
