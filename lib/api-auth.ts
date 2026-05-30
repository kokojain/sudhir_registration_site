import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader) return null;
  const [type, token] = authHeader.split(" ");
  if (!type || !token) return null;
  if (type.toLowerCase() !== "bearer") return null;
  return token.trim();
}

async function resolveRequestUser(request: Request) {
  const admin = getAdminSupabaseClient();
  const bearerToken = getBearerToken(request);
  if (bearerToken) {
    const { data, error } = await admin.auth.getUser(bearerToken);
    return { user: data.user, error };
  }

  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
}

export async function requireApiUser(request: Request) {
  const { user, error } = await resolveRequestUser(request);

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

export async function requireApiAdmin(request: Request) {
  const result = await requireApiUser(request);
  if ("error" in result) return result;
  if (result.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}
