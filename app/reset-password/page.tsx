"use client";

import { useState, Suspense, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        className="w-full max-w-sm rounded-xl border p-6 text-center"
        style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
      >
        <div
          className="mb-4 text-4xl"
          style={{ color: "#66BB6A" }}
        >
          &#10003;
        </div>
        <h2 className="text-lg font-semibold mb-2">Password Reset</h2>
        <p className="text-sm mb-6" style={{ color: "#9E9E9E" }}>
          Your password has been reset successfully.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg px-6 py-2.5 text-sm font-medium"
          style={{ backgroundColor: "#42A5F5", color: "#FFFFFF" }}
        >
          Go to Login
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div
        className="w-full max-w-sm rounded-xl border p-6 text-center"
        style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
      >
        <h2 className="text-lg font-semibold mb-2" style={{ color: "#EF5350" }}>
          Invalid Reset Link
        </h2>
        <p className="text-sm mb-6" style={{ color: "#9E9E9E" }}>
          This link is invalid or has expired. Please request a new password reset.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg px-6 py-2.5 text-sm font-medium"
          style={{ backgroundColor: "#42A5F5", color: "#FFFFFF" }}
        >
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-sm rounded-xl border p-6"
      style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
    >
      <h2 className="text-lg font-semibold mb-1">Reset Password</h2>
      <p className="text-sm mb-6" style={{ color: "#9E9E9E" }}>
        Enter your new password below.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="new-password"
            className="text-xs font-medium"
            style={{ color: "#9E9E9E" }}
          >
            New Password
          </label>
          <input
            id="new-password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            minLength={8}
            className="rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
            style={{
              backgroundColor: "#121212",
              borderColor: "#333333",
              color: "#FFFFFF",
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirm-password"
            className="text-xs font-medium"
            style={{ color: "#9E9E9E" }}
          >
            Confirm Password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
            minLength={8}
            className="rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
            style={{
              backgroundColor: "#121212",
              borderColor: "#333333",
              color: "#FFFFFF",
            }}
          />
        </div>

        {error && (
          <div
            className="rounded-lg px-3 py-2.5 text-sm"
            style={{
              backgroundColor: "rgba(239, 83, 80, 0.1)",
              color: "#EF5350",
              border: "1px solid rgba(239, 83, 80, 0.25)",
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "#42A5F5", color: "#FFFFFF" }}
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">
          btest-rs<span style={{ color: "#42A5F5" }}>-web</span>
        </h1>
      </div>
      <Suspense
        fallback={
          <div style={{ color: "#9E9E9E" }}>Loading...</div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
