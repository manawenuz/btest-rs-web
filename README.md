# btest-rs-web

Bandwidth test result dashboard and renderer for the [btest-rs](https://github.com/manawenuz/btest-rs) ecosystem.

| btest-rs (CLI) | btest-rs-android | **btest-rs-web** |
|---|---|---|
| Rust bandwidth test client/server | Android client app | Result dashboard (this project) |

A multi-user web application that receives, stores, and visualizes bandwidth test results submitted by btest-rs-android (or any client implementing the API). Users authenticate, submit results automatically after each test, and view interactive charts and history on a web dashboard.

**Stack:** Next.js 16 (App Router) · TypeScript · Neon Postgres · Vercel

---

## Deploy Your Own Instance

The fastest way to get running is to fork this repo and deploy on Vercel. The whole process takes about 5 minutes.

### Step 1: Fork This Repository

Click the **Fork** button at the top-right of this GitHub page to create your own copy.

### Step 2: Create a Neon Postgres Database

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project (any name, e.g. `btest-rs-web`)
3. Copy the connection string — it looks like:
   ```
   postgres://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

### Step 3: Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** and select your forked repository
3. In the **Environment Variables** section, add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Your Neon connection string from Step 2 |
   | `JWT_SECRET` | A random string (generate with `openssl rand -hex 32`) |

4. Click **Deploy**

> **Alternative:** If you add the [Neon integration](https://vercel.com/integrations/neon) directly on Vercel, the `DATABASE_URL` / `POSTGRES_URL` variables are set automatically.

### Step 4: Run Database Migration

After the first deploy, run the migration to create the database tables. Open this URL in your browser:

```
https://your-app.vercel.app/api/migrate
```

You should see `{"success":true,"message":"Database migrated successfully"}`.

> **Security:** To protect this endpoint in production, set a `MIGRATE_SECRET` environment variable on Vercel, then access the endpoint with the header `x-migrate-secret: your-secret`.

### Step 5: Register and Start Using

1. Visit your deployed app at `https://your-app.vercel.app`
2. Register a new account
3. Copy your API key from the dashboard
4. Configure your btest-rs-android app with your server URL and API key

That's it! Your instance is live.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `JWT_SECRET` | Yes | Random secret for signing JWTs (min 32 chars) |
| `MIGRATE_SECRET` | No | Protects the `/api/migrate` endpoint |
| `NEXT_PUBLIC_APP_URL` | No | Your app's public URL |

> `POSTGRES_URL` is also supported as a fallback alias for `DATABASE_URL`, for compatibility with the Vercel Neon integration.

---

## Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/btest-rs-web.git
cd btest-rs-web

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Neon database URL and a JWT secret

# Run database migration
npx tsx scripts/migrate.ts

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Reference

All API endpoints accept and return JSON. Authentication uses either JWT tokens (from login) or API keys (for programmatic use).

### Authentication

#### Register
```
POST /api/auth/register
Content-Type: application/json

{ "email": "user@example.com", "password": "minimum8chars" }

→ 201 { "token": "eyJ...", "api_key": "btk_..." }
→ 409 email already exists
→ 422 validation error
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "..." }

→ 200 { "token": "eyJ...", "api_key": "btk_..." }
→ 401 invalid credentials
```

#### Get Current User
```
GET /api/auth/me
Authorization: Bearer <JWT or API key>

→ 200 { "id": "...", "email": "...", "api_key": "btk_...", "created_at": "..." }
```

#### Regenerate API Key
```
POST /api/auth/apikey
Authorization: Bearer <JWT>  (API key auth NOT allowed here)

→ 200 { "api_key": "btk_..." }
```

### Submit Results

#### Single Run
```
POST /api/results
Authorization: Bearer btk_...
Content-Type: application/json
Content-Encoding: gzip  (recommended)

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
  "device_id": "a1b2c3d4e5f6a7b8",
  "intervals": [
    {
      "sec": 1, "dir": "TX", "speed_mbps": 280.50,
      "bytes": 35062500, "local_cpu": 15, "remote_cpu": 60, "lost": null
    },
    {
      "sec": 1, "dir": "RX", "speed_mbps": 270.30,
      "bytes": 33787500, "local_cpu": 15, "remote_cpu": 60, "lost": 0
    }
  ]
}

→ 201 { "id": "a1b2c3d4-...", "url": "/view/a1b2c3d4-..." }
```

#### Batch Submit
```
POST /api/results/batch
Authorization: Bearer btk_...
Content-Encoding: gzip  (required)

{ "runs": [ { ...same as single... }, ... ] }

→ 201 { "ids": ["..."], "count": 2 }
```

### Query Results

```
GET /api/results?page=1&limit=20&server=...&protocol=TCP&from=2026-04-01&to=2026-04-02
Authorization: Bearer <JWT or API key>

→ 200 { "runs": [...], "total": 142, "page": 1, "limit": 20 }
```

```
GET /api/results/:id
→ 200  Full run with intervals array

DELETE /api/results/:id
→ 204

GET /api/results/:id/csv
→ text/csv download
```

### Export
```
POST /api/results/export/csv
Authorization: Bearer <JWT or API key>
{ "ids": ["a1b2c3d4-...", "e5f6g7h8-..."] }

→ text/csv download
```

---

## Client Integration Guide

This section covers how **btest-rs-android** and **btest-rs** (CLI) should submit results to the web dashboard.

### Configuration

The client needs three settings (stored in SharedPreferences on Android, config file on CLI):

| Setting | Example | Description |
|---|---|---|
| **Renderer URL** | `https://your-app.vercel.app` | Your btest-rs-web instance URL |
| **API Key** | `btk_a1b2c3d4e5f6...` | Copied from the web dashboard |
| **Auto-submit** | `true` | Whether to POST results after each test |

### Device ID

Each client must include a stable `device_id` that uniquely identifies the device. This enables per-device tracking on the dashboard without extra registration.

| Platform | How to Get | Persistence |
|---|---|---|
| **Android** | `Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)` | Survives reboots, reset on factory reset |
| **Linux** | Read `/etc/machine-id` | Stable across reboots, generated at OS install |
| **macOS** | `ioreg -rd1 -c IOPlatformExpertDevice \| awk '/IOPlatformUUID/'` | Hardware-bound, never changes |
| **Windows** | `reg query "HKLM\SOFTWARE\Microsoft\Cryptography" /v MachineGuid` | Stable across reboots |
| **BSD** | `sysctl -n kern.hostuuid` | Stable across reboots |

**Android (Kotlin):**
```kotlin
val deviceId = Settings.Secure.getString(
    context.contentResolver,
    Settings.Secure.ANDROID_ID
)
```

**Linux/BSD (Rust):**
```rust
let device_id = std::fs::read_to_string("/etc/machine-id")
    .unwrap_or_default()
    .trim()
    .to_string();
```

### Collecting Network Info

Before submitting, the client should collect:

```kotlin
// Public IP (simple HTTP call)
val publicIp = URL("https://ifconfig.co/ip").readText().trim()

// LAN IP
val lanIp = NetworkInterface.getNetworkInterfaces().toList()
    .flatMap { it.inetAddresses.toList() }
    .firstOrNull { !it.isLoopbackAddress && it is Inet4Address }
    ?.hostAddress

// WiFi SSID (requires ACCESS_FINE_LOCATION on Android 8+, make optional)
val wifiManager = context.getSystemService(Context.WIFI_SERVICE) as WifiManager
val ssid = wifiManager.connectionInfo.ssid?.removeSurrounding("\"")
```

### Submission Payload

**Full JSON structure** that the client must send:

```json
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
  "device_id": "a1b2c3d4e5f6a7b8",
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
```

**Field reference:**

| Field | Type | Required | Description |
|---|---|---|---|
| `timestamp` | ISO 8601 string | Yes | When the test ran (client time) |
| `server` | string | Yes | Test server address (IP or hostname) |
| `protocol` | string | Yes | `"TCP"` or `"UDP"` |
| `direction` | string | Yes | `"send"`, `"receive"`, or `"both"` |
| `duration_sec` | integer | Yes | Test duration in seconds |
| `tx_avg_mbps` | float | Yes | Average upload speed in Mbps |
| `rx_avg_mbps` | float | Yes | Average download speed in Mbps |
| `tx_bytes` | integer | Yes | Total bytes sent |
| `rx_bytes` | integer | Yes | Total bytes received |
| `lost` | integer | No | Packets lost (default 0) |
| `public_ip` | string | No | Client's public IP |
| `lan_ip` | string | No | Client's LAN IP |
| `ssid` | string | No | WiFi network name |
| `device_id` | string | No | Stable device identifier (see table above) |
| `intervals` | array | Yes | Per-second measurement samples |

**Interval fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `sec` | integer | Yes | Second number (1-based) |
| `dir` | string | Yes | `"TX"` or `"RX"` |
| `speed_mbps` | float | Yes | Speed during this second |
| `bytes` | integer | Yes | Bytes transferred during this second |
| `local_cpu` | integer | No | Local CPU usage % |
| `remote_cpu` | integer | No | Remote CPU usage % |
| `lost` | integer | No | Packets lost during this second |

### Submitting (Android/Kotlin)

```kotlin
fun submitResult(rendererUrl: String, apiKey: String, json: String) {
    val url = URL("$rendererUrl/api/results")

    // Gzip compress the JSON
    val compressed = ByteArrayOutputStream().use { baos ->
        GZIPOutputStream(baos).use { gz ->
            gz.write(json.toByteArray(Charsets.UTF_8))
        }
        baos.toByteArray()
    }

    val conn = url.openConnection() as HttpURLConnection
    conn.requestMethod = "POST"
    conn.doOutput = true
    conn.setRequestProperty("Authorization", "Bearer $apiKey")
    conn.setRequestProperty("Content-Type", "application/json")
    conn.setRequestProperty("Content-Encoding", "gzip")
    conn.connectTimeout = 10_000
    conn.readTimeout = 10_000

    conn.outputStream.use { it.write(compressed) }

    val responseCode = conn.responseCode
    if (responseCode == 201) {
        val body = conn.inputStream.bufferedReader().readText()
        // body = {"id": "uuid-...", "url": "/view/uuid-..."}
        // Store the server-side ID in your local Room DB
    } else {
        val error = conn.errorStream?.bufferedReader()?.readText()
        Log.e("BtestWeb", "Submit failed ($responseCode): $error")
        // Queue for retry or log error
    }
}
```

### Submitting (Rust/CLI)

```rust
use flate2::write::GzEncoder;
use flate2::Compression;
use std::io::Write;

fn submit_result(renderer_url: &str, api_key: &str, json: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Gzip compress
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(json.as_bytes())?;
    let compressed = encoder.finish()?;

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(format!("{}/api/results", renderer_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("Content-Encoding", "gzip")
        .body(compressed)
        .send()?;

    if resp.status() == 201 {
        let body: serde_json::Value = resp.json()?;
        println!("Submitted: {}", body["url"]);
    } else {
        eprintln!("Submit failed ({}): {}", resp.status(), resp.text()?);
    }
    Ok(())
}
```

### Submission Flow

```
Test completes
  → Save to local storage (Room DB on Android, SQLite on CLI)
  → If auto-submit enabled AND renderer URL configured:
      1. Collect: public_ip, lan_ip, ssid, device_id
      2. Build JSON payload (see structure above)
      3. Gzip compress (required for payloads > 1 KB)
      4. POST to {renderer_url}/api/results
         Headers: Authorization: Bearer btk_...
                  Content-Type: application/json
                  Content-Encoding: gzip
      5. On 201: store server-side ID locally for linking
      6. On failure: queue for retry (exponential backoff)
```

### Batch Submission

For submitting multiple queued results at once:

```
POST {renderer_url}/api/results/batch
Headers: same as above
Body: { "runs": [ {...}, {...}, ... ] }
Limits: max 100 runs per batch, 10 requests/min
Response: { "ids": ["...", "..."], "count": 2 }
```

### Rate Limits

| Endpoint | Limit |
|---|---|
| `POST /api/results` | 60/min per API key |
| `POST /api/results/batch` | 10/min per API key, max 100 runs |
| `GET` endpoints | 120/min per API key |
| Auth endpoints | 10/min per IP |

---

## Web Dashboard

### Pages

- **`/`** — Landing page with login/register forms
- **`/dashboard`** — Main dashboard with summary stats, run history table, filters, bulk export/delete, API key management
- **`/view/:id`** — Single test result with speed chart, statistics, and interval data
- **`/compare`** — Compare 2–5 test runs side-by-side with overlaid charts

### Theme

Dark theme matching the Android app:

| Token | Color | Use |
|---|---|---|
| Background | `#121212` | Page background |
| Surface | `#1E1E1E` | Cards, chart backgrounds |
| TX Blue | `#42A5F5` | Upload speed data |
| RX Green | `#66BB6A` | Download speed data |
| Error | `#EF5350` | Errors, packet loss |
| Border | `#333333` | Borders, grid lines |

---

## Project Structure

```
btest-rs-web/
├── app/
│   ├── layout.tsx              # Root layout, dark theme
│   ├── page.tsx                # Landing / login
│   ├── globals.css             # Theme variables, global styles
│   ├── dashboard/page.tsx      # Main dashboard
│   ├── view/[id]/page.tsx      # Single result view with chart
│   ├── compare/page.tsx        # Multi-run comparison
│   └── api/
│       ├── auth/
│       │   ├── register/route.ts
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   ├── me/route.ts
│       │   └── apikey/route.ts
│       ├── results/
│       │   ├── route.ts            # GET list, POST single
│       │   ├── batch/route.ts
│       │   ├── [id]/route.ts       # GET, DELETE single
│       │   ├── [id]/csv/route.ts
│       │   └── export/csv/route.ts
│       └── migrate/route.ts
├── components/
│   ├── SpeedChart.tsx          # Canvas-based speed chart
│   ├── RunTable.tsx            # Sortable run history table
│   ├── StatsCard.tsx           # Summary stat card
│   ├── IntervalTable.tsx       # Expandable interval data
│   ├── AuthForm.tsx            # Login/register form
│   └── Filters.tsx             # Dashboard filter bar
├── lib/
│   ├── db.ts                   # Neon Postgres connection + migration
│   ├── auth.ts                 # JWT, bcrypt, API key helpers
│   ├── csv.ts                  # CSV export generation
│   ├── rate-limit.ts           # In-memory rate limiter
│   └── types.ts                # TypeScript interfaces
├── scripts/
│   └── migrate.ts              # CLI migration script
├── .env.example
├── vercel.json
├── package.json
└── tsconfig.json
```

---

## License

MIT
