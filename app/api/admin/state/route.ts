import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { buildAdminState } from "@/lib/admin-state";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request);
  if ("error" in auth) return auth.error;
  const state = await buildAdminState(auth.user.organizationId);
  return NextResponse.json(state);
}
