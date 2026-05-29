import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ensureSupabaseEnv, env } from "@/lib/env";

export async function getServerSupabaseClient() {
  ensureSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        items.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}
