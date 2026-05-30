import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = getAdminSupabaseClient();

  const { data: activeDataset } = await admin
    .from("datasets")
    .select("id,name")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeDataset) {
    return NextResponse.json({
      dataset: null,
      stations: [],
    });
  }

  const { data: stations } = await admin
    .from("stations")
    .select("id,label,station_token,ordinal")
    .eq("dataset_id", activeDataset.id)
    .order("ordinal", { ascending: true });

  return NextResponse.json({
    dataset: activeDataset,
    stations: stations ?? [],
  });
}
