export default function StaffInfoPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-16">
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Open a station link</h2>
        <p className="mt-2 text-slate-600">
          Staff should use the station-specific link shared by admin, e.g. <code>/s/&lt;token&gt;</code>.
        </p>
      </div>
    </div>
  );
}
