import { env } from "@/lib/env";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";
import { getActiveDataset } from "@/lib/data";

export async function buildAdminState(organizationId: string) {
  const admin = getAdminSupabaseClient();
  const dataset = await getActiveDataset(organizationId);

  if (!dataset) {
    return {
      hasDataset: false,
      dataset: null,
      stations: [],
      stationLinks: [],
      scanLogs: [],
      auditLogs: [],
    };
  }

  const [stationsRes, scanLogsRes, auditLogsRes] = await Promise.all([
    admin
      .from("stations")
      .select("id,label,station_key,station_token,ordinal")
      .eq("dataset_id", dataset.id)
      .order("ordinal", { ascending: true }),
    admin
      .from("scan_logs")
      .select("id,result,message,operator_name,created_at,scanned_input")
      .eq("dataset_id", dataset.id)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("admin_audit_logs")
      .select("id,action,payload,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const stations = stationsRes.data ?? [];
  const stationLinks = stations.map((station) => ({
    stationId: station.id,
    label: station.label,
    token: station.station_token,
    url: `${env.appUrl}/s/${station.station_token}`,
  }));

  return {
    hasDataset: true,
    dataset,
    stations,
    stationLinks,
    scanLogs: scanLogsRes.data ?? [],
    auditLogs: auditLogsRes.data ?? [],
  };
}
