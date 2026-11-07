import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicEnv } from "@/lib/env";

/**
 * Service-role client that bypasses RLS. Only for citizen reports, the rematch job and demo mode;
 * the key never leaves the server.
 */
export function getAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Missing environment variable SUPABASE_SECRET_KEY");
  return createClient<Database>(publicEnv.supabaseUrl(), secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
