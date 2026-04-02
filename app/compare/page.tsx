"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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

const RUN_COLORS = ["#42A5F5", "#66BB6A", "#FFA726", "#EF5350", "#AB47BC"];

const GRID_COLOR = "#333333";
const LABEL_COLOR = "#9E9E9E";
const BG_COLOR = "#1E1E1E";
const CHART_HEIGHT = 400;
const PADDING = { top: 24, right: 24, bottom: 48, left: 64 };

function niceNumber(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
}

function niceScale(
  minVal: number,
  maxVal: number,
  maxTicks: number = 6
): { min: number; max: number; step: number } {
  if (maxVal === minVal) {
    if (maxVal === 0) return { min: 0, max: 10, step: 2 };
    return {
      min: 0,
      max: Math.ceil(maxVal * 1.2),
      step: Math.ceil(maxVal * 1.2) / 5,
    };
  }
  const range = niceNumber(maxVal - minVal, false);
  const step = niceNumber(range / (maxTicks - 1), true);
  const niceMin = Math.floor(minVal / step) * step;
  const niceMax = Math.ceil(maxVal / step) * step;
  return { min: niceMin, max: niceMax, step };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatShortTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen" style={{ color: "#9E9E9E" }}>Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [runs, setRuns] = useState<RunDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRuns() {
      if (ids.length === 0) {
        setError("No run IDs provided.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const results = await Promise.all(
          ids.map(async (runId) => {
            const res = await fetch(`/api/results/${runId}`);
            if (!res.ok) {
              if (res.status === 401) {
                window.location.href = "/";
                return null;
              }
              throw new Error(`Failed to fetch run ${runId}`);
            }
            return (await res.json()) as RunDetail;
          })
        );

        const validRuns = results.filter(
          (r): r is RunDetail => r !== null
        );

        if (!cancelled) {
          setRuns(validRuns);
          if (validRuns.length === 0) {
            setError("No valid runs found.");
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load one or more test runs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRuns();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  const drawChart = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx || runs.length === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = CHART_HEIGHT;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, w, h);

      // Gather all data points across all runs
      let globalMaxSec = 0;
      let globalMaxSpeed = 0;

      const runData: {
        run: RunDetail;
        txData: { sec: number; speed: number }[];
        rxData: { sec: number; speed: number }[];
        color: string;
      }[] = [];

      runs.forEach((run, index) => {
        const color = RUN_COLORS[index % RUN_COLORS.length];
        const txData: { sec: number; speed: number }[] = [];
        const rxData: { sec: number; speed: number }[] = [];

        for (const interval of run.intervals) {
          const entry = { sec: interval.sec, speed: interval.speed_mbps };
          if (interval.dir === "TX") txData.push(entry);
          else if (interval.dir === "RX") rxData.push(entry);
          if (interval.sec > globalMaxSec) globalMaxSec = interval.sec;
          if (interval.speed_mbps > globalMaxSpeed)
            globalMaxSpeed = interval.speed_mbps;
        }

        txData.sort((a, b) => a.sec - b.sec);
        rxData.sort((a, b) => a.sec - b.sec);

        runData.push({ run, txData, rxData, color });
      });

      if (globalMaxSpeed === 0) {
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = "14px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No interval data available", w / 2, h / 2);
        return;
      }

      const yScale = niceScale(0, globalMaxSpeed, 6);

      const chartLeft = PADDING.left;
      const chartRight = w - PADDING.right;
      const chartTop = PADDING.top;
      const chartBottom = h - PADDING.bottom;
      const chartWidth = chartRight - chartLeft;
      const chartHeight = chartBottom - chartTop;

      const xRange = globalMaxSec || 1;
      const toX = (sec: number) => chartLeft + (sec / xRange) * chartWidth;
      const toY = (speed: number) =>
        chartBottom -
        ((speed - yScale.min) / (yScale.max - yScale.min)) * chartHeight;

      // Draw grid lines
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 4]);

      const ySteps = Math.round((yScale.max - yScale.min) / yScale.step);
      for (let i = 0; i <= ySteps; i++) {
        const val = yScale.min + i * yScale.step;
        const y = toY(val);
        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();
      }

      const xTickCount = Math.min(globalMaxSec, 10);
      const xStep = xTickCount > 0 ? Math.ceil(globalMaxSec / xTickCount) : 1;
      for (let sec = 0; sec <= globalMaxSec; sec += xStep) {
        const x = toX(sec);
        ctx.beginPath();
        ctx.moveTo(x, chartTop);
        ctx.lineTo(x, chartBottom);
        ctx.stroke();
      }

      ctx.setLineDash([]);

      // Draw axes
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartLeft, chartTop);
      ctx.lineTo(chartLeft, chartBottom);
      ctx.lineTo(chartRight, chartBottom);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= ySteps; i++) {
        const val = yScale.min + i * yScale.step;
        const y = toY(val);
        const label =
          val >= 1000
            ? `${(val / 1000).toFixed(1)}k`
            : val.toFixed(val < 10 ? 1 : 0);
        ctx.fillText(label, chartLeft - 8, y);
      }

      // X-axis labels
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let sec = 0; sec <= globalMaxSec; sec += xStep) {
        const x = toX(sec);
        ctx.fillText(`${sec}s`, x, chartBottom + 8);
      }

      // Axis titles
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Time (seconds)", (chartLeft + chartRight) / 2, h - 6);

      ctx.save();
      ctx.translate(14, (chartTop + chartBottom) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("Speed (Mbps)", 0, 0);
      ctx.restore();

      // Draw data for each run
      function drawLine(
        c: CanvasRenderingContext2D,
        data: { sec: number; speed: number }[],
        color: string,
        dashed: boolean
      ) {
        if (data.length === 0) return;

        c.strokeStyle = color;
        c.lineWidth = 2;
        c.lineJoin = "round";
        c.lineCap = "round";
        if (dashed) c.setLineDash([6, 4]);
        else c.setLineDash([]);

        c.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = toX(data[i].sec);
          const y = toY(data[i].speed);
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
        c.setLineDash([]);

        c.fillStyle = color;
        for (const point of data) {
          const x = toX(point.sec);
          const y = toY(point.speed);
          c.beginPath();
          c.arc(x, y, 2.5, 0, Math.PI * 2);
          c.fill();
        }
      }

      for (const rd of runData) {
        // TX lines are solid, RX lines are dashed
        drawLine(ctx, rd.txData, rd.color, false);
        drawLine(ctx, rd.rxData, rd.color, true);
      }

      // Legend
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const legendX = chartLeft + 8;
      let legendY = chartTop + 8;

      for (let i = 0; i < runData.length; i++) {
        const rd = runData[i];
        const label = `${rd.run.server} (${formatShortTimestamp(rd.run.timestamp)})`;

        // Solid line for TX
        ctx.strokeStyle = rd.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(legendX, legendY);
        ctx.lineTo(legendX + 16, legendY);
        ctx.stroke();

        ctx.fillStyle = rd.color;
        ctx.beginPath();
        ctx.arc(legendX + 8, legendY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = LABEL_COLOR;
        ctx.fillText(`TX: ${label}`, legendX + 22, legendY);
        legendY += 16;

        // Dashed line for RX
        ctx.strokeStyle = rd.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(legendX, legendY);
        ctx.lineTo(legendX + 16, legendY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = rd.color;
        ctx.beginPath();
        ctx.arc(legendX + 8, legendY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = LABEL_COLOR;
        ctx.fillText(`RX: ${label}`, legendX + 22, legendY);
        legendY += 20;
      }
    },
    [runs]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || runs.length === 0) return;

    drawChart(canvas);

    const observer = new ResizeObserver(() => {
      drawChart(canvas);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [drawChart, runs]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "#333333", borderTopColor: "#42A5F5" }}
          />
          <p className="text-sm" style={{ color: "#9E9E9E" }}>
            Loading runs for comparison...
          </p>
        </div>
      </div>
    );
  }

  if (error && runs.length === 0) {
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
          href="/dashboard"
          className="text-sm font-medium underline"
          style={{ color: "#42A5F5" }}
        >
          Back to Dashboard
        </a>
      </div>
    );
  }

  const STAT_ROWS: {
    label: string;
    getValue: (r: RunDetail) => string;
    color?: (r: RunDetail) => string | undefined;
  }[] = [
    { label: "Server", getValue: (r) => r.server },
    { label: "Protocol", getValue: (r) => r.protocol },
    { label: "Direction", getValue: (r) => r.direction },
    { label: "Duration", getValue: (r) => formatDuration(r.duration_sec) },
    {
      label: "TX Avg",
      getValue: (r) => `${r.tx_avg_mbps.toFixed(2)} Mbps`,
      color: () => "#42A5F5",
    },
    {
      label: "RX Avg",
      getValue: (r) => `${r.rx_avg_mbps.toFixed(2)} Mbps`,
      color: () => "#66BB6A",
    },
    { label: "TX Bytes", getValue: (r) => formatBytes(r.tx_bytes) },
    { label: "RX Bytes", getValue: (r) => formatBytes(r.rx_bytes) },
    {
      label: "Lost",
      getValue: (r) => r.lost.toLocaleString(),
      color: (r) => (r.lost > 0 ? "#EF5350" : undefined),
    },
    { label: "SSID", getValue: (r) => r.ssid ?? "-" },
    { label: "Device", getValue: (r) => r.device_id ?? "-" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#121212" }}>
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Back button */}
        <a
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: "#42A5F5" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "0.8";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path
              d="M10.5 13L5.5 8L10.5 3"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Dashboard
        </a>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "#FFFFFF" }}>
            Compare Runs ({runs.length})
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#9E9E9E" }}>
            Overlay comparison of selected test runs
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

        {/* Color legend above chart */}
        <div className="mb-4 flex flex-wrap gap-4">
          {runs.map((run, index) => (
            <div key={run.id} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{
                  backgroundColor: RUN_COLORS[index % RUN_COLORS.length],
                }}
              />
              <span className="text-sm" style={{ color: "#FFFFFF" }}>
                {run.server}
              </span>
              <span className="text-xs" style={{ color: "#9E9E9E" }}>
                {formatShortTimestamp(run.timestamp)}
              </span>
            </div>
          ))}
        </div>

        {/* Overlay chart */}
        <div className="mb-8">
          <div
            ref={containerRef}
            className="w-full"
            style={{ minHeight: CHART_HEIGHT }}
          >
            <canvas
              ref={canvasRef}
              className="block w-full rounded-lg"
              style={{ height: CHART_HEIGHT, background: BG_COLOR }}
            />
          </div>
          <p className="mt-2 text-xs" style={{ color: "#9E9E9E" }}>
            Solid lines = TX (upload), dashed lines = RX (download)
          </p>
        </div>

        {/* Side-by-side stats table */}
        <div className="w-full overflow-x-auto">
          <h2 className="mb-3 text-lg font-semibold" style={{ color: "#FFFFFF" }}>
            Side-by-Side Comparison
          </h2>
          <div
            className="overflow-x-auto rounded-lg border"
            style={{ borderColor: "#333333" }}
          >
            <table
              className="w-full text-sm"
              style={{ backgroundColor: "#1E1E1E", minWidth: `${200 + runs.length * 180}px` }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #333333" }}>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: "#9E9E9E", width: 160 }}
                  >
                    Metric
                  </th>
                  {runs.map((run, index) => (
                    <th
                      key={run.id}
                      className="px-4 py-3 text-left text-xs font-medium"
                      style={{
                        color: RUN_COLORS[index % RUN_COLORS.length],
                        borderLeft: "1px solid #333333",
                      }}
                    >
                      <div>{run.server}</div>
                      <div className="mt-0.5 font-normal" style={{ color: "#9E9E9E" }}>
                        {formatShortTimestamp(run.timestamp)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STAT_ROWS.map((row, rowIdx) => (
                  <tr
                    key={row.label}
                    style={{
                      backgroundColor: rowIdx % 2 === 0 ? "#1E1E1E" : "#242424",
                      borderBottom:
                        rowIdx < STAT_ROWS.length - 1
                          ? "1px solid #2A2A2A"
                          : undefined,
                    }}
                  >
                    <td
                      className="whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wider"
                      style={{ color: "#9E9E9E" }}
                    >
                      {row.label}
                    </td>
                    {runs.map((run, index) => (
                      <td
                        key={run.id}
                        className="whitespace-nowrap px-4 py-2.5"
                        style={{
                          color: row.color?.(run) ?? "#FFFFFF",
                          borderLeft: "1px solid #333333",
                        }}
                      >
                        {row.getValue(run)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
