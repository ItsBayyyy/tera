import { getAdminClient } from "@/lib/supabase/admin";
import { clientIp, fail, json } from "@/lib/api";
import { demoLimiter, getDemoBanjarId } from "@/lib/demo";

/** Demo: remove every dog a visitor added to the DEMO banjar; seeded demo dogs stay. */
export async function POST(request: Request) {
  if (!demoLimiter.reset(clientIp(request)).ok) return fail(429, "Terlalu banyak percobaan. Tunggu beberapa menit.");
  const db = getAdminClient();
  const banjarId = await getDemoBanjarId(db);
  const { data: dogs } = await db.from("dogs").select("id, dog_photos(storage_path)").eq("banjar_id", banjarId).eq("demo_seed", false);
  const paths = (dogs ?? []).flatMap((d) => d.dog_photos.map((p) => p.storage_path));
  if (paths.length) await db.storage.from("dog-photos").remove(paths);
  if (dogs?.length) {
    const { error } = await db.from("dogs").delete().in("id", dogs.map((d) => d.id));
    if (error) return fail(500, "Reset belum berhasil.");
  }
  return json({ removed: dogs?.length ?? 0 });
}
