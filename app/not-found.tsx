export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-16">
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Page not found</h2>
        <p className="mt-2 text-slate-600">
          The link may be invalid or expired.
        </p>
      </div>
    </div>
  );
}
