import { createClient } from "@supabase/supabase-js";
import { ensureSupabaseServiceEnv, env } from "@/lib/env";

export function getAdminSupabaseClient() {
  ensureSupabaseServiceEnv();
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
