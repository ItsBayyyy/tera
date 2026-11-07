import { z } from "zod";
import { fail, json, requireStaff } from "@/lib/api";
import { uuid } from "@/lib/validation/common";

const bodySchema = z.object({ matchLogId: uuid, dogId: uuid });

/** Records which dog the officer confirmed, so match logs can be used to measure real-world accuracy. */
export async function POST(request: Request) {
  const staff = await requireStaff();
  if (staff instanceof Response) return staff;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "Data konfirmasi tidak valid.");

  const { error } = await staff.supabase
    .from("match_logs")
    .update({ chosen_dog_id: parsed.data.dogId })
    .eq("id", parsed.data.matchLogId);
  if (error) return fail(500, "Konfirmasi belum tersimpan.");
  return json({ ok: true });
}
