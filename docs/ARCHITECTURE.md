# Arsitektur Tera

```mermaid
flowchart LR
  subgraph Browser["Browser (Next.js PWA)"]
    W["Mode Warga /darurat<br/>panduan + laporan (tanpa login)"]
    P["Mode Petugas /petugas<br/>scan · daftar · vaksin · kasus"]
    A["/admin · /demo"]
    SW["Service worker<br/>cache /darurat"]
    C["Kompres foto di perangkat<br/>canvas ≤1024 px, JPEG 0,8, tanpa EXIF"]
  end

  subgraph Next["Next.js Route Handlers (server)"]
    RS["/api/scan/analyze · /api/scan/match"]
    RD["/api/dogs · /api/vaccinations"]
    RR["/api/reports (zod + rate limit)"]
    RJ["/api/jobs/rematch"]
    RM["/api/demo/*"]
  end

  subgraph AI["AI Service (FastAPI, CPU, stateless)"]
    Q["Quality gate (OpenCV)"]
    D["Deteksi wajah/kepala anjing"]
    E["Embedding MiewID (L2-normalized)"]
  end

  subgraph SB["Supabase"]
    PG[("Postgres + pgvector<br/>match_dogs() · banjar_coverage()<br/>RLS")]
    ST[("Storage privat<br/>dog-photos · report-photos")]
    AU["Auth (email/password)"]
    RT["Realtime bite_reports"]
  end

  P --> C --> RS
  W --> C
  W --> RR
  A --> RM
  RS -- "X-Service-Key" --> AI
  RR -. "after(): analisis + cocokkan" .-> AI
  RJ --> AI
  RM --> AI
  Q --> D --> E
  RS -- "sesi pengguna (RLS)" --> PG
  RD -- "sesi pengguna (RLS)" --> PG & ST
  RR -- "service role" --> PG & ST
  RJ -- "service role" --> PG & ST
  RM -- "service role, banjar DEMO saja" --> PG & ST
  P -- "baca langsung (RLS)" --> PG
  P -- "langganan" --> RT
  P --> AU
```

## Prinsip

| Keputusan | Alasan |
|---|---|
| AI service **stateless** | Tidak menyimpan foto/embedding; mudah di-deploy ke HF Spaces gratis dan diganti modelnya. |
| **Pencocokan di Postgres** (`match_dogs`) | Data dan pencocokan di satu tempat, mengikuti RLS; tidak ada indeks vektor kedua yang harus disinkronkan. |
| Kunci service role **hanya di server** | Dipakai untuk laporan warga, job rematch, dan mode demo. Operasi petugas memakai sesi pengguna agar RLS ikut berlaku. |
| Laporan warga **tidak menunggu AI** | Kode kasus dikembalikan dulu; analisis foto berjalan di `after()`. AI mati tidak pernah menggagalkan laporan. |
| Fallback eksplisit | Timeout AI 15 detik → "Catat tanpa verifikasi AI" (`ai_status = pending`) → `/api/jobs/rematch` mengisi embedding dan menandai calon duplikat. |

## Alur scan petugas

```mermaid
sequenceDiagram
  participant O as Petugas
  participant N as Next.js
  participant AI as AI service
  participant DB as Postgres
  O->>N: POST /api/scan/analyze (foto terkompresi)
  N->>AI: POST /v1/analyze
  AI-->>N: quality, detection, embedding
  N-->>O: hasil per foto (pesan kualitas spesifik)
  O->>N: POST /api/scan/match (1–3 embedding, banjar)
  N->>DB: match_dogs() per foto
  N->>N: skor terbaik per anjing → zona strong/unsure/none
  N->>DB: insert match_logs
  N-->>O: zona + kandidat (signed URL foto)
  O->>N: konfirmasi / daftar baru → catat vaksin
```

## Lokasi kode penting

| Bagian | File |
|---|---|
| Logika zona (fungsi murni + test) | `lib/match/zone.ts`, `tests/unit/zone.test.ts` |
| Pemanggilan AI service | `lib/ai/client.ts` (timeout 15 s, kontrak divalidasi zod) |
| Pencocokan + log | `lib/match/run.ts`, `supabase/migrations/20261108000300_functions.sql` |
| Skema, RLS, storage | `supabase/migrations/` |
| Laporan warga | `app/api/reports/route.ts`, `lib/reports.ts` |
| Job rematch | `app/api/jobs/rematch/route.ts`, `lib/rematch.ts` |
| AI service | `ai-service/app/` |
