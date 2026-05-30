"use client";

import { useMemo, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import type { ScanResult } from "@/lib/types";

type StaffScannerProps = {
  stationToken: string;
  stationLabel: string;
  initialStats: StaffStats | null;
};

type StaffStats = {
  stationLabel: string;
  totalDelegates: number;
  usedAtStation: number;
};

type CameraOption = {
  id: string;
  label: string;
};

const INITIAL_RESULT: ScanResult = {
  status: "ALLOWED",
  message: "Ready to scan.",
  delegateId: "",
  name: "",
  category: "",
  timestamp: "",
};

export function StaffScanner({ stationToken, stationLabel, initialStats }: StaffScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [operatorName, setOperatorName] = useState("");
  const [manualId, setManualId] = useState("");
  const [result, setResult] = useState<ScanResult>(INITIAL_RESULT);
  const [lastScans, setLastScans] = useState<ScanResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [stats, setStats] = useState<StaffStats | null>(initialStats);
  const [cameraOptions, setCameraOptions] = useState<CameraOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");

  async function refreshStats() {
    const response = await fetch(`/api/staff/stats/${stationToken}`);
    const payload = (await response.json()) as StaffStats | { error?: string };
    if (!response.ok) return;
    setStats(payload as StaffStats);
  }

  async function loadCameraOptions() {
    try {
      const { Html5Qrcode: QrScanner } = await import("html5-qrcode");
      const cameras = await QrScanner.getCameras();
      const options = cameras.map((camera, index) => ({
        id: camera.id,
        label: camera.label?.trim() || `Camera ${index + 1}`,
      }));
      setCameraOptions(options);
      setSelectedCameraId((current) => current || options[0]?.id || "");
    } catch {
      setCameraOptions([]);
      setSelectedCameraId("");
    }
  }

  async function startScanner() {
    if (busy || isRunning || isStartingCamera) return;
    setIsStartingCamera(true);
    const { Html5Qrcode: QrScanner } = await import("html5-qrcode");
    try {
      if (scannerRef.current) {
        await stopScanner(false);
      }
      const scanner = new QrScanner("reader");
      scannerRef.current = scanner;
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      };

      await requestCameraPermissionPreflight();

      let candidates: Array<string | { facingMode: "environment" | "user" }> = [
        { facingMode: "environment" },
        { facingMode: "user" },
      ];

      try {
        const cameras = await QrScanner.getCameras();
        if (cameras?.length) {
          const rearCamera = cameras.find((camera) =>
            /back|rear|environment/i.test(camera.label || ""),
          );
          const frontCamera = cameras.find((camera) =>
            /front|user|facetime/i.test(camera.label || ""),
          );
          const ordered = [
            selectedCameraId,
            rearCamera?.id || "",
            frontCamera?.id || "",
            cameras[0].id,
          ].filter(Boolean) as string[];
          const uniqueOrdered = [...new Set(ordered)];
          candidates = [...uniqueOrdered, ...candidates];
          const options = cameras.map((camera, index) => ({
            id: camera.id,
            label: camera.label?.trim() || `Camera ${index + 1}`,
          }));
          setCameraOptions(options);
        }
      } catch {
        // Keep fallback candidates.
      }

      for (const candidate of candidates) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            await withTimeout(
              scanner.start(
                candidate,
                config,
                (decodedText) => {
                  if (busy) return;
                  setBusy(true);
                  void stopScanner(false).then(() => submitScan(decodedText));
                },
                () => {},
              ),
              10000,
            );
            setIsRunning(true);
            return;
          } catch {
            await sleep(250);
          }
        }
      }

      setResult({
        status: "ERROR",
        message:
          "Camera could not start reliably. Allow camera permission in Safari settings, pick front/rear explicitly, then retry.",
        delegateId: "",
        name: "",
        category: "",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsStartingCamera(false);
    }
  }

  async function stopScanner(resetBusy = true) {
    if (!scannerRef.current || !isRunning) {
      if (resetBusy) setBusy(false);
      setIsRunning(false);
      return;
    }

    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
    } catch {
      // Ignore close errors.
    } finally {
      setIsRunning(false);
      if (resetBusy) setBusy(false);
    }
  }

  async function submitScan(rawId: string) {
    const response = await fetch("/api/staff/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stationToken,
        delegateId: rawId,
        operatorName,
      }),
    });
    const payload = (await response.json()) as ScanResult | { error?: string };

    if (!response.ok) {
      setResult({
        status: "ERROR",
        message: (payload as { error?: string }).error ?? "Scan request failed.",
        delegateId: "",
        name: "",
        category: "",
        timestamp: new Date().toISOString(),
      });
      setBusy(false);
      return;
    }

    const scanResult = payload as ScanResult;
    setResult(scanResult);
    setLastScans((prev) => [scanResult, ...prev].slice(0, 12));
    setBusy(false);
    void refreshStats();
  }

  function openPhotoPicker() {
    photoInputRef.current?.click();
  }

  async function onPhotoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    try {
      const { Html5Qrcode: QrScanner } = await import("html5-qrcode");
      const qr = new QrScanner("reader");
      const decoded = await qr.scanFile(file, true);
      await submitScan(decoded);
    } catch (error) {
      setResult({
        status: "ERROR",
        message:
          error instanceof Error
            ? `Could not read QR from photo: ${error.message}`
            : "Could not read QR from photo.",
        delegateId: "",
        name: "",
        category: "",
        timestamp: new Date().toISOString(),
      });
      setBusy(false);
    } finally {
      if (event.target) event.target.value = "";
    }
  }

  async function testCameraAccess() {
    try {
      await requestCameraPermissionPreflight();
      setResult({
        status: "ALLOWED",
        message:
          "Camera permission looks OK. If stream still fails, try Refresh cameras or Scan from photo.",
        delegateId: "",
        name: "",
        category: "",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setResult({
        status: "ERROR",
        message: `Camera test failed: ${detail}`,
        delegateId: "",
        name: "",
        category: "",
        timestamp: new Date().toISOString(),
      });
    }
  }

  function submitManual() {
    if (!manualId.trim() || busy) return;
    setBusy(true);
    void stopScanner(false).then(() => submitScan(manualId.trim()));
    setManualId("");
  }

  async function startWithSelectedCamera() {
    await stopScanner(false);
    await startScanner();
  }

  async function requestCameraPermissionPreflight() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Camera startup timed out.")), timeoutMs);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  const resultClass = useMemo(() => {
    const status = result.status.toLowerCase();
    if (status === "allowed") return "border-emerald-300 bg-emerald-50";
    if (status === "duplicate") return "border-amber-300 bg-amber-50";
    if (status === "invalid" || status === "error" || status === "not_registered" || status === "not_eligible") {
      return "border-rose-300 bg-rose-50";
    }
    return "border-slate-200 bg-white";
  }, [result.status]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{stationLabel}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Scan QR codes for this station link.
        </p>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Operator name
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={operatorName}
            onChange={(event) => setOperatorName(event.target.value)}
            placeholder="Counter staff name"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Camera
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={selectedCameraId}
            onChange={(event) => setSelectedCameraId(event.target.value)}
          >
            {!cameraOptions.length ? (
              <option value="">Auto (front/back fallback)</option>
            ) : null}
            {cameraOptions.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.label}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadCameraOptions()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
          >
            Refresh cameras
          </button>
          <button
            type="button"
            onClick={() => {
              const rear = cameraOptions.find((camera) =>
                /back|rear|environment/i.test(camera.label),
              );
              if (rear) setSelectedCameraId(rear.id);
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
          >
            Use rear
          </button>
          <button
            type="button"
            onClick={() => {
              const front = cameraOptions.find((camera) =>
                /front|user|facetime/i.test(camera.label),
              );
              if (front) setSelectedCameraId(front.id);
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
          >
            Use front
          </button>
        </div>

        <div
          id="reader"
          className="mt-3 flex min-h-72 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500"
        >
          {isRunning ? "Scanner active..." : "Camera scanner appears here."}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void startWithSelectedCamera()}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Start camera
          </button>
          <button
            type="button"
            onClick={() => void stopScanner()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Stop camera
          </button>
          <button
            type="button"
            onClick={() => {
              setBusy(false);
              void startWithSelectedCamera();
            }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Scan next
          </button>
          <button
            type="button"
            onClick={openPhotoPicker}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Scan from photo
          </button>
          <button
            type="button"
            onClick={() => void testCameraAccess()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Camera test
          </button>
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => void onPhotoSelected(event)}
        />

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Manual delegate ID
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={manualId}
            onChange={(event) => setManualId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitManual();
              }
            }}
            placeholder="Type delegate ID if camera fails"
          />
        </label>
        <button
          type="button"
          onClick={submitManual}
          className="mt-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Submit manual ID
        </button>
      </section>

      <section className="space-y-4">
        <div className={`rounded-xl border p-6 shadow-sm ${resultClass}`}>
          <p className="text-3xl font-black text-slate-900">{result.status}</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{result.message}</p>
          <p className="mt-2 text-sm text-slate-700">
            {result.name ? `${result.name} · ` : ""}
            {result.delegateId}
          </p>
          <p className="text-xs text-slate-500">
            {result.timestamp ? new Date(result.timestamp).toLocaleString() : ""}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Station Stats</h3>
          {stats ? (
            <p className="mt-2 text-sm text-slate-700">
              Total delegates: {stats.totalDelegates} · Used at station: {stats.usedAtStation}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Loading stats...</p>
          )}
          <button
            type="button"
            onClick={() => void refreshStats()}
            className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Refresh stats
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Last Scans</h3>
          <div className="mt-3 max-h-56 overflow-auto text-sm">
            {lastScans.length ? (
              lastScans.map((item, index) => (
                <div key={`${item.timestamp}-${index}`} className="border-b border-slate-100 py-2">
                  <p className="font-medium text-slate-900">
                    {item.status} - {item.message}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.name ? `${item.name} · ` : ""}
                    {item.delegateId} · {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-slate-500">No scans yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
