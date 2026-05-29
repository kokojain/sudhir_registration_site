import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api-auth";
import { processScan } from "@/lib/scan";

const schema = z.object({
  stationToken: z.string().min(1),
  delegateId: z.string().min(1),
  operatorName: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scan payload." }, { status: 400 });
  }

  const result = await processScan({
    organizationId: auth.user.organizationId,
    stationToken: parsed.data.stationToken,
    rawDelegateId: parsed.data.delegateId,
    operatorName: parsed.data.operatorName,
    scannedBy: auth.user.id,
  });

  return NextResponse.json(result);
}
