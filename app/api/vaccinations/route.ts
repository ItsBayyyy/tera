import { fail, fieldErrors, json, requireStaff } from "@/lib/api";
import { vaccinationSchema } from "@/lib/validation/vaccination";
import { logEvent } from "@/lib/log";

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (staff instanceof Response) return staff;

  const parsed = vaccinationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "Data vaksin tidak valid.", fieldErrors(parsed.error));

  const { data, error } = await staff.supabase
    .from("vaccinations")
    .insert({
      dog_id: parsed.data.dogId,
      batch: parsed.data.batch ?? null,
      ai_status: parsed.data.aiStatus,
      officer_id: staff.userId,
    })
    .select("id, vaccinated_at")
    .single();
  if (error || !data) return fail(500, "Vaksin belum tercatat. Coba lagi.");

  if (parsed.data.matchLogId) {
    await staff.supabase.from("match_logs").update({ chosen_dog_id: parsed.data.dogId }).eq("id", parsed.data.matchLogId);
  }
  logEvent("info", "vaccination.recorded", { ai_status: parsed.data.aiStatus });
  return json({ id: data.id, vaccinatedAt: data.vaccinated_at }, 201);
}
