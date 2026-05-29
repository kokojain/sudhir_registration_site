import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireApiAdmin } from "@/lib/api-auth";
import { createDatasetFromUpload } from "@/lib/data";

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if ("error" in auth) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file upload." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return NextResponse.json({ error: "Could not read worksheet." }, { status: 400 });
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  if (!rows.length) {
    return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
  }

  try {
    const datasetId = await createDatasetFromUpload({
      organizationId: auth.user.organizationId,
      actorId: auth.user.id,
      fileName: file.name,
      rows,
    });
    return NextResponse.json({ ok: true, datasetId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload dataset.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
