/**
 * REVIEW REQUIRED: this first-aid text has not yet been reviewed by a health professional.
 * It must be checked (e.g. by Dinas Kesehatan / a Rabies Center doctor) before public launch.
 * Tracked in MORNING_TODO.md.
 */
export const FIRST_AID_REVIEWED = false;

export const FIRST_AID_STEPS = [
  {
    title: "Cuci luka dengan sabun dan air mengalir",
    detail: "Lakukan sekitar 15 menit. Ini langkah paling penting.",
  },
  {
    title: "Beri antiseptik setelah dicuci",
    detail: "Misalnya povidone-iodine.",
  },
  {
    title: "Jangan menutup rapat atau menjahit luka sendiri",
    detail: "Biarkan dokter atau petugas kesehatan yang menangani luka.",
  },
  {
    title: "Segera ke puskesmas atau rumah sakit hari ini",
    detail: "Petugas akan memeriksa luka dan kebutuhan vaksin anti-rabies (VAR).",
  },
  {
    title: "Jangan mengejar atau menangkap anjingnya",
    detail: "Ingat ciri-cirinya dan lokasinya, lalu beri tahu petugas.",
  },
] as const;
