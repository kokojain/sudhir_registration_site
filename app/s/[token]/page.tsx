import { notFound } from "next/navigation";
import { StaffScanner } from "@/components/staff-scanner";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

type Params = {
  params: Promise<{ token: string }>;
};

export default async function StationScannerPage({ params }: Params) {
  const { token } = await params;
  const admin = getAdminSupabaseClient();

  const { data: station } = await admin
    .from("stations")
    .select("id,label,station_token,dataset_id")
    .eq("station_token", token)
    .maybeSingle();

  if (!station) {
    notFound();
  }

  const [delegatesCountRes, usedCountRes] = await Promise.all([
    admin.from("delegates").select("id", { count: "exact", head: true }).eq("dataset_id", station.dataset_id),
    admin
      .from("delegate_station_status")
      .select("id", { count: "exact", head: true })
      .eq("station_id", station.id)
      .eq("status", "USED"),
  ]);

  const initialStats = {
    stationLabel: station.label,
    totalDelegates: delegatesCountRes.count ?? 0,
    usedAtStation: usedCountRes.count ?? 0,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <StaffScanner
        stationToken={station.station_token}
        stationLabel={station.label}
        initialStats={initialStats}
      />
    </div>
  );
}
