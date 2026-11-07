import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { fail, json, requireStaff } from "@/lib/api";
import { uuid } from "@/lib/validation/common";
import { logEvent } from "@/lib/log";

const bodySchema = z.object({ action: z.enum(["dismiss", "merge"]) });

/**
 * Resolves a possible duplicate registration.
 * dismiss: they are different dogs → pending vaccinations of the flagged dog become verified.
 * merge: same dog → photos and vaccinations move to the earlier record and the duplicate is removed.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/duplicates/[id]">) {
  const staff = await requireStaff({ admin: true });
  if (staff instanceof Response) return staff;

  const id = uuid.safeParse((await ctx.params).id);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !parsed.success) return fail(400, "Permintaan tidak valid.");

  const db = getAdminClient();
  const { data: flag } = await db.from("duplicate_flags").select("*").eq("id", id.data).eq("status", "open").maybeSingle();
  if (!flag) return fail(404, "Calon duplikat tidak ditemukan atau sudah ditinjau.");

  if (parsed.data.action === "dismiss") {
    await db.from("duplicate_flags").update({ status: "dismissed", resolved_by: staff.userId }).eq("id", flag.id);
    const { count } = await db
      .from("duplicate_flags")
      .select("id", { count: "exact", head: true })
      .eq("dog_id", flag.dog_id)
      .eq("status", "open");
    if (!count) {
      await db.from("vaccinations").update({ ai_status: "verified" }).eq("dog_id", flag.dog_id).eq("ai_status", "pending");
    }
  } else {
    await db.from("duplicate_flags").update({ status: "merged", resolved_by: staff.userId }).eq("id", flag.id);
    await db.from("dog_photos").update({ dog_id: flag.candidate_dog_id }).eq("dog_id", flag.dog_id);
    await db
      .from("vaccinations")
      .update({ dog_id: flag.candidate_dog_id, ai_status: "verified" })
      .eq("dog_id", flag.dog_id);
    await db.from("bite_reports").update({ confirmed_dog_id: flag.candidate_dog_id }).eq("confirmed_dog_id", flag.dog_id);
    await db.from("dogs").delete().eq("id", flag.dog_id);
  }
  logEvent("info", "duplicate.resolved", { action: parsed.data.action });
  return json({ ok: true });
}
