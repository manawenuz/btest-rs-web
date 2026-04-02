"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type AuthTab = "login" | "register";

interface AuthError {
  message: string;
}

export default function AuthForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint =
      activeTab === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as AuthError | null;
        const msg =
          body?.message ??
          (res.status === 401
            ? "Invalid email or password."
            : res.status === 409
              ? "An account with this email already exists."
              : res.status === 422
                ? "Please check your email and password."
                : "Something went wrong. Please try again.");
        setError(msg);
        return;
      }

      // Success -- the API sets an HTTP-only cookie in the response.
      // Redirect to dashboard.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleTabSwitch(tab: AuthTab) {
    setActiveTab(tab);
    setError(null);
  }

  return (
    <div
      className="w-full max-w-sm rounded-xl border p-6"
      style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
    >
      {/* Tabs */}
      <div
        className="mb-6 flex overflow-hidden rounded-lg border"
        style={{ borderColor: "#333333" }}
      >
        <button
          type="button"
          onClick={() => handleTabSwitch("login")}
          className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor: activeTab === "login" ? "#42A5F5" : "transparent",
            color: activeTab === "login" ? "#FFFFFF" : "#9E9E9E",
          }}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => handleTabSwitch("register")}
          className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor: activeTab === "register" ? "#42A5F5" : "transparent",
            color: activeTab === "register" ? "#FFFFFF" : "#9E9E9E",
          }}
        >
          Register
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="auth-email"
            className="text-xs font-medium"
            style={{ color: "#9E9E9E" }}
          >
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
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
            htmlFor="auth-password"
            className="text-xs font-medium"
            style={{ color: "#9E9E9E" }}
          >
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            required
            autoComplete={activeTab === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            minLength={8}
            className="rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
            style={{
              backgroundColor: "#121212",
              borderColor: "#333333",
              color: "#FFFFFF",
            }}
          />
        </div>

        {/* Error */}
        {error != null && (
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

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
          style={{
            backgroundColor: "#42A5F5",
            color: "#FFFFFF",
          }}
          onMouseEnter={(e) => {
            if (!loading) (e.currentTarget as HTMLElement).style.opacity = "0.85";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
        >
          {loading
            ? "Please wait..."
            : activeTab === "login"
              ? "Sign In"
              : "Create Account"}
        </button>
      </form>
    </div>
  );
}
