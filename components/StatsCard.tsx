"use client";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export default function StatsCard({ title, value, subtitle, color }: StatsCardProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded-lg border px-5 py-4"
      style={{
        backgroundColor: "#1E1E1E",
        borderColor: "#333333",
      }}
    >
      <span
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: "#9E9E9E" }}
      >
        {title}
      </span>
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ color: color ?? "#FFFFFF" }}
      >
        {value}
      </span>
      {subtitle != null && subtitle !== "" && (
        <span className="text-xs" style={{ color: "#9E9E9E" }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}
