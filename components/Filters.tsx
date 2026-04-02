"use client";

import { useState, useCallback } from "react";

interface FilterValues {
  server?: string;
  protocol?: string;
  device?: string;
  from?: string;
  to?: string;
}

interface FiltersProps {
  servers: string[];
  devices: string[];
  onFilterChange: (filters: FilterValues) => void;
}

type Protocol = "ALL" | "TCP" | "UDP";

const PROTOCOLS: Protocol[] = ["ALL", "TCP", "UDP"];

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: "#121212",
  borderColor: "#333333",
  color: "#FFFFFF",
};

export default function Filters({ servers, devices, onFilterChange }: FiltersProps) {
  const [server, setServer] = useState<string>("");
  const [protocol, setProtocol] = useState<Protocol>("ALL");
  const [device, setDevice] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const emitChange = useCallback(
    (updates: Partial<{ server: string; protocol: Protocol; device: string; from: string; to: string }>) => {
      const next = {
        server: updates.server ?? server,
        protocol: updates.protocol ?? protocol,
        device: updates.device ?? device,
        from: updates.from ?? from,
        to: updates.to ?? to,
      };

      const filters: FilterValues = {};
      if (next.server) filters.server = next.server;
      if (next.protocol !== "ALL") filters.protocol = next.protocol;
      if (next.device) filters.device = next.device;
      if (next.from) filters.from = next.from;
      if (next.to) filters.to = next.to;

      onFilterChange(filters);
    },
    [server, protocol, device, from, to, onFilterChange]
  );

  function handleServerChange(value: string) {
    setServer(value);
    emitChange({ server: value });
  }

  function handleProtocolChange(value: Protocol) {
    setProtocol(value);
    emitChange({ protocol: value });
  }

  function handleDeviceChange(value: string) {
    setDevice(value);
    emitChange({ device: value });
  }

  function handleFromChange(value: string) {
    setFrom(value);
    emitChange({ from: value });
  }

  function handleToChange(value: string) {
    setTo(value);
    emitChange({ to: value });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Server filter */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="filter-server"
          className="text-xs font-medium"
          style={{ color: "#9E9E9E" }}
        >
          Server
        </label>
        <select
          id="filter-server"
          value={server}
          onChange={(e) => handleServerChange(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500"
          style={INPUT_STYLE}
        >
          <option value="">All servers</option>
          {servers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Device filter */}
      {devices.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-device"
            className="text-xs font-medium"
            style={{ color: "#9E9E9E" }}
          >
            Device
          </label>
          <select
            id="filter-device"
            value={device}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500"
            style={INPUT_STYLE}
          >
            <option value="">All devices</option>
            {devices.map((d) => (
              <option key={d} value={d}>
                {d.length > 16 ? `${d.slice(0, 8)}...${d.slice(-4)}` : d}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Protocol toggle */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium" style={{ color: "#9E9E9E" }}>
          Protocol
        </span>
        <div
          className="flex overflow-hidden rounded-lg border"
          style={{ borderColor: "#333333" }}
          role="group"
          aria-label="Protocol filter"
        >
          {PROTOCOLS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleProtocolChange(p)}
              className="px-3.5 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: protocol === p ? "#42A5F5" : "#121212",
                color: protocol === p ? "#FFFFFF" : "#9E9E9E",
                borderRight: p !== "UDP" ? "1px solid #333333" : undefined,
              }}
              aria-pressed={protocol === p}
            >
              {p === "ALL" ? "All" : p}
            </button>
          ))}
        </div>
      </div>

      {/* From date */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="filter-from"
          className="text-xs font-medium"
          style={{ color: "#9E9E9E" }}
        >
          From
        </label>
        <input
          id="filter-from"
          type="date"
          value={from}
          onChange={(e) => handleFromChange(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500"
          style={INPUT_STYLE}
        />
      </div>

      {/* To date */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="filter-to"
          className="text-xs font-medium"
          style={{ color: "#9E9E9E" }}
        >
          To
        </label>
        <input
          id="filter-to"
          type="date"
          value={to}
          onChange={(e) => handleToChange(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500"
          style={INPUT_STYLE}
        />
      </div>
    </div>
  );
}
