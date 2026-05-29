import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

export async function requireApiUser() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = getAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { error: NextResponse.json({ error: "Profile missing for user." }, { status: 403 }) };
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      fullName: profile.full_name ?? null,
      organizationId: profile.organization_id as string,
      role: profile.role as "admin" | "staff",
    },
  };
}

export async function requireApiAdmin() {
  const result = await requireApiUser();
  if ("error" in result) return result;
  if (result.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}
