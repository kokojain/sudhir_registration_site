import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppRole, AuthUserContext } from "@/lib/types";

export async function getCurrentUserContext(): Promise<AuthUserContext | null> {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const admin = getAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    userId: user.id,
    organizationId: profile.organization_id,
    role: profile.role as AppRole,
    fullName: profile.full_name ?? null,
    email: user.email ?? null,
  };
}

export async function requireAuthenticatedUser() {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login");
  return context;
}

export async function requireRole(role: AppRole) {
  const context = await requireAuthenticatedUser();
  if (context.role !== role) redirect("/");
  return context;
}
