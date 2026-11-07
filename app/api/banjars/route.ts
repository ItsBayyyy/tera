import { connection } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fail, json } from "@/lib/api";

/** Public list of banjar names for the citizen form. Names only; no counts or dog data. */
export async function GET() {
  await connection();
  const { data, error } = await getAdminClient()
    .from("banjars")
    .select("id, name, district")
    .eq("is_demo", false)
    .order("name");
  if (error) return fail(500, "Daftar banjar belum bisa dimuat.");
  return json({ banjars: data });
}
