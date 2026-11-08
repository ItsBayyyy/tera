# Ketentuan proposal dari panduan resmi

Sumber: *Panduan Peserta AI Web Innovation Challenge Bali DigiFest 2026* (PDF 13 halaman, file `Panduan_Peserta_AI_Web_Innovation_Challenge_Bali_DigiFest_2026 (1).pdf` milik pemilik repo, di luar repo). Nomor halaman mengikuti footer "Halaman N" di panduan.

## Yang diikuti

| Ketentuan | Halaman | Penerapan di proposal |
|---|---|---|
| Tahap 1 wajib 4 komponen: proposal, repository GitHub, URL MVP aktif, AI & Technology Disclosure | 5 | Proposal ini; tautan di bagian 10; disclosure di Lampiran A |
| Proposal maksimal **5 halaman isi di luar cover dan lampiran** | 5 | Cover + 5 halaman isi + lampiran |
| Format: **PDF, A4**, Bahasa Indonesia atau Inggris, tidak diproteksi password, teks/diagram terbaca jelas | 5 | PDF A4 dari HTML via Playwright, Bahasa Indonesia, tanpa password, diagram SVG vektor |
| Rekomendasi nama file `AIWIC2026_NamaTim_NamaProduk.pdf` | 5 | `AIWIC2026_MadeBayuArdanaPutra_Tera.pdf`; peserta individu, jadi posisi nama tim diisi nama peserta |
| Cover: nama produk, nama tim, anggota, asal instansi bila ada; template Lampiran A menambah kontak ketua tim | 5, 11 | Peserta individu: cover memuat nama peserta, institusi, kontak peserta (placeholder), URL, dan tag |
| Urutan bagian: 1 Problem & Background, 2 Target User, 3 Proposed Solution, 4 AI Implementation, 5 MVP & Key Features, 6 Technical Architecture, 7 Innovation & Differentiation, 8 Impact & Development Potential, 9 Technology Disclosure, 10 Submission Links | 5, 11–12 | Diikuti persis. Urutan ini menggantikan susunan "per halaman" di `PROPOSAL_PROMPT.md` |
| "Desain proposal boleh disesuaikan selama seluruh substansi tersedia dan batas halaman dipatuhi" | 11 | Desain mengikuti aplikasi (Plus Jakarta Sans, satu warna aksen) |
| Bagian 5: daftar fitur yang sudah berfungsi; **pisahkan core feature dan fitur tambahan** | 11 | Tabel fitur dengan kolom jenis (inti/tambahan) dan bukti |
| Bagian 6: diagram sederhana User → Frontend → Backend → Database → AI/API → Result | 5, 11 | Diagram SVG mengikuti urutan ini |
| Bagian 8: manfaat, peluang pengembangan, scalability, **keterbatasan MVP** | 5, 12 | Termasuk tabel risiko dan keterbatasan |
| Bagian 9: framework, database, model/API AI, library, dataset, hosting, AI coding assistant, third-party resources | 5, 12 | Ringkas di bagian 9, lengkap di Lampiran A |
| Bagian 10: GitHub, deployment URL, demo account bila diperlukan, commit hash/release tag | 5, 12 | URL masih placeholder; tag `v1.0-submission`; akun demo hanya disebut ada, kredensial lewat kanal panitia |
| Penggunaan AI coding assistant wajib diungkapkan | 4 | Disebut di bagian 9 dan Lampiran A |
| Kredensial demo dikirim lewat kanal/form panitia, **bukan** repository publik | 6 | Proposal tidak memuat kata sandi |
| Version locking: tag `v1.0-submission` untuk Tahap 1 | 6 | Tag `v1.0-submission` di cover dan bagian 10 (tag Git dibuat pemilik repo) |
| Pre-existing project wajib diungkapkan: bagian yang sudah ada dan yang dikembangkan untuk lomba | 6 | Asal konsep Mode Warga (Vishara) dan template `create-next-app` disebut |
| Rubrik Tahap 1: Problem 20%, Innovation 15%, AI 25%, MVP 20%, Technical & Repo 15%, Compliance 5% | 7 | Porsi halaman terbesar untuk AI dan MVP |
| Resources pihak ketiga yang material wajib dicantumkan pada disclosure/credits | 10 | Lampiran A memuat model, dataset, foto, font, layanan beserta lisensi |
| Produk dengan rekomendasi berisiko tinggi harus memberi batasan/disclaimer yang wajar | 10 | Bagian 3 dan 8: status vaksin tidak ditampilkan ke warga, keputusan medis pada tenaga kesehatan |
| Lampiran C: tabel disclosure (Nama Produk, Framework/Frontend, Backend/Runtime, Database/Storage, Hosting, AI Model/API/Method, Peran AI, Dataset, Open-source Libraries, Template/Boilerplate, AI Coding Assistant, Pre-existing Components, Third-party Assets/Credits) + kalimat pernyataan | 12–13 | Lampiran A proposal, isinya identik dengan `AI_DISCLOSURE.md` |

## Yang tidak diatur panduan (asumsi)

| Hal | Asumsi |
|---|---|
| Font, ukuran huruf, margin, spasi | Tidak diatur. Dipakai Plus Jakarta Sans 10,5 pt, margin 16–18 mm |
| Batas ukuran file | Tidak diatur. Target < 5 MB |
| Letak daftar referensi | Tidak diatur. Ditaruh di lampiran agar tidak memakan halaman isi |
| Nomor halaman | Tidak diatur. Halaman isi diberi nomor 1–5; cover dan lampiran tidak dihitung |
