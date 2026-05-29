import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { buildAdminState } from "@/lib/admin-state";

export async function GET() {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;
  const state = await buildAdminState(auth.user.organizationId);
  return NextResponse.json(state);
}
