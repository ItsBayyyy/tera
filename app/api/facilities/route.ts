import { connection } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fail, json } from "@/lib/api";

/** Facilities that handle bites, as entered by an admin. Empty until an admin fills it in. */
export async function GET() {
  await connection();
  const { data, error } = await getAdminClient()
    .from("facilities")
    .select("id, name, type, phone, address, readiness_note")
    .eq("handles_bites", true)
    .order("name");
  if (error) return fail(500, "Daftar faskes belum bisa dimuat.");
  return json({ facilities: data });
}
