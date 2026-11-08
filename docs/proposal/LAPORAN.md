# Laporan pembuatan proposal Tahap 1

Dibuat 8 Nov 2026 dari `PROPOSAL_PROMPT.md`.

## Hasil

| Hal | Nilai |
|---|---|
| File | `docs/proposal/AIWIC2026_MadeBayuArdanaPutra_Tera.pdf` |
| Halaman | 8 total: **cover 1 / isi 5 / lampiran 2** (Lampiran A disclosure, Lampiran B referensi) |
| Ukuran | 967 KB, A4 (209,9 × 297 mm), tidak diproteksi password |
| Font | Plus Jakarta Sans Regular, Medium, SemiBold, Bold, ExtraBold, semuanya ter-embed sebagai subset TrueType; tidak ada font lain |
| Sumber | `docs/proposal/proposal.html` + `proposal.css`, dirender dengan `npm run proposal` (`scripts/build-proposal.mjs`, Playwright Chromium) |

Diperiksa secara programatik: jumlah halaman, ukuran halaman, font ter-embed, placeholder (pypdf); setiap halaman dirender ke PNG (pypdfium2) dan ditinjau satu per satu (tidak ada teks terpotong, tabel pecah, gambar buram, atau halaman yang luber). Skrip build gagal bila ada halaman yang isinya meluber atau halaman isi lebih dari 5.

## Ketentuan yang diikuti

Panduan resmi ditemukan (di luar repo, PDF milik pemilik). Ketentuan beserta nomor halamannya dicatat di [`KETENTUAN.md`](KETENTUAN.md). Yang paling menentukan:

- Maksimal 5 halaman isi di luar cover dan lampiran; PDF A4; Bahasa Indonesia; tidak diproteksi (hal. 5).
- **Urutan 10 bagian mengikuti panduan** (hal. 5, 11–12). Ini menggantikan susunan "halaman 1 = masalah, halaman 2 = pembeda, ..." di `PROPOSAL_PROMPT.md`; isi yang diminta prompt tetap ada, hanya posisinya mengikuti urutan panduan (mis. tabel pembanding ada di bagian 7, bukan halaman 2).
- Nama file mengikuti rekomendasi panduan `AIWIC2026_NamaTim_NamaProduk.pdf` (hal. 5), bukan `KenalAsu_Proposal_Tahap1.pdf` dari prompt; karena peserta individu, posisi nama tim diisi nama peserta.
- Disclosure memakai tabel Lampiran C + kalimat pernyataan (hal. 12–13).
- Kredensial demo tidak dicantumkan; disebut dikirim lewat kanal panitia (hal. 6).

Asumsi karena panduan tidak mengatur: font Plus Jakarta Sans 10,5 pt untuk teks isi (tabel 8,8 pt), margin 15–16 mm, target ukuran < 5 MB, referensi di lampiran.

**Nama produk:** prompt menyebut "KenalAsu", tetapi aplikasi sudah diganti nama menjadi **Tera** (lihat `docs/DECISIONS.md` D24). Proposal memakai Tera.

## Placeholder yang harus diisi pemilik

Ditandai sorotan kuning di PDF (5 kemunculan, 3 jenis):

| Placeholder | Letak |
|---|---|
| `[ISI: email dan nomor HP peserta]` | Cover |
| `[ISI: URL website live]` | Cover, bagian 10 |
| `[ISI: URL repository GitHub]` | Cover, bagian 10 |

Data peserta sudah diisi (pembaruan 8 Nov 2026): peserta individu **Made Bayu Ardana Putra**, **Universitas Primakara**, kategori **Mahasiswa/Umum**, versi dinilai tag **`v1.0-submission`** (tag Git dibuat pemilik repo, bukan oleh skrip). Placeholder commit hash dihapus karena panduan (hal. 6) menerima commit hash *atau* release/tag. Istilah "tim/anggota/ketua" yang merujuk ke peserta diganti "peserta/pengembang", dan kalimat pernyataan disclosure memakai "Saya". Yang tetap: "Tim Siaga Rabies desa" (nama satuan petugas) dan "karya tim sebelumnya, Vishara".

## Verifikasi sumber

| Angka / klaim | Status |
|---|---|
| 66.760 orang tergigit HPR, 16 meninggal karena tidak dibawa ke faskes (ANTARA Bali, 9 Jan 2026) | Dicek ke halaman sumber. **Koreksi:** sumber menyebut "hewan penular rabies", bukan khusus anjing; README ikut diperbaiki |
| 282.683 dari 570.976 (49,51%) per 17 Juli 2026; Satgas lewat Kepgub 697/03-F/HK/2026 (Bali Post, 20 Jul 2026) | Dicek |
| Foto ANTARA Bali 49,51% | Dicek; terbit 5 Sep 2026 |
| Sekitar 60% per 20 Sep, target 87% akhir 2026 (Bali Post, 21 Sep 2026) | Dicek. Target 87% ditulis sebagai narasi media tentang target pemprov, bukan kutipan langsung pejabat |
| Tabanan 56,02%, 12 desa zona merah (NusaBali, 4 Okt 2026) | Dicek |
| Czupryna dkk. 2023 (Tanzania) | Dicek. Prompt hanya menyebut 99,2% dan 76,2%; proposal menulis konteks lengkapnya: 99,2% pada data tersaring, 80,8% tanpa penyaringan, 76,2% sensitivitas aplikasi (keputusan operator), spesifisitas 98,9% |
| DITA PULANG Gianyar (Berita Bali) | **Tidak bisa diverifikasi:** situs mengembalikan HTTP 523 dua kali dan pencarian web tidak menemukan sumber lain. Proposal hanya menyebutnya sebagai contoh "pencatatan digital tanpa biometrik" sesuai deskripsi di prompt. **Cek ulang sebelum submit**; hapus baris itu bila tidak cocok |
| 154 ribu anjing | Dihitung: 87% − 60% dari 570.976 = 154.163 |
| Semua angka evaluasi, latensi, ambang | Dari `docs/EVALUATION.md` dan `docs/AI.md` (hasil `scripts/eval.py` dan `scripts/benchmark_latency.py`) |
| Jumlah test (44 / 11 / 8 / 38 / 21) | Dari run terakhir di repo ini |

## Klaim yang sengaja tidak dimasukkan

- **Akurasi pada anjing Bali**: belum diukur; ditulis sebagai keterbatasan dan rencana.
- **Latensi di Hugging Face Spaces**: belum diukur; disebut "belum diukur".
- **Screenshot hasil zona dari alur petugas** (`docs/screenshots/14-*`, `15-*`): skornya berasal dari AI tiruan e2e, jadi tidak dipakai. Gambar hasil AI di proposal (Gambar 3–4) diambil ulang dari `/demo` dengan AI service asli lewat `scripts/capture-proposal-screens.mjs`.
- **Kemitraan** dengan Satgas, Distan Pangan, Puskeswan, atau puskesmas: ditulis sebagai rencana, "belum ada kemitraan".
- **"Izin MiewID sedang dimintakan"**: permintaan izin belum dikirim, jadi ditulis "izin tertulis belum diperoleh". README juga diperbaiki ("sedang dikonfirmasi" → "izin tertulis belum diperoleh").
- **Biaya microchip** atau angka penghematan waktu petugas: tidak ada sumber, jadi tidak ditulis angka.
- **Mode offline petugas, peta gigitan, ekspor CSV**: belum dibuat; hanya muncul di rencana final.

## Perubahan pada `AI_DISCLOSURE.md`

Ditulis ulang agar **identik** dengan Lampiran A proposal (dicek otomatis: 14 baris dan kalimat pernyataan sama persis setelah markup dibuang):

- Format diganti menjadi tabel Lampiran C panduan (Nama Produk sampai Third-party Assets/Credits) + baris layanan pihak ketiga + kalimat pernyataan.
- Ditambahkan: template `create-next-app`, daftar library dengan lisensi, versi runtime, dataset dan aset beserta lisensi, status lisensi MiewID ("izin tertulis belum diperoleh"), pembagian komponen dari Vishara vs yang dibuat baru, dan penyusunan draf proposal oleh Claude Code.
- Isi lama (AI di produk, layanan pihak ketiga, asal konsep Mode Warga) tetap ada, dipindahkan ke baris tabel yang sesuai.

## File yang ditambahkan

| File | Fungsi |
|---|---|
| `docs/proposal/proposal.html`, `proposal.css` | Sumber proposal |
| `docs/proposal/AIWIC2026_MadeBayuArdanaPutra_Tera.pdf` | Hasil |
| `docs/proposal/img/demo-*.png` | Screenshot hasil AI asli |
| `docs/proposal/fonts/` | Plus Jakarta Sans (OFL): varian variabel Latin + 5 instance statis, dibuat oleh `make_static.py` (butuh fontTools + brotli) |
| `scripts/build-proposal.mjs` | `npm run proposal` |
| `scripts/capture-proposal-screens.mjs` | Ambil ulang Gambar 3–4 (butuh app + AI service + data demo) |
| `docs/proposal/KETENTUAN.md`, `LAPORAN.md` | Ketentuan panduan dan laporan ini |
