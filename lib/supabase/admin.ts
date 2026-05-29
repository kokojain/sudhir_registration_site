import { createClient } from "@supabase/supabase-js";
import { ensureSupabaseEnv, env } from "@/lib/env";

export function getAdminSupabaseClient() {
  ensureSupabaseEnv();
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
