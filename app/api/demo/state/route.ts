import { connection } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fail, json, loadMatchConfig, signPaths } from "@/lib/api";
import { DEMO_PROBE_PREFIX, getDemoBanjarId, probeAnswer } from "@/lib/demo";
import { vaccineState } from "@/lib/vaccine";

/** Public, read-only view of the separate DEMO banjar: registered demo dogs and unregistered test photos. */
export async function GET() {
  await connection();
  try {
    const db = getAdminClient();
    const banjarId = await getDemoBanjarId(db);
    const config = await loadMatchConfig(db);
    const [{ data: dogs }, { data: files }] = await Promise.all([
      db
        .from("dogs")
        .select("id, nickname, color, demo_seed, created_at, dog_photos(storage_path), vaccinations(vaccinated_at)")
        .eq("banjar_id", banjarId)
        .order("demo_seed", { ascending: false })
        .order("created_at"),
      db.storage.from("dog-photos").list(DEMO_PROBE_PREFIX, { limit: 100, sortBy: { column: "name", order: "asc" } }),
    ]);
    const probes = (files ?? []).filter((f) => f.name.endsWith(".jpg")).map((f) => `${DEMO_PROBE_PREFIX}/${f.name}`);
    const dogPhotoPaths = (dogs ?? []).flatMap((d) => d.dog_photos.slice(0, 1).map((p) => p.storage_path));
    const urls = await signPaths(db, "dog-photos", [...dogPhotoPaths, ...probes], 60 * 60);

    return json({
      thresholds: { strong: config.strong, unsure: config.unsure },
      dogs: (dogs ?? []).map((d) => {
        const last = d.vaccinations.map((v) => v.vaccinated_at).sort().at(-1) ?? null;
        return {
          id: d.id,
          nickname: d.nickname,
          color: d.color,
          seeded: d.demo_seed,
          photoCount: d.dog_photos.length,
          photoUrl: urls.get(d.dog_photos[0]?.storage_path ?? "") ?? null,
          vaccine: vaccineState(last, config.vaccineValidDays),
          lastVaccinatedAt: last,
        };
      }),
      probes: probes.map((path) => ({ path, url: urls.get(path) ?? null, answer: probeAnswer(path) })),
    });
  } catch {
    return fail(500, "Data demo belum bisa dimuat.");
  }
}
