import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      full_name: user.user_metadata?.full_name ?? user.email ?? null,
    })
    .select("id,role,organization_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, profile: created });
}
