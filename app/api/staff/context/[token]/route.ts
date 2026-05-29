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
    .select("id,label,dataset_id,station_token,station_key")
    .eq("station_token", token)
    .maybeSingle();

  if (!station) {
    return NextResponse.json({ error: "Invalid station token." }, { status: 404 });
  }

  return NextResponse.json({
    station,
  });
}
