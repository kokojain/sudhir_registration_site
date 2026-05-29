import { getAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ScanResult } from "@/lib/types";
import { appendAuditLog, getActiveDataset } from "@/lib/data";
import { normalizeId } from "@/lib/utils";

function makeResult(
  status: ScanResult["status"],
  message: string,
  delegate?: { delegate_id?: string; full_name?: string | null; category?: string | null },
): ScanResult {
  return {
    status,
    message,
    delegateId: delegate?.delegate_id ?? "",
    name: delegate?.full_name ?? "",
    category: delegate?.category ?? "",
    timestamp: new Date().toISOString(),
  };
}

export async function processScan(params: {
  organizationId: string;
  stationToken: string;
  rawDelegateId: string;
  operatorName?: string;
  scannedBy?: string | null;
}) {
  const admin = getAdminSupabaseClient();
  const input = normalizeId(params.rawDelegateId);
  if (!input) return makeResult("INVALID", "Blank Delegate ID.");

  const dataset = await getActiveDataset(params.organizationId);
  if (!dataset) return makeResult("ERROR", "No active dataset configured.");

  const { data: station } = await admin
    .from("stations")
    .select("*")
    .eq("dataset_id", dataset.id)
    .eq("station_token", params.stationToken)
    .maybeSingle();
  if (!station) return makeResult("ERROR", "Invalid station link.");

  const { data: delegate } = await admin
    .from("delegates")
    .select("*")
    .eq("dataset_id", dataset.id)
    .eq("normalized_delegate_id", input)
    .maybeSingle();

  if (!delegate) {
    await admin.from("scan_logs").insert({
      dataset_id: dataset.id,
      station_id: station.id,
      scanned_input: input,
      result: "INVALID",
      message: `Invalid Delegate ID: ${input}`,
      operator_name: params.operatorName ?? null,
      scanned_by: params.scannedBy ?? null,
    });
    return makeResult("INVALID", `Invalid Delegate ID: ${input}`);
  }

  const { data: stationStatus } = await admin
    .from("delegate_station_status")
    .select("*")
    .eq("delegate_id", delegate.id)
    .eq("station_id", station.id)
    .maybeSingle();

  if (!stationStatus) {
    return makeResult("ERROR", "Station status row missing for delegate.", delegate);
  }

  if (dataset.require_registration_first && dataset.registration_station_id && dataset.registration_station_id !== station.id) {
    const { data: registrationStatus } = await admin
      .from("delegate_station_status")
      .select("status")
      .eq("delegate_id", delegate.id)
      .eq("station_id", dataset.registration_station_id)
      .maybeSingle();

    if (!registrationStatus || registrationStatus.status !== "USED") {
      const result = makeResult("NOT_REGISTERED", "Registration required before this station.", delegate);
      await admin.from("scan_logs").insert({
        dataset_id: dataset.id,
        station_id: station.id,
        delegate_id: delegate.id,
        scanned_input: input,
        result: result.status,
        message: result.message,
        operator_name: params.operatorName ?? null,
        scanned_by: params.scannedBy ?? null,
      });
      return result;
    }
  }

  if (!stationStatus.eligible) {
    const result = makeResult("NOT_ELIGIBLE", `Not eligible for ${station.label}.`, delegate);
    await admin.from("scan_logs").insert({
      dataset_id: dataset.id,
      station_id: station.id,
      delegate_id: delegate.id,
      scanned_input: input,
      result: result.status,
      message: result.message,
      operator_name: params.operatorName ?? null,
      scanned_by: params.scannedBy ?? null,
    });
    return result;
  }

  if (stationStatus.status === "USED") {
    const result = makeResult(
      "DUPLICATE",
      `Already scanned at ${station.label}${stationStatus.used_at ? ` on ${new Date(stationStatus.used_at).toLocaleString()}` : ""}.`,
      delegate,
    );
    await admin.from("scan_logs").insert({
      dataset_id: dataset.id,
      station_id: station.id,
      delegate_id: delegate.id,
      scanned_input: input,
      result: result.status,
      message: result.message,
      operator_name: params.operatorName ?? null,
      scanned_by: params.scannedBy ?? null,
    });
    return result;
  }

  const now = new Date().toISOString();
  await admin
    .from("delegate_station_status")
    .update({
      status: "USED",
      used_at: now,
      used_by: params.scannedBy ?? null,
    })
    .eq("id", stationStatus.id);

  const result = makeResult("ALLOWED", `${station.label} allowed and marked as used.`, delegate);
  await admin.from("scan_logs").insert({
    dataset_id: dataset.id,
    station_id: station.id,
    delegate_id: delegate.id,
    scanned_input: input,
    result: result.status,
    message: result.message,
    operator_name: params.operatorName ?? null,
    scanned_by: params.scannedBy ?? null,
  });

  await appendAuditLog({
    organizationId: params.organizationId,
    actorId: params.scannedBy ?? null,
    action: "scan_processed",
    payload: {
      stationId: station.id,
      delegateId: delegate.id,
      result: result.status,
    },
  });

  return result;
}
