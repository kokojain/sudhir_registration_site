import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireApiUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const admin = getAdminSupabaseClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id,role,organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, profile: existing });
  }

  const { data: firstOrg } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstOrg) {
    return NextResponse.json({ error: "No organization configured. Run schema seed first." }, { status: 400 });
  }

  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", firstOrg.id);

  const role = (count ?? 0) === 0 ? "admin" : "staff";
  const { data: created, error } = await admin
    .from("profiles")
    .insert({
      id: user.id,
      organization_id: firstOrg.id,
      role,
      full_name: user.fullName ?? user.email ?? null,
    })
    .select("id,role,organization_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, profile: created });
}
