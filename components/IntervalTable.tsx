"use client";

import { useState } from "react";

interface Interval {
  sec: number;
  dir: string;
  speed_mbps: number;
  bytes: number;
  local_cpu: number | null;
  remote_cpu: number | null;
  lost: number | null;
}

interface IntervalTableProps {
  intervals: Interval[];
}

function formatBytes(bytes: number): string {
  return bytes.toLocaleString();
}

function formatSpeed(mbps: number): string {
  return mbps.toFixed(2);
}

function formatPercent(val: number | null): string {
  if (val == null) return "-";
  return `${val}%`;
}

function formatLost(val: number | null): string {
  if (val == null) return "-";
  return val.toLocaleString();
}

const HEADER_STYLE = {
  color: "#9E9E9E" as const,
  borderBottom: "1px solid #333333" as const,
};

export default function IntervalTable({ intervals }: IntervalTableProps) {
  const [expanded, setExpanded] = useState(false);

  if (intervals.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors"
        style={{
          backgroundColor: "#1E1E1E",
          borderColor: "#333333",
          color: "#9E9E9E",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "#2A2A2A";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "#1E1E1E";
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          className="transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          <path d="M4 2L9 6L4 10V2Z" />
        </svg>
        {expanded ? "Hide" : "Show"} interval data ({intervals.length} rows)
      </button>

      {expanded && (
        <div
          className="mt-2 w-full overflow-x-auto rounded-lg border"
          style={{ borderColor: "#333333" }}
        >
          <table
            className="w-full min-w-[700px] text-sm"
            style={{ backgroundColor: "#1E1E1E" }}
          >
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium" style={HEADER_STYLE}>
                  Second
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium" style={HEADER_STYLE}>
                  Direction
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium" style={HEADER_STYLE}>
                  Speed (Mbps)
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium" style={HEADER_STYLE}>
                  Bytes
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium" style={HEADER_STYLE}>
                  Local CPU %
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium" style={HEADER_STYLE}>
                  Remote CPU %
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium" style={HEADER_STYLE}>
                  Lost
                </th>
              </tr>
            </thead>
            <tbody>
              {intervals.map((interval, idx) => (
                <tr
                  key={`${interval.sec}-${interval.dir}-${idx}`}
                  style={{
                    backgroundColor: idx % 2 === 0 ? "#1E1E1E" : "#242424",
                    color: "#FFFFFF",
                  }}
                >
                  <td className="px-3 py-2 tabular-nums">{interval.sec}</td>
                  <td
                    className="px-3 py-2 font-medium"
                    style={{ color: interval.dir === "TX" ? "#42A5F5" : "#66BB6A" }}
                  >
                    {interval.dir}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatSpeed(interval.speed_mbps)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatBytes(interval.bytes)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPercent(interval.local_cpu)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPercent(interval.remote_cpu)}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums"
                    style={{
                      color: interval.lost != null && interval.lost > 0 ? "#EF5350" : undefined,
                    }}
                  >
                    {formatLost(interval.lost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
