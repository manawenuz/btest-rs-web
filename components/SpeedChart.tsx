"use client";

import { useRef, useEffect, useCallback } from "react";

interface SpeedChartInterval {
  sec: number;
  dir: string;
  speed_mbps: number;
}

interface SpeedChartProps {
  intervals: SpeedChartInterval[];
  width?: number;
  height?: number;
}

const TX_COLOR = "#42A5F5";
const RX_COLOR = "#66BB6A";
const GRID_COLOR = "#333333";
const LABEL_COLOR = "#9E9E9E";
const BG_COLOR = "#1E1E1E";
const DOT_RADIUS = 3;

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
    return { min: 0, max: Math.ceil(maxVal * 1.2), step: Math.ceil(maxVal * 1.2) / 5 };
  }

  const range = niceNumber(maxVal - minVal, false);
  const step = niceNumber(range / (maxTicks - 1), true);
  const niceMin = Math.floor(minVal / step) * step;
  const niceMax = Math.ceil(maxVal / step) * step;

  return { min: niceMin, max: niceMax, step };
}

export default function SpeedChart({ intervals, height = 300 }: SpeedChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = height;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);

      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, w, h);

      // Separate TX and RX data
      const txData: { sec: number; speed: number }[] = [];
      const rxData: { sec: number; speed: number }[] = [];

      for (const interval of intervals) {
        const entry = { sec: interval.sec, speed: interval.speed_mbps };
        if (interval.dir === "TX") txData.push(entry);
        else if (interval.dir === "RX") rxData.push(entry);
      }

      txData.sort((a, b) => a.sec - b.sec);
      rxData.sort((a, b) => a.sec - b.sec);

      if (txData.length === 0 && rxData.length === 0) {
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = "14px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No interval data available", w / 2, h / 2);
        return;
      }

      // Determine axes ranges
      const allSecs = [...txData.map((d) => d.sec), ...rxData.map((d) => d.sec)];
      const allSpeeds = [...txData.map((d) => d.speed), ...rxData.map((d) => d.speed)];
      const minSec = Math.min(...allSecs);
      const maxSec = Math.max(...allSecs);
      const maxSpeed = Math.max(...allSpeeds);

      const yScale = niceScale(0, maxSpeed, 6);

      const chartLeft = PADDING.left;
      const chartRight = w - PADDING.right;
      const chartTop = PADDING.top;
      const chartBottom = h - PADDING.bottom;
      const chartWidth = chartRight - chartLeft;
      const chartHeight = chartBottom - chartTop;

      // X mapping
      const xRange = maxSec - minSec || 1;
      const toX = (sec: number) => chartLeft + ((sec - minSec) / xRange) * chartWidth;
      const toY = (speed: number) =>
        chartBottom - ((speed - yScale.min) / (yScale.max - yScale.min)) * chartHeight;

      // Draw grid lines (horizontal)
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

      // Draw vertical grid lines
      const xTickCount = Math.min(maxSec - minSec, 10);
      const xStep = xTickCount > 0 ? Math.ceil((maxSec - minSec) / xTickCount) : 1;

      for (let sec = minSec; sec <= maxSec; sec += xStep) {
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
        const label = val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(val < 10 ? 1 : 0);
        ctx.fillText(label, chartLeft - 8, y);
      }

      // X-axis labels
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      for (let sec = minSec; sec <= maxSec; sec += xStep) {
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

      // Draw data lines
      function drawLine(
        c: CanvasRenderingContext2D,
        data: { sec: number; speed: number }[],
        color: string
      ) {
        if (data.length === 0) return;

        // Line
        c.strokeStyle = color;
        c.lineWidth = 2;
        c.lineJoin = "round";
        c.lineCap = "round";
        c.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = toX(data[i].sec);
          const y = toY(data[i].speed);
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();

        // Dots
        c.fillStyle = color;
        for (const point of data) {
          const x = toX(point.sec);
          const y = toY(point.speed);
          c.beginPath();
          c.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
          c.fill();
        }
      }

      drawLine(ctx, txData, TX_COLOR);
      drawLine(ctx, rxData, RX_COLOR);

      // Legend
      const legendX = chartRight - 120;
      const legendY = chartTop + 4;

      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      if (txData.length > 0) {
        ctx.fillStyle = TX_COLOR;
        ctx.beginPath();
        ctx.arc(legendX, legendY + 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = TX_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX - 12, legendY + 2);
        ctx.lineTo(legendX + 12, legendY + 2);
        ctx.stroke();
        ctx.fillStyle = LABEL_COLOR;
        ctx.fillText("TX (Upload)", legendX + 18, legendY + 2);
      }

      if (rxData.length > 0) {
        const rxLegendY = legendY + 20;
        ctx.fillStyle = RX_COLOR;
        ctx.beginPath();
        ctx.arc(legendX, rxLegendY + 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = RX_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX - 12, rxLegendY + 2);
        ctx.lineTo(legendX + 12, rxLegendY + 2);
        ctx.stroke();
        ctx.fillStyle = LABEL_COLOR;
        ctx.fillText("RX (Download)", legendX + 18, rxLegendY + 2);
      }
    },
    [intervals, height]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    draw(canvas);

    const observer = new ResizeObserver(() => {
      draw(canvas);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full" style={{ minHeight: height }}>
      <canvas
        ref={canvasRef}
        className="block w-full rounded-lg"
        style={{ height, background: BG_COLOR }}
      />
    </div>
  );
}
