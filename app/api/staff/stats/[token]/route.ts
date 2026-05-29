import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

type Params = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const admin = getAdminSupabaseClient();

  const { data: station } = await admin
    .from("stations")
    .select("id,label,dataset_id")
    .eq("station_token", token)
    .maybeSingle();

  if (!station) {
    return NextResponse.json({ error: "Invalid station token." }, { status: 404 });
  }

  const [delegatesCountRes, usedCountRes] = await Promise.all([
    admin.from("delegates").select("id", { count: "exact", head: true }).eq("dataset_id", station.dataset_id),
    admin
      .from("delegate_station_status")
      .select("id", { count: "exact", head: true })
      .eq("station_id", station.id)
      .eq("status", "USED"),
  ]);

  return NextResponse.json({
    stationLabel: station.label,
    totalDelegates: delegatesCountRes.count ?? 0,
    usedAtStation: usedCountRes.count ?? 0,
  });
}
