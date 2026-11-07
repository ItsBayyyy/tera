import { fail, fieldErrors, json, requireStaff } from "@/lib/api";
import { configSchema } from "@/lib/validation/admin";

export async function PUT(request: Request) {
  const staff = await requireStaff({ admin: true });
  if (staff instanceof Response) return staff;

  const parsed = configSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "Periksa nilai ambang.", fieldErrors(parsed.error));

  const note = "Diubah admin lewat dasbor.";
  const { error } = await staff.supabase.from("app_config").upsert([
    { key: "match_strong", value: parsed.data.matchStrong, note },
    { key: "match_unsure", value: parsed.data.matchUnsure, note },
    { key: "vaccine_valid_days", value: parsed.data.vaccineValidDays, note: "Periode vaksin aktif dalam hari." },
  ]);
  if (error) return fail(500, "Pengaturan belum tersimpan.");
  return json({ ok: true });
}
