"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import SpeedChart from "@/components/SpeedChart";
import StatsCard from "@/components/StatsCard";
import IntervalTable from "@/components/IntervalTable";

interface Interval {
  sec: number;
  dir: string;
  speed_mbps: number;
  bytes: number;
  local_cpu: number | null;
  remote_cpu: number | null;
  lost: number | null;
}

interface RunDetail {
  id: string;
  timestamp: string;
  server: string;
  protocol: string;
  direction: string;
  duration_sec: number;
  tx_avg_mbps: number;
  rx_avg_mbps: number;
  tx_bytes: number;
  rx_bytes: number;
  lost: number;
  public_ip: string | null;
  lan_ip: string | null;
  ssid: string | null;
  device_id: string | null;
  created_at: string;
  intervals: Interval[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function ViewResultPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchRun() {
      try {
        setLoading(true);
        const res = await fetch(`/api/results/${id}`);
        if (res.status === 404) {
          setError("Test run not found.");
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch result");
        const data = (await res.json()) as RunDetail;
        if (!cancelled) setRun(data);
      } catch {
        if (!cancelled) setError("Failed to load test result.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Check if user is logged in (to show owner actions)
    async function checkOwner() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          setIsOwner(true);
        }
      } catch {
        // Not logged in — that's fine
      }
    }

    fetchRun();
    checkOwner();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDownloadCsv() {
    try {
      const res = await fetch(`/api/results/${id}/csv`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        `btest-${id.split("-")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download CSV.");
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete this test run? This cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/results/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
      router.push("/dashboard");
    } catch {
      setError("Failed to delete test run.");
      setDeleting(false);
    }
  }

  function handleShare() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "#333333", borderTopColor: "#42A5F5" }}
          />
          <p className="text-sm" style={{ color: "#9E9E9E" }}>
            Loading test result...
          </p>
        </div>
      </div>
    );
  }

  if (error && !run) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <div
          className="rounded-lg px-6 py-4 text-sm"
          style={{
            backgroundColor: "rgba(239, 83, 80, 0.1)",
            color: "#EF5350",
            border: "1px solid rgba(239, 83, 80, 0.25)",
          }}
        >
          {error}
        </div>
        <a
          href="/"
          className="text-sm font-medium underline"
          style={{ color: "#42A5F5" }}
        >
          Go Home
        </a>
      </div>
    );
  }

  if (!run) return null;

  const totalLost = run.intervals.reduce(
    (sum, i) => sum + (i.lost ?? 0),
    0
  );

  const metadata: { label: string; value: string }[] = [
    { label: "Server", value: run.server },
    { label: "Protocol", value: run.protocol },
    { label: "Direction", value: run.direction },
    { label: "Duration", value: formatDuration(run.duration_sec) },
    { label: "Timestamp", value: formatTimestamp(run.timestamp) },
    { label: "Public IP", value: run.public_ip ?? "-" },
    { label: "LAN IP", value: run.lan_ip ?? "-" },
    { label: "SSID", value: run.ssid ?? "-" },
    { label: "Device", value: run.device_id ?? "-" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#121212" }}>
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Back link */}
        <a
          href={isOwner ? "/dashboard" : "/"}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: "#42A5F5" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "0.8";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M10.5 13L5.5 8L10.5 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {isOwner ? "Dashboard" : "Home"}
        </a>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "#FFFFFF" }}>
            Test Result
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#9E9E9E" }}>
            {formatTimestamp(run.timestamp)}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="mb-6 rounded-lg px-4 py-3 text-sm"
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

        {/* Metadata grid */}
        <div
          className="mb-8 grid grid-cols-1 gap-4 rounded-lg border p-6 sm:grid-cols-2 lg:grid-cols-3"
          style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
        >
          {metadata.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "#9E9E9E" }}
              >
                {item.label}
              </span>
              <span className="text-sm font-medium" style={{ color: "#FFFFFF" }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Speed chart */}
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold" style={{ color: "#FFFFFF" }}>
            Speed Over Time
          </h2>
          <SpeedChart intervals={run.intervals} />
        </div>

        {/* Statistics cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatsCard
            title="TX Average"
            value={`${run.tx_avg_mbps.toFixed(2)} Mbps`}
            color="#42A5F5"
          />
          <StatsCard
            title="RX Average"
            value={`${run.rx_avg_mbps.toFixed(2)} Mbps`}
            color="#66BB6A"
          />
          <StatsCard
            title="Total TX Bytes"
            value={formatBytes(run.tx_bytes)}
            subtitle={`${run.tx_bytes.toLocaleString()} bytes`}
          />
          <StatsCard
            title="Total RX Bytes"
            value={formatBytes(run.rx_bytes)}
            subtitle={`${run.rx_bytes.toLocaleString()} bytes`}
          />
          <StatsCard
            title="Lost Packets"
            value={totalLost.toLocaleString()}
            color={totalLost > 0 ? "#EF5350" : undefined}
          />
          <StatsCard
            title="Duration"
            value={formatDuration(run.duration_sec)}
            subtitle={`${run.duration_sec} seconds`}
          />
        </div>

        {/* Interval data */}
        <div className="mb-8">
          <IntervalTable intervals={run.intervals} />
        </div>

        {/* Actions */}
        <div
          className="flex flex-wrap gap-3 rounded-lg border p-6"
          style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
        >
          {/* Share — always visible */}
          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
            style={{
              backgroundColor: copied ? "#66BB6A" : "#42A5F5",
              color: "#FFFFFF",
            }}
          >
            {copied ? "Link Copied!" : "Share Link"}
          </button>

          {/* Owner-only actions */}
          {isOwner && (
            <>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-opacity"
                style={{
                  borderColor: "#42A5F5",
                  color: "#42A5F5",
                  backgroundColor: "transparent",
                }}
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                style={{
                  borderColor: "#EF5350",
                  color: "#EF5350",
                  backgroundColor: "transparent",
                }}
              >
                {deleting ? "Deleting..." : "Delete Run"}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
