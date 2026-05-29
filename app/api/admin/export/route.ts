import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireApiAdmin } from "@/lib/api-auth";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";
import { getActiveDataset } from "@/lib/data";

export async function GET() {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;

  const dataset = await getActiveDataset(auth.user.organizationId);
  if (!dataset) {
    return NextResponse.json({ error: "No active dataset." }, { status: 404 });
  }

  const admin = getAdminSupabaseClient();
  const [stationsRes, delegatesRes, logsRes, auditRes] = await Promise.all([
    admin.from("stations").select("id,label,station_key,ordinal").eq("dataset_id", dataset.id).order("ordinal"),
    admin
      .from("delegates")
      .select("id,delegate_id,full_name,mobile,category,metadata")
      .eq("dataset_id", dataset.id)
      .order("delegate_id"),
    admin
      .from("scan_logs")
      .select("created_at,scanned_input,result,message,operator_name")
      .eq("dataset_id", dataset.id)
      .order("created_at"),
    admin
      .from("admin_audit_logs")
      .select("created_at,action,payload")
      .eq("organization_id", auth.user.organizationId)
      .order("created_at"),
  ]);

  const stations = stationsRes.data ?? [];
  const delegates = delegatesRes.data ?? [];
  const delegateIds = delegates.map((delegate) => delegate.id);
  const statusesRes =
    delegateIds.length > 0
      ? await admin
          .from("delegate_station_status")
          .select("delegate_id,station_id,eligible,status,used_at")
          .in("delegate_id", delegateIds)
      : { data: [] };
  const statusRows = statusesRes.data ?? [];
  const statusMap = new Map<string, { eligible: boolean; status: string; used_at: string | null }>();
  statusRows.forEach((row) => {
    statusMap.set(`${row.delegate_id}:${row.station_id}`, row);
  });

  const delegatesSheetRows = delegates.map((delegate) => {
    const row: Record<string, string> = {
      "Delegate ID": delegate.delegate_id,
      Name: delegate.full_name ?? "",
      Mobile: delegate.mobile ?? "",
      Category: delegate.category ?? "",
    };

    stations.forEach((station) => {
      const status = statusMap.get(`${delegate.id}:${station.id}`);
      row[`${station.label} Eligibility`] = status?.eligible ? "YES" : "NO";
      row[`${station.label} Status`] = status?.status ?? "";
      row[`${station.label} Used At`] = status?.used_at ?? "";
    });
    return row;
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(delegatesSheetRows),
    "Delegates",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(logsRes.data ?? []),
    "Scan Log",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(auditRes.data ?? []),
    "Admin Audit",
  );

  const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = `${dataset.name.replace(/[^a-zA-Z0-9_-]+/g, "_") || "dataset"}_export.xlsx`;

  return new NextResponse(output, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
