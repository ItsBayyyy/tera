/**
 * REVIEW REQUIRED: this first-aid text has not yet been reviewed by a health professional.
 * It must be checked (e.g. by Dinas Kesehatan / a Rabies Center doctor) before public launch.
 * Flip FIRST_AID_REVIEWED to true after that review (see docs/DEPLOY.md).
 */
export const FIRST_AID_REVIEWED = false;

/** Shown under the page title to steady a panicking reader before the steps. */
export const FIRST_AID_INTRO = "Rabies bisa dicegah bila ditangani cepat. Ikuti langkah di bawah, satu per satu.";

export const WASH_MINUTES = 15;

export const FIRST_AID_STEPS = [
  {
    title: "Cuci luka dengan sabun dan air mengalir",
    detail: `Lakukan sekitar ${WASH_MINUTES} menit. Ini langkah paling penting.`,
    action: "wash-timer",
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
    action: "nearby-care",
  },
  {
    title: "Jangan mengejar atau menangkap anjingnya",
    detail: "Ingat ciri-cirinya dan lokasinya, lalu beri tahu petugas.",
  },
] as const;
