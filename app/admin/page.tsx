import { AdminDashboard } from "@/components/admin-dashboard";
export default function AdminPage() {
  const initialState = {
    hasDataset: false,
    dataset: null,
    stations: [],
    stationLinks: [],
    scanLogs: [],
    auditLogs: [],
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <AdminDashboard initialState={initialState} />
    </div>
  );
}
