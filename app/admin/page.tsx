import { requireRole } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin-dashboard";
import { buildAdminState } from "@/lib/admin-state";

export default async function AdminPage() {
  const context = await requireRole("admin");
  const initialState = await buildAdminState(context.organizationId);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <AdminDashboard initialState={initialState} />
    </div>
  );
}
