export function normalizeId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function normalizeLabel(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeHeader(value: unknown): string {
  return normalizeLabel(value).toUpperCase();
}

export function toStationKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseEligibleCell(value: unknown): boolean {
  const normalized = normalizeHeader(value);
  if (!normalized) return false;
  return !["NO", "N", "FALSE", "0", "NOT ELIGIBLE", "NA", "N/A"].includes(normalized);
}

export function nowIso() {
  return new Date().toISOString();
}

export function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}
