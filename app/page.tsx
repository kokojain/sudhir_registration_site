export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Registration Scanner Cloud</h1>
        <p className="mt-3 text-slate-600">
          This web app runs on Next.js + Supabase and can be hosted on Vercel or any cloud provider.
          Admins upload Excel datasets, configure stations, and share station links with staff.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            className="rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700"
            href="/login"
          >
            Admin Login
          </a>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            href="/admin"
          >
            Admin Dashboard
          </a>
        </div>
      </section>
    </div>
  );
}
