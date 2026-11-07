export type VaccineState = "active" | "expired" | "none";

const DAY_MS = 24 * 60 * 60 * 1000;

export function vaccineState(lastVaccinatedAt: string | null, validDays: number, now: Date = new Date()): VaccineState {
  if (!lastVaccinatedAt) return "none";
  const age = now.getTime() - new Date(lastVaccinatedAt).getTime();
  return age <= validDays * DAY_MS ? "active" : "expired";
}

export function vaccineExpiry(lastVaccinatedAt: string, validDays: number): Date {
  return new Date(new Date(lastVaccinatedAt).getTime() + validDays * DAY_MS);
}
