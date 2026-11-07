# Screenshot

Dibuat oleh `e2e/screenshots.spec.ts` (Playwright) di lebar **360 px** dan **1280 px**, halaman penuh, lalu dikompres ke PNG 256 warna. AI di alur petugas adalah mock e2e (`e2e/mock-ai-server.mjs`); halaman demo memakai data seed yang dibuat AI asli.

```bash
SCREENSHOTS=1 PLAYWRIGHT_BROWSERS_PATH=0 npx playwright test e2e/screenshots.spec.ts
```

| # | Layar |
|---|---|
| 01 | Beranda (dua tombol) |
| 02–05 | Mode Warga: panduan, form, error validasi, laporan diterima |
| 06 | Login dengan error per field |
| 07–16 | Petugas: beranda kosong, scan, foto lolos, zona tidak cocok, error form, catat vaksin, selesai, zona kuat, zona ragu, AI mati |
| 17–18 | Daftar anjing, detail anjing |
| 19–20 | Antrean kasus (real-time), detail kasus |
| 21 | Admin |
| 22 | Mode demo |

## Atribusi foto

- Foto anjing di layar petugas/warga: Wikimedia Commons, domain publik — *Kintamani dog white* dan *Street dog-Gianyar Bali-2009* (Imk0278; Jack Merridew).
- Foto di layar demo (22): **DogFaceNet**, CC BY 4.0 — Mougeot, Li, Jia, *A Deep Learning Approach for Dog Face Verification and Recognition*, PRICAI 2019, https://zenodo.org/records/12578449.
