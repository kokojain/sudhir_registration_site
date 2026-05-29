"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type AdminStateResponse = {
  hasDataset: boolean;
  dataset: {
    id: string;
    name: string;
    require_registration_first: boolean;
    registration_station_id: string | null;
    created_at: string;
    source_filename: string | null;
  } | null;
  stations: Array<{ id: string; label: string }>;
  stationLinks: Array<{ stationId: string; label: string; token: string; url: string }>;
  scanLogs: Array<{ id: string; result: string; message: string; operator_name: string | null; created_at: string }>;
  auditLogs: Array<{ id: string; action: string; payload: unknown; created_at: string }>;
};

export function AdminDashboard({ initialState }: { initialState: AdminStateResponse }) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [registrationStationId, setRegistrationStationId] = useState(
    initialState.dataset?.registration_station_id ?? "",
  );
  const [registrationFirst, setRegistrationFirst] = useState(
    initialState.dataset?.require_registration_first ?? true,
  );

  const linksText = useMemo(
    () => state.stationLinks.map((link) => `${link.label} -> ${link.url}`).join("\n"),
    [state.stationLinks],
  );

  const refreshState = useCallback(async () => {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/state");
    const body = (await response.json()) as AdminStateResponse | { error?: string };
    if (!response.ok) {
      setMessage((body as { error?: string }).error ?? "Failed to fetch admin state.");
      setBusy(false);
      return;
    }
    const next = body as AdminStateResponse;
    setState(next);
    setRegistrationFirst(next.dataset?.require_registration_first ?? true);
    setRegistrationStationId(next.dataset?.registration_station_id ?? "");
    setBusy(false);
  }, []);

  async function uploadDataset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fileInput = event.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) {
      setMessage("Choose an Excel/CSV file first.");
      return;
    }

    setBusy(true);
    setMessage("Uploading and processing dataset...");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/admin/dataset/upload", {
      method: "POST",
      body: form,
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(body.error ?? "Dataset upload failed.");
      setBusy(false);
      return;
    }

    setMessage("Dataset uploaded successfully.");
    await refreshState();
    fileInput.value = "";
    setBusy(false);
  }

  async function saveSettings() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requireRegistrationFirst: registrationFirst,
        registrationStationId: registrationStationId || null,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage(body.error ?? "Failed to save settings.");
      setBusy(false);
      return;
    }

    setMessage("Settings updated.");
    await refreshState();
    setBusy(false);
  }

  async function signOut() {
    const supabase = getBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Admin Controls</h2>
            <p className="text-sm text-slate-600">
              Upload datasets, configure stations, and monitor operations.
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Dataset Upload</h3>
          <p className="mt-1 text-sm text-slate-600">
            Upload a new Excel/CSV file. This becomes the active dataset.
          </p>
          <form onSubmit={uploadDataset} className="mt-4 space-y-3">
            <input
              type="file"
              name="file"
              accept=".xlsx,.xls,.csv"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                disabled={busy}
                className="rounded-md bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:opacity-60"
                type="submit"
              >
                Upload
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={refreshState}
                className="rounded-md border border-slate-300 px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
              >
                Refresh
              </button>
              <a
                href="/api/admin/export"
                className="rounded-md border border-emerald-300 px-4 py-2 text-emerald-700 hover:bg-emerald-50"
              >
                Download Excel
              </a>
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Dataset Settings</h3>
          <p className="mt-1 text-sm text-slate-600">
            Configure registration-first policy and registration station.
          </p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={registrationFirst}
                onChange={(event) => setRegistrationFirst(event.target.checked)}
              />
              Require registration before all other stations
            </label>
            <label className="block text-sm text-slate-700">
              Registration station
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={registrationStationId}
                onChange={(event) => setRegistrationStationId(event.target.value)}
              >
                <option value="">None</option>
                {state.stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={saveSettings}
              className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-60"
            >
              Save settings
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Current Active Dataset</h3>
        {state.dataset ? (
          <div className="mt-2 text-sm text-slate-700">
            <p>
              <span className="font-medium">Name:</span> {state.dataset.name}
            </p>
            <p>
              <span className="font-medium">Source:</span>{" "}
              {state.dataset.source_filename ?? "N/A"}
            </p>
            <p>
              <span className="font-medium">Created:</span>{" "}
              {new Date(state.dataset.created_at).toLocaleString()}
            </p>
            <p>
              <span className="font-medium">Stations:</span> {state.stations.length}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No active dataset.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Station Links</h3>
        <p className="mt-1 text-sm text-slate-600">
          Share one link per counter/station.
        </p>
        <textarea
          className="mt-3 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          readOnly
          value={linksText}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Recent Scan Logs</h3>
          <div className="mt-3 max-h-80 overflow-auto text-sm">
            {state.scanLogs.length ? (
              state.scanLogs.map((log) => (
                <div key={log.id} className="border-b border-slate-100 py-2">
                  <p className="font-medium text-slate-900">{log.result}</p>
                  <p className="text-slate-700">{log.message}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(log.created_at).toLocaleString()}
                    {log.operator_name ? ` · ${log.operator_name}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-slate-500">No logs yet.</p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Admin Audit Trail</h3>
          <div className="mt-3 max-h-80 overflow-auto text-sm">
            {state.auditLogs.length ? (
              state.auditLogs.map((log) => (
                <div key={log.id} className="border-b border-slate-100 py-2">
                  <p className="font-medium text-slate-900">{log.action}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-slate-500">No audit logs yet.</p>
            )}
          </div>
        </div>
      </section>

      {message ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
