"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import StatsCard from "@/components/StatsCard";
import Filters from "@/components/Filters";
import RunTable from "@/components/RunTable";

interface UserInfo {
  id: string;
  email: string;
  api_key: string;
  created_at: string;
}

interface Run {
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
}

interface FilterValues {
  server?: string;
  protocol?: string;
  from?: string;
  to?: string;
}

interface PaginatedResults {
  runs: Run[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_LIMIT = 20;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [results, setResults] = useState<PaginatedResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterValues>({});
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState(false);

  // Derive unique servers from all loaded runs
  const servers = results
    ? Array.from(new Set(results.runs.map((r) => r.server))).sort()
    : [];

  const fetchResults = useCallback(
    async (currentPage: number, currentFilters: FilterValues) => {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(PAGE_LIMIT));
      if (currentFilters.server) params.set("server", currentFilters.server);
      if (currentFilters.protocol) params.set("protocol", currentFilters.protocol);
      if (currentFilters.from) params.set("from", currentFilters.from);
      if (currentFilters.to) params.set("to", currentFilters.to);

      const res = await fetch(`/api/results?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/");
          return null;
        }
        throw new Error("Failed to fetch results");
      }
      return (await res.json()) as PaginatedResults;
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);

        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) {
          router.push("/");
          return;
        }
        const userData = (await meRes.json()) as UserInfo;
        if (!cancelled) setUser(userData);

        const resultsData = await fetchResults(1, {});
        if (!cancelled && resultsData) {
          setResults(resultsData);
        }
      } catch {
        if (!cancelled) setError("Failed to load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router, fetchResults]);

  useEffect(() => {
    let cancelled = false;

    async function refetch() {
      try {
        const data = await fetchResults(page, filters);
        if (!cancelled && data) {
          setResults(data);
          setSelectedIds(new Set());
        }
      } catch {
        if (!cancelled) setError("Failed to fetch results.");
      }
    }

    // Skip the initial load (handled by the mount effect)
    if (!loading) {
      refetch();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters, fetchResults]);

  // Compute summary statistics
  const allRuns = results?.runs ?? [];
  const totalRuns = results?.total ?? 0;

  const avgTx =
    allRuns.length > 0
      ? allRuns.reduce((sum, r) => sum + r.tx_avg_mbps, 0) / allRuns.length
      : 0;
  const avgRx =
    allRuns.length > 0
      ? allRuns.reduce((sum, r) => sum + r.rx_avg_mbps, 0) / allRuns.length
      : 0;

  const serverCounts: Record<string, number> = {};
  for (const r of allRuns) {
    serverCounts[r.server] = (serverCounts[r.server] ?? 0) + 1;
  }
  const mostTestedServer =
    Object.entries(serverCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

  const totalPages = results ? Math.max(1, Math.ceil(results.total / results.limit)) : 1;

  function handleFilterChange(newFilters: FilterValues) {
    setFilters(newFilters);
    setPage(1);
  }

  function handleRowClick(id: string) {
    router.push(`/view/${id}`);
  }

  async function handleExportCsv() {
    if (selectedIds.size === 0) return;
    setExporting(true);
    try {
      const res = await fetch("/api/results/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        "btest-export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.size} selected run${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map((id) =>
        fetch(`/api/results/${id}`, { method: "DELETE" })
      );
      await Promise.all(deletePromises);
      setSelectedIds(new Set());
      const data = await fetchResults(page, filters);
      if (data) setResults(data);
    } catch {
      setError("Failed to delete some results.");
    } finally {
      setDeleting(false);
    }
  }

  function handleCompare() {
    if (selectedIds.size < 2 || selectedIds.size > 5) return;
    router.push(`/compare?ids=${Array.from(selectedIds).join(",")}`);
  }

  async function handleCopyApiKey() {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.api_key);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const textArea = document.createElement("textarea");
      textArea.value = user.api_key;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    }
  }

  async function handleRegenerateApiKey() {
    const confirmed = window.confirm(
      "Regenerate your API key? Any devices using the current key will need to be updated."
    );
    if (!confirmed) return;

    setRegeneratingKey(true);
    try {
      const res = await fetch("/api/auth/apikey", { method: "POST" });
      if (!res.ok) throw new Error("Failed to regenerate");
      const data = (await res.json()) as { api_key: string };
      setUser((prev) => (prev ? { ...prev, api_key: data.api_key } : prev));
    } catch {
      setError("Failed to regenerate API key.");
    } finally {
      setRegeneratingKey(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
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
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#121212" }}>
      {/* Header bar */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4"
        style={{
          backgroundColor: "#1E1E1E",
          borderColor: "#333333",
        }}
      >
        <a href="/" className="flex items-center gap-1 text-xl font-bold" style={{ color: "#FFFFFF" }}>
          btest-rs
          <span style={{ color: "#42A5F5" }}>-web</span>
        </a>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm" style={{ color: "#9E9E9E" }}>
              {user.email}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              borderColor: "#333333",
              color: "#9E9E9E",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#EF5350";
              (e.currentTarget as HTMLElement).style.color = "#EF5350";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#333333";
              (e.currentTarget as HTMLElement).style.color = "#9E9E9E";
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
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
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-4 text-sm font-medium underline"
                style={{ color: "#EF5350" }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Runs" value={totalRuns} subtitle="all time" />
          <StatsCard
            title="Avg TX Speed"
            value={`${avgTx.toFixed(2)} Mbps`}
            subtitle="current page"
            color="#42A5F5"
          />
          <StatsCard
            title="Avg RX Speed"
            value={`${avgRx.toFixed(2)} Mbps`}
            subtitle="current page"
            color="#66BB6A"
          />
          <StatsCard
            title="Most Tested Server"
            value={mostTestedServer}
            subtitle={
              serverCounts[mostTestedServer]
                ? `${serverCounts[mostTestedServer]} runs`
                : undefined
            }
          />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <Filters servers={servers} onFilterChange={handleFilterChange} />
        </div>

        {/* Action buttons */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={selectedIds.size === 0 || exporting}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{
              backgroundColor: "#42A5F5",
              color: "#FFFFFF",
            }}
          >
            {exporting ? "Exporting..." : `Export CSV${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0 || deleting}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{
              borderColor: "#EF5350",
              color: "#EF5350",
              backgroundColor: "transparent",
            }}
          >
            {deleting ? "Deleting..." : `Delete Selected${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
          </button>
          <button
            type="button"
            onClick={handleCompare}
            disabled={selectedIds.size < 2 || selectedIds.size > 5}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{
              borderColor: "#333333",
              color: "#FFFFFF",
              backgroundColor: "transparent",
            }}
          >
            Compare{selectedIds.size >= 2 ? ` (${selectedIds.size})` : ""}
          </button>
          {selectedIds.size > 0 && (
            <span className="text-xs" style={{ color: "#9E9E9E" }}>
              {selectedIds.size} selected
              {selectedIds.size > 5 && " (max 5 for compare)"}
            </span>
          )}
        </div>

        {/* Run history table */}
        <div className="mb-6">
          <RunTable
            runs={allRuns}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onRowClick={handleRowClick}
          />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mb-10 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: "#333333",
                color: "#FFFFFF",
                backgroundColor: "#1E1E1E",
              }}
            >
              Previous
            </button>
            <span className="text-sm" style={{ color: "#9E9E9E" }}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: "#333333",
                color: "#FFFFFF",
                backgroundColor: "#1E1E1E",
              }}
            >
              Next
            </button>
          </div>
        )}

        {/* API Key section */}
        {user && (
          <div
            className="rounded-lg border p-6"
            style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
          >
            <h2 className="mb-1 text-lg font-semibold" style={{ color: "#FFFFFF" }}>
              API Key
            </h2>
            <p className="mb-4 text-sm" style={{ color: "#9E9E9E" }}>
              Use this key to authenticate requests from btest-rs-android or other clients.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <code
                className="rounded-lg border px-4 py-2.5 text-sm font-mono"
                style={{
                  backgroundColor: "#121212",
                  borderColor: "#333333",
                  color: "#FFFFFF",
                }}
              >
                {user.api_key.slice(0, 8)}...
              </code>

              <button
                type="button"
                onClick={handleCopyApiKey}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  borderColor: "#333333",
                  color: apiKeyCopied ? "#66BB6A" : "#FFFFFF",
                  backgroundColor: "transparent",
                }}
              >
                {apiKeyCopied ? "Copied!" : "Copy"}
              </button>

              <button
                type="button"
                onClick={handleRegenerateApiKey}
                disabled={regeneratingKey}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                style={{
                  borderColor: "#EF5350",
                  color: "#EF5350",
                  backgroundColor: "transparent",
                }}
              >
                {regeneratingKey ? "Regenerating..." : "Regenerate"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
