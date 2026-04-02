# btest-rs-web — Specification

> Bandwidth test result dashboard and renderer for the [btest-rs](https://github.com/manawenuz/btest-rs) ecosystem.

Part of the btest-rs family:
- **btest-rs** — CLI bandwidth test client/server (Rust)
- **btest-rs-android** — Android client app
- **btest-rs-web** — Result dashboard and renderer (this project)

---

## Overview

A multi-user web application that receives, stores, and visualizes bandwidth test results submitted by btest-rs-android (or any client implementing the API). Users authenticate, submit results automatically after each test, and view interactive charts and history on a web dashboard.

**Stack:** Next.js (App Router) · TypeScript · Vercel Postgres · Vercel Deployment

---

## Authentication

### Registration & Login

Standard email + password authentication.

- Passwords hashed with **bcrypt** (cost factor 10)
- Sessions via **JWT** (HS256, 7-day expiry) stored in HTTP-only cookies for web UI
- JWT returned in response body for programmatic use

### API Keys

Each user gets one API key for programmatic access (used by the Android app).

- Format: `btk_` prefix + 32 random hex characters (e.g., `btk_a1b2c3d4e5f6...`)
- Sent as `Authorization: Bearer btk_...` header
- Can be regenerated (invalidates the previous key)
- One active key per user

### Auth Endpoints

```
POST /api/auth/register
  Request:  { "email": "user@example.com", "password": "..." }
  Response: { "token": "eyJ...", "api_key": "btk_..." }
  Errors:   409 email exists, 422 validation error

POST /api/auth/login
  Request:  { "email": "user@example.com", "password": "..." }
  Response: { "token": "eyJ...", "api_key": "btk_..." }
  Errors:   401 invalid credentials

GET /api/auth/me
  Auth:     Bearer JWT or API key
  Response: { "id": "...", "email": "...", "api_key": "btk_...", "created_at": "..." }

POST /api/auth/apikey/regen
  Auth:     Bearer JWT
  Response: { "api_key": "btk_..." }
  Note:     Invalidates previous API key
```

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  api_key       TEXT UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Test runs (one row per completed test)
CREATE TABLE test_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp     TIMESTAMPTZ NOT NULL,          -- when the test ran (client time)
  server        TEXT NOT NULL,                 -- test server address
  protocol      TEXT NOT NULL,                 -- "TCP" or "UDP"
  direction     TEXT NOT NULL,                 -- "send", "receive", or "both"
  duration_sec  INTEGER NOT NULL,
  tx_avg_mbps   DOUBLE PRECISION NOT NULL,
  rx_avg_mbps   DOUBLE PRECISION NOT NULL,
  tx_bytes      BIGINT NOT NULL,
  rx_bytes      BIGINT NOT NULL,
  lost          BIGINT NOT NULL DEFAULT 0,
  public_ip     TEXT,                          -- user's public IP
  lan_ip        TEXT,                          -- user's LAN IP
  ssid          TEXT,                          -- WiFi network name (optional)
  created_at    TIMESTAMPTZ DEFAULT NOW()      -- when the server received it
);

CREATE INDEX idx_test_runs_user ON test_runs(user_id, created_at DESC);

-- Per-second interval samples (many per run)
CREATE TABLE test_intervals (
  id            BIGSERIAL PRIMARY KEY,
  run_id        UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  interval_sec  INTEGER NOT NULL,
  direction     TEXT NOT NULL,                 -- "TX" or "RX"
  speed_mbps    DOUBLE PRECISION NOT NULL,
  bytes         BIGINT NOT NULL,
  local_cpu     INTEGER,
  remote_cpu    INTEGER,
  lost          BIGINT
);

CREATE INDEX idx_test_intervals_run ON test_intervals(run_id, interval_sec);
```

### Data Volume Estimates

| Test Config | Interval Rows | ~JSON Size | ~Gzipped |
|-------------|--------------|------------|----------|
| 30s both    | 60           | 6 KB       | 1 KB     |
| 60s both    | 120          | 12 KB      | 2 KB     |
| 120s send   | 120          | 8 KB       | 1.5 KB   |
| Batch of 50 runs (30s both) | 3000 | 300 KB | 25 KB |

---

## API Endpoints

### Submit Results

```
POST /api/results
  Auth:     Bearer API key
  Encoding: Content-Encoding: gzip (REQUIRED for batch, recommended for single)
  Content-Type: application/json

  Request (single run):
  {
    "timestamp": "2026-04-02T10:00:00Z",
    "server": "104.225.217.60",
    "protocol": "TCP",
    "direction": "both",
    "duration_sec": 30,
    "tx_avg_mbps": 285.47,
    "rx_avg_mbps": 272.83,
    "tx_bytes": 2137030656,
    "rx_bytes": 2046260728,
    "lost": 0,
    "public_ip": "203.0.113.50",
    "lan_ip": "192.168.1.42",
    "ssid": "MyWiFi-5G",
    "intervals": [
      {
        "sec": 1,
        "dir": "TX",
        "speed_mbps": 280.50,
        "bytes": 35062500,
        "local_cpu": 15,
        "remote_cpu": 60,
        "lost": null
      },
      {
        "sec": 1,
        "dir": "RX",
        "speed_mbps": 270.30,
        "bytes": 33787500,
        "local_cpu": 15,
        "remote_cpu": 60,
        "lost": 0
      }
    ]
  }

  Response: 201 Created
  {
    "id": "a1b2c3d4-...",
    "url": "/view/a1b2c3d4-..."
  }
```

```
POST /api/results/batch
  Auth:     Bearer API key
  Encoding: Content-Encoding: gzip (REQUIRED)
  Content-Type: application/json

  Request:
  {
    "runs": [ { ...same as single... }, { ... }, ... ]
  }

  Response: 201 Created
  {
    "ids": ["a1b2c3d4-...", "e5f6g7h8-..."],
    "count": 2
  }
```

### Query Results

```
GET /api/results
  Auth:     Bearer API key or JWT
  Query:    ?page=1&limit=20&server=104.225.217.60&protocol=TCP&from=2026-04-01&to=2026-04-02
  Response:
  {
    "runs": [
      {
        "id": "a1b2c3d4-...",
        "timestamp": "2026-04-02T10:00:00Z",
        "server": "104.225.217.60",
        "protocol": "TCP",
        "direction": "both",
        "duration_sec": 30,
        "tx_avg_mbps": 285.47,
        "rx_avg_mbps": 272.83,
        "tx_bytes": 2137030656,
        "rx_bytes": 2046260728,
        "lost": 0,
        "public_ip": "203.0.113.50",
        "lan_ip": "192.168.1.42",
        "ssid": "MyWiFi-5G",
        "created_at": "2026-04-02T10:00:05Z"
      }
    ],
    "total": 142,
    "page": 1,
    "limit": 20
  }

GET /api/results/:id
  Auth:     Bearer API key or JWT
  Response: Full run object including intervals array (same shape as POST body)

GET /api/results/:id/csv
  Auth:     Bearer API key or JWT
  Response: text/csv download (Content-Disposition: attachment)

DELETE /api/results/:id
  Auth:     Bearer API key or JWT
  Response: 204 No Content
```

### Export

```
POST /api/results/export/csv
  Auth:     Bearer API key or JWT
  Request:  { "ids": ["a1b2c3d4-...", "e5f6g7h8-..."] }
  Response: text/csv (Content-Disposition: attachment; filename="btest-export-2026-04-02.csv")
```

---

## CSV Export Format

```csv
# btest-rs-web export
# user: user@example.com
# exported: 2026-04-02T14:30:00Z
# runs: 2
#
# SECTION: runs
run_id,timestamp,server,protocol,direction,duration_sec,tx_avg_mbps,rx_avg_mbps,tx_bytes,rx_bytes,lost,public_ip,lan_ip,ssid
a1b2c3d4,2026-04-01T10:00:00Z,104.225.217.60,TCP,both,30,285.47,272.83,2137030656,2046260728,0,203.0.113.50,192.168.1.42,MyWiFi-5G
e5f6g7h8,2026-04-01T11:15:00Z,188.245.59.196,UDP,send,60,195.20,0.00,1464000000,0,142,203.0.113.50,192.168.1.42,MyWiFi-5G
#
# SECTION: intervals
run_id,interval_sec,direction,speed_mbps,bytes,local_cpu,remote_cpu,lost
a1b2c3d4,1,TX,280.50,35062500,15,60,
a1b2c3d4,1,RX,270.30,33787500,15,60,0
a1b2c3d4,2,TX,288.20,36025000,18,62,
a1b2c3d4,2,RX,275.10,34387500,18,62,0
e5f6g7h8,1,TX,190.30,23787500,22,55,3
e5f6g7h8,2,TX,198.40,24800000,20,58,0
```

---

## Compression

All POST requests to `/api/results` and `/api/results/batch` **must** use gzip compression for payloads larger than 1 KB.

### Client Side (Android app)
```kotlin
// Compress with GZIPOutputStream
val json = jsonExporter.export(run, intervals)
val compressed = ByteArrayOutputStream().use { baos ->
    GZIPOutputStream(baos).use { gz -> gz.write(json.toByteArray()) }
    baos.toByteArray()
}

// Send with Content-Encoding header
conn.setRequestProperty("Content-Encoding", "gzip")
conn.setRequestProperty("Content-Type", "application/json")
conn.outputStream.write(compressed)
```

### Server Side (Next.js)
```typescript
// Middleware or API route: detect Content-Encoding: gzip, decompress
import { gunzipSync } from 'zlib';

const encoding = req.headers['content-encoding'];
let body = await req.arrayBuffer();
if (encoding === 'gzip') {
  body = gunzipSync(Buffer.from(body));
}
const data = JSON.parse(body.toString());
```

---

## Web Dashboard Pages

### `/` — Landing Page
- Login / Register forms
- Brief description of what btest-rs-web does

### `/dashboard` — Main Dashboard (authenticated)
- **Summary cards**: Total runs, avg TX speed, avg RX speed, most tested server
- **Run history table**: Sortable by date, server, protocol, speed
  - Columns: Date, Server, Protocol, Direction, Duration, TX Avg, RX Avg, Lost, IP, SSID
  - Checkbox selection for bulk export/delete
  - Click row → expand inline or navigate to `/view/:id`
- **Filters**: Server dropdown, protocol toggle, date range picker
- **Actions**: Export CSV (selected), Delete (selected)
- **API Key section**: Show current key (masked), copy button, regenerate button

### `/view/:id` — Single Result View
- **Run metadata**: Server, protocol, direction, duration, timestamp, IP, SSID
- **Speed chart**: Canvas-based line chart
  - TX line: `#42A5F5` (blue)
  - RX line: `#66BB6A` (green)
  - X-axis: time (seconds)
  - Y-axis: speed (Mbps), auto-scaled
  - Grid lines, dot markers at data points
- **Statistics table**: Same layout as the Android app's stats section
- **Interval data table**: Expandable, raw per-second data
- **Share button**: Copy shareable link (if user enables public sharing)

### `/compare` — Compare Runs (authenticated)
- Select 2–5 runs from history
- Overlay speed graphs on a single chart (different colors per run)
- Side-by-side stats comparison table
- Useful for: before/after ISP changes, WiFi vs cellular, different servers

---

## Theme

Dark theme matching btest-rs-android:

```css
--background:    #121212;
--surface:       #1E1E1E;
--tx-blue:       #42A5F5;
--rx-green:      #66BB6A;
--text-primary:  #FFFFFF;
--text-secondary: #9E9E9E;
--error:         #EF5350;
--border:        #333333;
```

Font: system font stack (no external fonts to load).

---

## Project Structure

```
btest-rs-web/
├── app/
│   ├── layout.tsx                 # Root layout, theme, auth provider
│   ├── page.tsx                   # Landing / login
│   ├── dashboard/
│   │   └── page.tsx               # Main dashboard
│   ├── view/
│   │   └── [id]/
│   │       └── page.tsx           # Single result view with chart
│   ├── compare/
│   │   └── page.tsx               # Multi-run comparison
│   └── api/
│       ├── auth/
│       │   ├── register/route.ts
│       │   ├── login/route.ts
│       │   └── apikey/
│       │       └── route.ts       # GET current, POST regen
│       └── results/
│           ├── route.ts           # GET list, POST single
│           ├── batch/route.ts     # POST batch
│           ├── [id]/
│           │   ├── route.ts       # GET, DELETE single
│           │   └── csv/route.ts   # GET as CSV
│           └── export/
│               └── csv/route.ts   # POST bulk CSV export
├── lib/
│   ├── db.ts                      # Vercel Postgres connection
│   ├── auth.ts                    # JWT + bcrypt helpers
│   ├── middleware.ts              # Auth middleware (API key + JWT)
│   ├── csv.ts                     # CSV generation
│   └── types.ts                   # TypeScript interfaces
├── components/
│   ├── SpeedChart.tsx             # Canvas-based chart (client component)
│   ├── RunTable.tsx               # Sortable run history table
│   ├── StatsCard.tsx              # Summary stat card
│   └── IntervalTable.tsx          # Expandable interval data
├── .env.local                     # JWT_SECRET, DATABASE_URL
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```

---

## Environment Variables

```env
# Vercel Postgres (auto-populated by Vercel when you add the integration)
POSTGRES_URL=postgres://...
POSTGRES_PRISMA_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...

# Auth
JWT_SECRET=<random-64-char-hex>

# Optional
NEXT_PUBLIC_APP_URL=https://btest.example.com
```

---

## Deployment

```bash
# Install
npm install

# Local dev
npm run dev

# Deploy to Vercel
vercel deploy --prod

# Database setup (run once)
vercel env pull .env.local
npx tsx scripts/migrate.ts
```

---

## Android App Integration Points

The Android app needs these additions to support btest-rs-web:

### Settings to Store
- **Renderer URL**: e.g., `https://btest.example.com` (stored in SharedPreferences)
- **API Key**: `btk_...` (stored in SharedPreferences)
- **Auto-submit**: boolean, whether to POST results automatically after each test

### Network Info Collection
- **Public IP**: `GET https://ifconfig.co/ip` (plain text response, no parsing)
- **LAN IP**: `NetworkInterface.getNetworkInterfaces()` → find non-loopback IPv4
- **SSID**: `WifiManager.getConnectionInfo().ssid` (requires `ACCESS_FINE_LOCATION` on Android 8+; make optional)

### POST Flow
```
Test completes
  → Save to local Room DB (always)
  → If auto-submit enabled AND renderer URL configured:
      → Collect public_ip, lan_ip, ssid
      → Build JSON payload
      → Gzip compress
      → POST to {renderer_url}/api/results with API key
      → On success: store server-side ID in local DB
      → On failure: queue for retry (or just log error)
```

---

## Rate Limits

- **POST /api/results**: 60 requests/minute per API key
- **POST /api/results/batch**: 10 requests/minute per API key, max 100 runs per batch
- **GET endpoints**: 120 requests/minute per API key
- **Auth endpoints**: 10 requests/minute per IP

---

## Future Considerations (Not in v1)

- Public shareable links (user opts in per-run)
- Webhook notifications (Discord/Slack) on speed drops
- Historical speed trends chart (daily/weekly averages over time)
- Multi-device support (label results by device name)
- Import from btest-rs CLI CSV output
