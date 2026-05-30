import { randomUUID } from "crypto";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeHeader, normalizeId, parseEligibleCell, toStationKey } from "@/lib/utils";

const ID_HEADERS = ["DELEGATE ID", "ID", "QR ID", "QR CODE", "DELEGATE CODE"];
const NAME_HEADERS = ["NAME", "FULL NAME", "DELEGATE NAME"];
const MOBILE_HEADERS = ["MOBILE", "MOBILE NUMBER", "PHONE", "PHONE NUMBER"];
const CATEGORY_HEADERS = ["CATEGORY", "TYPE", "GROUP"];
const ELIGIBILITY_SUFFIX = " ELIGIBILITY";
const STATUS_SUFFIX = " STATUS";
const IGNORED_GENERIC_SUFFIXES = [
  " TIME",
  " USED AT",
  " TIMESTAMP",
  " REMARK",
  " REMARKS",
  " NOTE",
  " NOTES",
];

type ParsedUpload = {
  delegateRows: Array<{
    delegateId: string;
    fullName: string;
    mobile: string;
    category: string;
    metadata: Record<string, string>;
    stationEligibility: Record<string, boolean>;
  }>;
  stations: Array<{
    label: string;
    stationKey: string;
  }>;
  registrationStationKey: string | null;
};

export function parseUploadRows(rows: unknown[][]): ParsedUpload {
  if (!rows.length) throw new Error("Uploaded file is empty.");
  const headers = (rows[0] ?? []).map((h) => String(h ?? "").trim());

  const delegateIdIndex = findIndex(headers, ID_HEADERS);
  if (delegateIdIndex < 0) {
    throw new Error("Missing Delegate ID column.");
  }

  const nameIndex = findIndex(headers, NAME_HEADERS);
  const mobileIndex = findIndex(headers, MOBILE_HEADERS);
  const categoryIndex = findIndex(headers, CATEGORY_HEADERS);

  const reserved = new Set<number>([delegateIdIndex, nameIndex, mobileIndex, categoryIndex].filter((x) => x >= 0));
  const stationColumns = selectStationColumns(headers, reserved);

  if (!stationColumns.length) {
    throw new Error("No station columns found. Add one or more station columns in Excel.");
  }

  const stations = stationColumns.map((item) => ({
    label: item.label,
    stationKey: item.stationKey,
  }));

  const registrationStationKey = detectRegistrationStationKey(stations);
  const delegateRows: ParsedUpload["delegateRows"] = [];

  rows.slice(1).forEach((row) => {
    const delegateId = normalizeId(row[delegateIdIndex]);
    if (!delegateId) return;

    const fullName = nameIndex >= 0 ? String(row[nameIndex] ?? "").trim() : "";
    const mobile = mobileIndex >= 0 ? String(row[mobileIndex] ?? "").trim() : "";
    const category = categoryIndex >= 0 ? String(row[categoryIndex] ?? "").trim() : "";

    const metadata: Record<string, string> = {};
    const stationIndexSet = new Set(stationColumns.map((x) => x.index));
    headers.forEach((header, index) => {
      if (!reserved.has(index) && !stationIndexSet.has(index) && header) {
        metadata[header] = String(row[index] ?? "");
      }
    });

    const stationEligibility: Record<string, boolean> = {};
    stationColumns.forEach((station) => {
      stationEligibility[station.stationKey] = parseEligibleCell(
        row[station.index],
        station.sourceType === "eligibility" ? false : true,
      );
    });

    delegateRows.push({
      delegateId,
      fullName,
      mobile,
      category,
      metadata,
      stationEligibility,
    });
  });

  return {
    delegateRows,
    stations,
    registrationStationKey,
  };
}

function selectStationColumns(headers: string[], reserved: Set<number>) {
  const candidates = headers
    .map((header, index) => ({
      header: String(header || "").trim(),
      normalized: normalizeHeader(header),
      index,
    }))
    .filter((item) => item.header && !reserved.has(item.index));

  const eligibilityColumns = candidates
    .filter((item) => item.normalized.endsWith(ELIGIBILITY_SUFFIX))
    .map((item) => {
      const baseLabel = item.header.replace(/ Eligibility$/i, "").trim();
      return {
        label: baseLabel,
        stationKey: toStationKey(baseLabel),
        index: item.index,
        sourceType: "eligibility" as const,
      };
    })
    .filter((item) => !isIgnoredStationBaseLabel(item.label))
    .filter((item) => item.stationKey);

  if (eligibilityColumns.length) {
    return ensureUniqueStationKeys(eligibilityColumns);
  }

  const statusColumns = candidates
    .filter((item) => item.normalized.endsWith(STATUS_SUFFIX))
    .map((item) => {
      const baseLabel = item.header.replace(/ Status$/i, "").trim();
      const baseNormalized = normalizeHeader(baseLabel);
      const normalizedLabel = baseNormalized.endsWith(STATUS_SUFFIX)
        ? baseLabel
        : item.header;
      return {
        label: normalizedLabel,
        stationKey: toStationKey(normalizedLabel),
        index: item.index,
        sourceType: "status" as const,
        baseLabel,
      };
    })
    .filter((item) => !isIgnoredStationBaseLabel(item.baseLabel))
    .filter((item) => item.stationKey);

  if (statusColumns.length) {
    return ensureUniqueStationKeys(statusColumns);
  }

  const genericColumns = candidates
    .filter((item) => !isIgnoredStationBaseLabel(item.header))
    .map((item) => ({
      label: item.header,
      stationKey: toStationKey(item.header),
      index: item.index,
      sourceType: "generic" as const,
    }))
    .filter((item) => item.stationKey);

  return ensureUniqueStationKeys(genericColumns);
}

function isIgnoredStationBaseLabel(label: string) {
  const normalized = normalizeHeader(label);
  return IGNORED_GENERIC_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function ensureUniqueStationKeys<T extends { stationKey: string }>(columns: T[]) {
  const keySeen = new Set<string>();
  columns.forEach((column) => {
    const base = column.stationKey;
    let final = base;
    let i = 2;
    while (keySeen.has(final)) {
      final = `${base}_${i}`;
      i += 1;
    }
    keySeen.add(final);
    column.stationKey = final;
  });
  return columns;
}

function findIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.includes(normalizeHeader(header)));
}

function detectRegistrationStationKey(
  stations: Array<{ label: string; stationKey: string }>,
): string | null {
  for (const station of stations) {
    const normalized = normalizeHeader(station.label);
    if (normalized.includes("REGISTRATION") || normalized.includes("ENTRY") || normalized === "REGISTER") {
      return station.stationKey;
    }
  }
  return stations[0]?.stationKey ?? null;
}

export async function getActiveDataset(organizationId: string) {
  const admin = getAdminSupabaseClient();
  const { data } = await admin
    .from("datasets")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export async function createDatasetFromUpload(params: {
  organizationId: string;
  actorId: string;
  fileName: string;
  rows: unknown[][];
}) {
  const { organizationId, actorId, fileName, rows } = params;
  const admin = getAdminSupabaseClient();
  const parsed = parseUploadRows(rows);

  await admin
    .from("datasets")
    .update({ is_active: false })
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  const { data: dataset, error: datasetError } = await admin
    .from("datasets")
    .insert({
      organization_id: organizationId,
      name: `Dataset ${new Date().toLocaleString()}`,
      source_filename: fileName,
      is_active: true,
      require_registration_first: true,
      uploaded_by: actorId,
    })
    .select("*")
    .single();

  if (datasetError || !dataset) {
    throw new Error(datasetError?.message ?? "Failed to create dataset.");
  }

  const stationRows = parsed.stations.map((station, index) => ({
    dataset_id: dataset.id,
    label: station.label,
    station_key: station.stationKey,
    station_token: randomUUID(),
    ordinal: index + 1,
  }));

  const { data: insertedStations, error: stationError } = await admin
    .from("stations")
    .insert(stationRows)
    .select("*");

  if (stationError || !insertedStations) {
    throw new Error(stationError?.message ?? "Failed to create stations.");
  }

  const registrationStation = insertedStations.find(
    (station) => station.station_key === parsed.registrationStationKey,
  );
  if (registrationStation) {
    await admin
      .from("datasets")
      .update({ registration_station_id: registrationStation.id })
      .eq("id", dataset.id);
  }

  const delegatePayload = dedupeDelegates(parsed.delegateRows).map((row) => ({
    dataset_id: dataset.id,
    delegate_id: row.delegateId,
    normalized_delegate_id: normalizeId(row.delegateId),
    full_name: row.fullName || null,
    mobile: row.mobile || null,
    category: row.category || null,
    metadata: row.metadata,
  }));

  const { data: insertedDelegates, error: delegateError } = await admin
    .from("delegates")
    .insert(delegatePayload)
    .select("id, normalized_delegate_id");
  if (delegateError || !insertedDelegates) {
    throw new Error(delegateError?.message ?? "Failed to insert delegates.");
  }

  const delegateIdMap = new Map<string, string>();
  insertedDelegates.forEach((d) => delegateIdMap.set(d.normalized_delegate_id, d.id));

  const stationByKey = new Map(insertedStations.map((s) => [s.station_key, s.id] as const));
  const statusRows = dedupeDelegates(parsed.delegateRows).flatMap((delegate) => {
    const delegateDbId = delegateIdMap.get(normalizeId(delegate.delegateId));
    if (!delegateDbId) return [];
    return parsed.stations.map((station) => {
      const eligible = delegate.stationEligibility[station.stationKey] ?? false;
      return {
        delegate_id: delegateDbId,
        station_id: stationByKey.get(station.stationKey),
        eligible,
        status: eligible ? "PENDING" : "NOT_ELIGIBLE",
      };
    });
  });

  if (statusRows.length) {
    const { error: statusError } = await admin.from("delegate_station_status").insert(statusRows);
    if (statusError) throw new Error(statusError.message);
  }

  await appendAuditLog({
    organizationId,
    actorId,
    action: "dataset_uploaded",
    payload: {
      datasetId: dataset.id,
      stations: insertedStations.length,
      delegates: insertedDelegates.length,
      sourceFilename: fileName,
    },
  });

  return dataset.id;
}

function dedupeDelegates(
  rows: ParsedUpload["delegateRows"],
): ParsedUpload["delegateRows"] {
  const map = new Map<string, ParsedUpload["delegateRows"][number]>();
  rows.forEach((row) => {
    const key = normalizeId(row.delegateId);
    if (!map.has(key)) map.set(key, row);
  });
  return [...map.values()];
}

export async function appendAuditLog(params: {
  organizationId: string;
  actorId: string | null;
  action: string;
  payload: Record<string, unknown>;
}) {
  const admin = getAdminSupabaseClient();
  await admin.from("admin_audit_logs").insert({
    organization_id: params.organizationId,
    actor_id: params.actorId,
    action: params.action,
    payload: params.payload,
  });
}
