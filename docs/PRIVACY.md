# Privasi KenalAsu

| Data | Perlakuan | Di mana di kode |
|---|---|---|
| Metadata foto (EXIF: GPS, model kamera, waktu) | Dihapus di perangkat: foto digambar ulang ke canvas dan di-encode ulang ke JPEG (sisi terpanjang ≤1024 px). Output canvas hanya berisi piksel. | `lib/image/compress.ts`, `components/camera-capture.tsx` |
| Lokasi gigitan | Hanya dengan izin Geolocation, dibulatkan ke 3 desimal (~110 m) di perangkat **dan** dibulatkan lagi di server. Kolom `numeric(6,3)` tidak bisa menyimpan lebih presisi. | `lib/geo.ts`, `app/api/reports/route.ts` |
| Tampilan data publik | Tidak ada peta atau daftar publik. Agregat di dasbor admin hanya per banjar dan hanya untuk staf yang login. Warga tidak pernah melihat data anjing, status vaksin, atau laporan lain. | `app/admin/`, RLS |
| Nomor HP warga | Opsional. Hanya disimpan bila kotak persetujuan dicentang; constraint database menolak nomor tanpa persetujuan. | `bite_reports_phone_needs_consent`, `lib/validation/report.ts` |
| Data pemilik anjing | Opsional (`owner_name`, `owner_phone`), ditandai sebagai data pribadi di skema, hanya terlihat oleh staf. | `supabase/migrations/20261108000100_schema.sql` |
| Foto | Bucket storage **privat**; ditampilkan ke staf lewat signed URL berumur 30–60 menit. | `supabase/migrations/20261108000200_rls.sql` |
| AI | Tidak ada API pihak ketiga. Foto dikirim hanya ke AI service milik sendiri, diproses di memori, tidak disimpan, tidak di-log. Embedding disimpan di Postgres milik proyek. | `ai-service/`, `lib/ai/client.ts` |
| Log server | Satu baris JSON per kejadian tanpa foto, embedding, nomor HP, atau isi laporan. | `lib/log.ts` |
| Akses data | RLS: anon tidak punya akses tabel; laporan warga masuk lewat route handler dengan validasi zod + rate limit. | `supabase/migrations/20261108000200_rls.sql` |

## Yang belum ada (dicatat jujur)

- Kebijakan retensi (berapa lama laporan dan foto disimpan) belum ditetapkan; perlu keputusan dinas.
- Belum ada fitur penghapusan data atas permintaan pemilik/warga selain lewat admin database.
- Rate limit bersifat per instance server, bukan global.
