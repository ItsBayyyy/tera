# PROGRESS

(Laporan akhir akan ditulis di bagian atas file ini saat semua milestone selesai.)

## Status per milestone

| # | Status | Catatan |
|---|---|---|
| M0 | Selesai | `docs/PLAN.md` |
| M1 | Selesai | 3 migrasi + seed, `npm run test:db` 11/11 lulus |
| M2 | Berjalan | AI service dikerjakan paralel (sub-agent) di `ai-service/` |
| M3 | Selesai | Route scan + zona; Vitest 42/42 lulus |
| M4 | Selesai | UI petugas; e2e alur petugas lulus (AI mock) |
| M5 | Selesai | Fallback + `/api/jobs/rematch`; e2e AI mati lulus |
| M6 | Selesai | `/darurat` + SW offline + antrean kasus; e2e warga (AI hidup/mati/offline) lulus |
| M7 | Sebagian | `/admin`, `/demo` jalan; `scripts/seed_demo.py` menunggu AI service |
| M8 | Belum | |
| M9 | Belum | |

## Menjalankan

```bash
npm install
npx supabase start          # Docker harus menyala
npx supabase db reset       # migrasi + seed lokal
npx supabase status -o env  # salin nilai ke .env.local (lihat .env.example)
npm run dev
```

Cek: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run build`, `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright test`.
