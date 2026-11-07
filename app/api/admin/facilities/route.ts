import { fail, fieldErrors, json, requireStaff } from "@/lib/api";
import { facilitySchema } from "@/lib/validation/admin";
import { facilityRow } from "@/lib/facility-input";

export async function POST(request: Request) {
  const staff = await requireStaff({ admin: true });
  if (staff instanceof Response) return staff;

  const parsed = facilitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "Periksa isian faskes.", fieldErrors(parsed.error));

  const { data, error } = await staff.supabase.from("facilities").insert(facilityRow(parsed.data)).select("id").single();
  if (error || !data) return fail(500, "Faskes belum tersimpan.");
  return json({ id: data.id }, 201);
}
