import type { z } from "zod";
import type { facilitySchema } from "@/lib/validation/admin";

export function facilityRow(input: z.infer<typeof facilitySchema>) {
  return {
    name: input.name,
    type: input.type,
    phone: input.phone ?? null,
    address: input.address ?? null,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    handles_bites: input.handlesBites,
    readiness_note: input.readinessNote ?? null,
  };
}
