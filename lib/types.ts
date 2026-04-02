export interface User {
  id: string;
  email: string;
  password_hash: string;
  api_key: string;
  created_at: string;
}

export interface TestRun {
  id: string;
  user_id: string;
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
}

export interface TestInterval {
  id?: number;
  run_id?: string;
  interval_sec: number;
  direction: string;
  speed_mbps: number;
  bytes: number;
  local_cpu: number | null;
  remote_cpu: number | null;
  lost: number | null;
}

// API request/response types
export interface SubmitRunRequest {
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
  public_ip?: string | null;
  lan_ip?: string | null;
  ssid?: string | null;
  device_id?: string | null;
  intervals: {
    sec: number;
    dir: string;
    speed_mbps: number;
    bytes: number;
    local_cpu?: number | null;
    remote_cpu?: number | null;
    lost?: number | null;
  }[];
}

export interface BatchSubmitRequest {
  runs: SubmitRunRequest[];
}

export interface PaginatedResponse<T> {
  runs: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthResponse {
  token: string;
  api_key: string;
}
