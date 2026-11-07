/**
 * Integration tests against the local Supabase stack (`npx supabase start`, `npx supabase db reset`).
 * They create their own rows in the sample banjars and delete them afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { EMBEDDING_DIM } from "@/lib/validation/common";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

type Client = SupabaseClient<Database>;

const service: Client = createClient<Database>(url, secret, { auth: { persistSession: false } });
const anon: Client = createClient<Database>(url, publishable, { auth: { persistSession: false } });
const officer: Client = createClient<Database>(url, publishable, { auth: { persistSession: false } });

/** Unit vector pointing mostly along `axis`, with a small component along `axis + 1`. */
function vec(axis: number, tilt = 0): string {
  const v = new Array<number>(EMBEDDING_DIM).fill(0);
  v[axis] = Math.cos(tilt);
  v[axis + 1] = Math.sin(tilt);
  return JSON.stringify(v);
}

let banjarA: string;
let banjarB: string;
const createdDogs: string[] = [];

async function createDog(banjarId: string, color: string, embeddings: string[]) {
  const { data: dog, error } = await service
    .from("dogs")
    .insert({ banjar_id: banjarId, color, sex: "unknown", ownership: "stray" })
    .select("id")
    .single();
  if (error) throw error;
  createdDogs.push(dog.id);
  for (const [i, embedding] of embeddings.entries()) {
    const { error: photoError } = await service
      .from("dog_photos")
      .insert({ dog_id: dog.id, storage_path: `test/${dog.id}/${i}.jpg`, embedding, model_version: "test" });
    if (photoError) throw photoError;
  }
  return dog.id;
}

beforeAll(async () => {
  const { data: banjars, error } = await service.from("banjars").select("id").eq("is_sample", true).order("name");
  if (error) throw error;
  [banjarA, banjarB] = [banjars[0].id, banjars[1].id];
  const { error: signInError } = await officer.auth.signInWithPassword({
    email: "petugas@kenalasu.test",
    password: "petugas-lokal-123",
  });
  if (signInError) throw signInError;
});

afterAll(async () => {
  if (createdDogs.length) await service.from("dogs").delete().in("id", createdDogs);
  await officer.auth.signOut();
});

describe("RLS", () => {
  it("gives anon no access to operational tables", async () => {
    for (const table of ["dogs", "dog_photos", "vaccinations", "bite_reports", "facilities", "banjars", "app_config"] as const) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0, table).toBe(true);
    }
  });

  it("does not let anon insert a bite report directly", async () => {
    const { error } = await anon.from("bite_reports").insert({ case_code: "TST-ANON" });
    expect(error).not.toBeNull();
  });

  it("does not let anon call match_dogs", async () => {
    const { error } = await anon.rpc("match_dogs", { query: vec(0), p_banjar_id: banjarA, p_k: 5 });
    expect(error).not.toBeNull();
  });

  it("lets an officer read banjars and config", async () => {
    const { data: banjars } = await officer.from("banjars").select("id");
    expect((banjars ?? []).length).toBeGreaterThanOrEqual(4);
    const { data: config } = await officer.from("app_config").select("key");
    expect(config?.map((row) => row.key).sort()).toEqual(["match_strong", "match_unsure", "vaccine_valid_days"]);
  });

  it("does not let an officer change thresholds or promote themselves", async () => {
    const { data: updated } = await officer.from("app_config").update({ value: 0.1 }).eq("key", "match_strong").select();
    expect(updated ?? []).toHaveLength(0);
    const { data: me } = await officer.auth.getUser();
    const { error } = await officer.from("profiles").update({ role: "admin" }).eq("user_id", me.user!.id);
    expect(error).not.toBeNull();
  });

  it("records the acting officer on vaccinations", async () => {
    const dogId = await createDog(banjarA, "Hitam", [vec(10)]);
    const { data: me } = await officer.auth.getUser();
    const { data, error } = await officer
      .from("vaccinations")
      .insert({ dog_id: dogId, ai_status: "verified" })
      .select("officer_id")
      .single();
    expect(error).toBeNull();
    expect(data?.officer_id).toBe(me.user!.id);
  });
});

describe("match_dogs", () => {
  let near: string;
  let far: string;

  beforeAll(async () => {
    near = await createDog(banjarA, "Cokelat", [vec(100, 1.2), vec(100, 0.1)]);
    far = await createDog(banjarA, "Putih", [vec(100, 1.0)]);
    await createDog(banjarB, "Belang", [vec(100, 0)]);
  });

  it("ranks dogs by their best photo and stays inside the banjar", async () => {
    const { data, error } = await officer.rpc("match_dogs", { query: vec(100), p_banjar_id: banjarA, p_k: 5 });
    expect(error).toBeNull();
    const ids = (data ?? []).map((row) => row.dog_id);
    expect(ids.indexOf(near)).toBe(0);
    expect(ids).toContain(far);
    expect(data![0].best_score).toBeCloseTo(Math.cos(0.1), 3);
    expect(data![0].best_photo_path).toMatch(/\/1\.jpg$/);
    for (const row of data ?? []) expect(row.banjar_id).toBe(banjarA);
  });

  it("returns one row per dog and honours k", async () => {
    const { data } = await officer.rpc("match_dogs", { query: vec(100), p_banjar_id: banjarA, p_k: 1 });
    expect(data).toHaveLength(1);
  });

  it("reports the latest vaccination", async () => {
    await service.from("vaccinations").insert([
      { dog_id: near, ai_status: "pending", vaccinated_at: "2025-01-01T00:00:00Z" },
      { dog_id: near, ai_status: "verified", vaccinated_at: "2026-06-01T00:00:00Z" },
    ]);
    const { data } = await officer.rpc("match_dogs", { query: vec(100), p_banjar_id: banjarA, p_k: 5 });
    const row = data!.find((r) => r.dog_id === near)!;
    expect(new Date(row.last_vaccinated_at).toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(row.last_ai_status).toBe("verified");
  });

  it("searches every non-demo banjar when no banjar is given", async () => {
    const { data } = await service.rpc("match_dogs", {
      query: vec(100),
      p_banjar_id: null as unknown as string,
      p_k: 10,
    });
    const banjars = new Set((data ?? []).map((row) => row.banjar_id));
    expect(banjars.has(banjarA) && banjars.has(banjarB)).toBe(true);
  });
});

describe("banjar_coverage", () => {
  it("counts registered and actively vaccinated dogs per banjar, excluding DEMO", async () => {
    const dogId = await createDog(banjarB, "Abu-abu", [vec(300)]);
    await service.from("vaccinations").insert({ dog_id: dogId, ai_status: "manual" });
    const { data, error } = await officer.rpc("banjar_coverage");
    expect(error).toBeNull();
    expect(data!.some((row) => row.name === "DEMO")).toBe(false);
    const row = data!.find((r) => r.banjar_id === banjarB)!;
    expect(row.dogs_registered).toBeGreaterThanOrEqual(2);
    expect(row.dogs_vaccinated_active).toBeGreaterThanOrEqual(1);
    expect(row.dogs_vaccinated_active).toBeLessThanOrEqual(row.dogs_registered);
  });
});
