import { NextResponse } from "next/server";
import { z } from "zod";
import { processScan } from "@/lib/scan";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  stationToken: z.string().min(1),
  delegateId: z.string().min(1),
  operatorName: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scan payload." }, { status: 400 });
  }

  const admin = getAdminSupabaseClient();
  const { data: station } = await admin
    .from("stations")
    .select("station_token,dataset_id")
    .eq("station_token", parsed.data.stationToken)
    .maybeSingle();

  if (!station) {
    return NextResponse.json({ error: "Invalid station link." }, { status: 404 });
  }

  const { data: dataset } = await admin
    .from("datasets")
    .select("organization_id")
    .eq("id", station.dataset_id)
    .maybeSingle();

  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found for station." }, { status: 404 });
  }

  const result = await processScan({
    organizationId: dataset.organization_id,
    stationToken: parsed.data.stationToken,
    rawDelegateId: parsed.data.delegateId,
    operatorName: parsed.data.operatorName,
    scannedBy: null,
  });

  return NextResponse.json(result);
}
