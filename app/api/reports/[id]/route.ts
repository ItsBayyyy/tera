import { z } from "zod";
import { fail, json, requireStaff } from "@/lib/api";
import { uuid } from "@/lib/validation/common";

const bodySchema = z.object({
  status: z.enum(["new", "in_progress", "closed"]).optional(),
  confirmedDogId: uuid.nullable().optional(),
  officerNote: z.string().trim().max(500).optional(),
});

/** Officers move a case through the queue and confirm (or clear) the AI's dog suggestion. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/reports/[id]">) {
  const staff = await requireStaff();
  if (staff instanceof Response) return staff;

  const id = uuid.safeParse((await ctx.params).id);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !parsed.success) return fail(400, "Data kasus tidak valid.");

  const update: { status?: "new" | "in_progress" | "closed"; confirmed_dog_id?: string | null; officer_note?: string } = {};
  if (parsed.data.status) update.status = parsed.data.status;
  if (parsed.data.confirmedDogId !== undefined) update.confirmed_dog_id = parsed.data.confirmedDogId;
  if (parsed.data.officerNote !== undefined) update.officer_note = parsed.data.officerNote;

  const { data, error } = await staff.supabase.from("bite_reports").update(update).eq("id", id.data).select("id").maybeSingle();
  if (error) return fail(500, "Perubahan belum tersimpan.");
  if (!data) return fail(404, "Kasus tidak ditemukan.");
  return json({ ok: true });
}
