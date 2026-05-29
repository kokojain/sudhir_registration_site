import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api-auth";
import { appendAuditLog, getActiveDataset } from "@/lib/data";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  requireRegistrationFirst: z.boolean(),
  registrationStationId: z.string().uuid().nullable(),
});

export async function PATCH(request: Request) {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
  }

  const dataset = await getActiveDataset(auth.user.organizationId);
  if (!dataset) {
    return NextResponse.json({ error: "No active dataset." }, { status: 404 });
  }

  const admin = getAdminSupabaseClient();
  const { error } = await admin
    .from("datasets")
    .update({
      require_registration_first: parsed.data.requireRegistrationFirst,
      registration_station_id: parsed.data.registrationStationId,
    })
    .eq("id", dataset.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await appendAuditLog({
    organizationId: auth.user.organizationId,
    actorId: auth.user.id,
    action: "dataset_settings_updated",
    payload: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
