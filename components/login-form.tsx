"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const supabase = getBrowserSupabaseClient();
      const signInResult = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        15000,
      );
      if (signInResult.error) {
        setMessage(signInResult.error.message);
        return;
      }
      const accessToken = signInResult.data.session?.access_token;
      if (!accessToken) {
        setMessage("Login succeeded but no session token was returned.");
        return;
      }

      const bootstrapController = new AbortController();
      const bootstrap = await withTimeout(
        fetch("/api/auth/bootstrap-profile", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: bootstrapController.signal,
        }),
        15000,
        () => bootstrapController.abort(),
      );

      if (!bootstrap.ok) {
        const body = (await bootstrap.json().catch(() => ({}))) as { error?: string };
        setMessage(body.error ?? "Could not initialize profile.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Login failed due to network/server issue.";
      setMessage(message);
    } finally {
      setLoading(false);
    }
  }

  function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    onTimeout?: () => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        onTimeout?.();
        reject(new Error("Request timed out. Please try again."));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Admin Login</h2>
        <p className="mt-1 text-sm text-slate-600">
          Use your Supabase Auth user credentials.
        </p>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Email
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Password
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      {message ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {message}
        </p>
      ) : null}

      <button
        className="w-full rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        type="submit"
        disabled={loading}
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
