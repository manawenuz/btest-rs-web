"use client";

import { useState, useMemo, useCallback } from "react";

interface Run {
  id: string;
  timestamp: string;
  server: string;
  protocol: string;
  direction: string;
  duration_sec: number;
  tx_avg_mbps: number;
  rx_avg_mbps: number;
  lost: number;
  public_ip: string | null;
  ssid: string | null;
  device_id: string | null;
}

interface RunTableProps {
  runs: Run[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onRowClick?: (id: string) => void;
}

type SortKey = keyof Run;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "timestamp", label: "Date" },
  { key: "server", label: "Server" },
  { key: "protocol", label: "Protocol" },
  { key: "direction", label: "Direction" },
  { key: "duration_sec", label: "Duration", align: "right" },
  { key: "tx_avg_mbps", label: "TX Avg", align: "right" },
  { key: "rx_avg_mbps", label: "RX Avg", align: "right" },
  { key: "lost", label: "Lost", align: "right" },
  { key: "public_ip", label: "IP" },
  { key: "ssid", label: "SSID" },
  { key: "device_id", label: "Device" },
];

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function formatMbps(val: number): string {
  return val.toFixed(2);
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatCell(key: SortKey, value: unknown): string {
  switch (key) {
    case "timestamp":
      return formatDate(value as string);
    case "tx_avg_mbps":
    case "rx_avg_mbps":
      return formatMbps(value as number);
    case "duration_sec":
      return formatDuration(value as number);
    case "lost":
      return (value as number).toLocaleString();
    case "public_ip":
    case "ssid":
    case "device_id":
      return (value as string | null) ?? "-";
    default:
      return String(value ?? "-");
  }
}

function SortArrow({ active, direction }: { active: boolean; direction: SortDir }) {
  if (!active) {
    return (
      <span className="ml-1 inline-block opacity-30" aria-hidden="true">
        <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
          <path d="M4 0L7.5 4.5H0.5L4 0Z" />
          <path d="M4 12L0.5 7.5H7.5L4 12Z" />
        </svg>
      </span>
    );
  }

  return (
    <span className="ml-1 inline-block" aria-hidden="true">
      <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
        {direction === "asc" ? (
          <path d="M4 0L7.5 5H0.5L4 0Z" />
        ) : (
          <path d="M4 12L0.5 7H7.5L4 12Z" />
        )}
      </svg>
    </span>
  );
}

export default function RunTable({
  runs,
  selectable = false,
  selectedIds,
  onSelectionChange,
  onRowClick,
}: RunTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  const sortedRuns = useMemo(() => {
    const sorted = [...runs].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp: number;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [runs, sortKey, sortDir]);

  const allSelected =
    selectable && runs.length > 0 && selectedIds !== undefined && runs.every((r) => selectedIds.has(r.id));

  const someSelected =
    selectable &&
    selectedIds !== undefined &&
    selectedIds.size > 0 &&
    !allSelected;

  function handleSelectAll() {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(runs.map((r) => r.id)));
    }
  }

  function handleSelectRow(id: string) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }

  if (runs.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border px-6 py-12"
        style={{ borderColor: "#333333", backgroundColor: "#1E1E1E", color: "#9E9E9E" }}
      >
        <p className="text-sm">No test runs found.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: "#333333" }}>
      <table className="w-full min-w-[900px] text-sm" style={{ backgroundColor: "#1E1E1E" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333333" }}>
            {selectable && (
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded accent-blue-500"
                  aria-label="Select all runs"
                />
              </th>
            )}
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`cursor-pointer select-none whitespace-nowrap px-3 py-3 font-medium transition-colors hover:text-white ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
                style={{ color: sortKey === col.key ? "#FFFFFF" : "#9E9E9E" }}
                onClick={() => handleSort(col.key)}
                role="columnheader"
                aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                {col.label}
                <SortArrow active={sortKey === col.key} direction={sortDir} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRuns.map((run, idx) => {
            const isSelected = selectable && selectedIds?.has(run.id);
            return (
              <tr
                key={run.id}
                className="cursor-pointer transition-colors"
                style={{
                  borderBottom: idx < sortedRuns.length - 1 ? "1px solid #2A2A2A" : undefined,
                  backgroundColor: isSelected ? "rgba(66, 165, 245, 0.08)" : undefined,
                  color: "#FFFFFF",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = isSelected
                    ? "rgba(66, 165, 245, 0.14)"
                    : "#2A2A2A";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = isSelected
                    ? "rgba(66, 165, 245, 0.08)"
                    : "";
                }}
                onClick={() => onRowClick?.(run.id)}
              >
                {selectable && (
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected ?? false}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectRow(run.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded accent-blue-500"
                      aria-label={`Select run ${run.id}`}
                    />
                  </td>
                )}
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`whitespace-nowrap px-3 py-2.5 ${col.align === "right" ? "text-right" : "text-left"}`}
                    style={{
                      color:
                        col.key === "tx_avg_mbps"
                          ? "#42A5F5"
                          : col.key === "rx_avg_mbps"
                            ? "#66BB6A"
                            : col.key === "lost" && run.lost > 0
                              ? "#EF5350"
                              : "#FFFFFF",
                    }}
                  >
                    {formatCell(col.key, run[col.key])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
