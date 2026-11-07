import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getBrowserClient() {
  client ??= createBrowserClient<Database>(publicEnv.supabaseUrl(), publicEnv.supabaseKey());
  return client;
}
