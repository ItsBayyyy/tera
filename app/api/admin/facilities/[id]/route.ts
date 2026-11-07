import { fail, fieldErrors, json, requireStaff } from "@/lib/api";
import { facilitySchema } from "@/lib/validation/admin";
import { facilityRow } from "@/lib/facility-input";
import { uuid } from "@/lib/validation/common";

export async function PUT(request: Request, ctx: RouteContext<"/api/admin/facilities/[id]">) {
  const staff = await requireStaff({ admin: true });
  if (staff instanceof Response) return staff;

  const id = uuid.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "Faskes tidak ditemukan.");
  const parsed = facilitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "Periksa isian faskes.", fieldErrors(parsed.error));

  const { data, error } = await staff.supabase
    .from("facilities")
    .update(facilityRow(parsed.data))
    .eq("id", id.data)
    .select("id")
    .maybeSingle();
  if (error) return fail(500, "Faskes belum tersimpan.");
  if (!data) return fail(404, "Faskes tidak ditemukan.");
  return json({ ok: true });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/facilities/[id]">) {
  const staff = await requireStaff({ admin: true });
  if (staff instanceof Response) return staff;

  const id = uuid.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "Faskes tidak ditemukan.");
  const { error } = await staff.supabase.from("facilities").delete().eq("id", id.data);
  if (error) return fail(500, "Faskes belum terhapus.");
  return json({ ok: true });
}
