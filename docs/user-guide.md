# btest-rs-web User Guide

This guide is for end users who register on a btest-rs-web instance, submit bandwidth test results, and view them on the web dashboard.

---

## What Is btest-rs-web?

btest-rs-web is a multi-user web dashboard that receives, stores, and visualizes bandwidth test results from the **btest-rs** ecosystem. It works with two client applications:

- **btest-rs** -- a Rust-based command-line bandwidth test tool
- **btest-rs-android** -- an Android app for running bandwidth tests on mobile devices

After each bandwidth test, the client automatically submits results to your btest-rs-web instance. You can then view interactive speed charts, compare runs over time, filter by server or device, and export data as CSV.

---

## Registering an Account

1. Open your btest-rs-web instance in a browser (e.g. `https://btest.example.com`).
2. On the landing page, switch to the **Register** tab.
3. Enter your email address and a password (minimum 8 characters).
4. Click **Register**.
5. You will be logged in automatically and redirected to the dashboard.

Upon registration, the system generates:
- A **JWT token** stored as an httpOnly cookie for browser sessions (valid for 7 days).
- An **API key** (prefixed `btk_`) used for programmatic access from Android or CLI clients.

---

## Navigating the Dashboard

The dashboard is your central hub at `/dashboard`. It contains several sections:

### Summary Cards

At the top of the dashboard, summary cards display aggregated statistics from your test history:

- **Total Runs** -- how many bandwidth tests you have submitted.
- **Average TX** -- your average upload speed across all runs (shown in blue, #42A5F5).
- **Average RX** -- your average download speed across all runs (shown in green, #66BB6A).
- **Latest Test** -- the timestamp of your most recent submission.

### Run History Table

Below the summary cards is a paginated table of all your test runs. Each row shows:

| Column | Description |
|---|---|
| Timestamp | When the test was conducted |
| Server | The test server IP or hostname |
| Protocol | TCP or UDP |
| Direction | send, receive, or both |
| Duration | Test duration in seconds |
| TX Avg (Mbps) | Average upload speed |
| RX Avg (Mbps) | Average download speed |
| Lost | Packets lost during the test |
| SSID | WiFi network name (if available) |
| Device | Device identifier (if available) |

Click on any column header to sort the table by that column. Click again to reverse the sort order.

The table displays 20 results per page. Use the pagination controls at the bottom to navigate between pages.

### Filtering

The filter bar above the run history table allows you to narrow results by:

- **Server** -- filter by a specific test server address.
- **Device** -- filter by a specific device ID.
- **Protocol** -- select TCP, UDP, or all.
- **Date range** -- set a start date (From) and end date (To) to limit results to a time window.

Filters are applied immediately and the table updates to show only matching results.

### Selecting Runs

Each row in the run history table has a checkbox. Select rows to:

- **Compare** selected runs (2 to 5 runs).
- **Export** selected runs as a CSV file.
- **Delete** selected runs.

A toolbar appears above the table when one or more rows are selected, showing the available bulk actions.

---

## Viewing a Single Test Result

Click on any row in the run history table to navigate to the single result view at `/view/<id>`.

### Metadata

The top of the page displays the test metadata:

- Timestamp, server, protocol, direction, duration
- Public IP and LAN IP of the client
- WiFi SSID and device ID (if submitted)

### Speed Chart

The main feature of the result view is an interactive speed chart rendered on an HTML canvas. It plots per-second speed measurements over the duration of the test:

- **Blue line (#42A5F5)** -- TX (upload) speed in Mbps
- **Green line (#66BB6A)** -- RX (download) speed in Mbps

The chart includes:
- Grid lines for easy reading
- Y-axis labels in Mbps with auto-scaled nice numbers
- X-axis labels in seconds
- Data point dots at each second interval
- A legend identifying TX and RX

### Statistics

Below the chart, a statistics section shows calculated values:

- Average TX and RX speed
- Total bytes transferred (TX and RX)
- Packet loss count
- Test duration

### Interval Data

An expandable table shows the raw per-second interval data with columns:

| Column | Description |
|---|---|
| Second | The 1-based second number |
| Direction | TX or RX |
| Speed (Mbps) | Speed during that second |
| Bytes | Bytes transferred during that second |
| Local CPU (%) | CPU usage on the client device |
| Remote CPU (%) | CPU usage on the test server |
| Lost | Packets lost during that second |

---

## Comparing Runs

To compare multiple test runs side by side:

1. On the dashboard, select 2 to 5 runs using the checkboxes.
2. Click the **Compare** button in the toolbar.
3. You will be taken to the comparison page at `/compare`.

The comparison page shows:

- **Overlay chart** -- all selected runs plotted on the same canvas, each with a distinct color. TX and RX lines for each run are shown so you can visually compare speed patterns.
- **Side-by-side statistics** -- a table comparing the key metrics (TX avg, RX avg, duration, bytes, loss) across all selected runs.

This is useful for comparing performance between different servers, protocols, WiFi networks, or times of day.

---

## Sharing Results

Individual test results are publicly accessible by their URL. Anyone with the link can view the result, including the speed chart and all metadata -- no login required.

### Share Link Button

On the single result view page (`/view/<id>`), use the **Share Link** button to copy the full URL to your clipboard. You can then share it with colleagues, paste it in a report, or post it in a chat.

The URL format is:

```
https://your-instance.vercel.app/view/<run-uuid>
```

Note: Only the single-result view is public. The dashboard, CSV exports, and delete operations still require authentication.

---

## Exporting Data

### Single Run CSV Export

On the single result view page, click the **Export CSV** button (or use the download icon). This downloads a CSV file containing:

- A header section with your email and export timestamp
- A **runs** section with the run metadata
- An **intervals** section with all per-second measurements

The file is named `btest-<short-id>.csv` (e.g. `btest-a1b2c3d4.csv`).

### Bulk Export from Dashboard

On the dashboard:

1. Select the runs you want to export using the checkboxes.
2. Click the **Export CSV** button in the toolbar.

This downloads a single CSV file containing all selected runs and their intervals, named `btest-export-<date>.csv` (e.g. `btest-export-2026-04-02.csv`).

### CSV File Format

The exported CSV file has two sections separated by comment lines:

```
# btest-rs-web export
# user: you@example.com
# exported: 2026-04-02T10:00:00.000Z
# runs: 3
#
# SECTION: runs
run_id,timestamp,server,protocol,direction,duration_sec,tx_avg_mbps,rx_avg_mbps,...
<data rows>
#
# SECTION: intervals
run_id,interval_sec,direction,speed_mbps,bytes,local_cpu,remote_cpu,lost
<data rows>
```

---

## Managing Your API Key

Your API key is used by the btest-rs Android app and CLI to submit results to your account. It is prefixed with `btk_` and looks like `btk_a1b2c3d4e5f6a7b8...`.

### Viewing and Copying

On the dashboard, your API key is displayed in the settings section. Click the **Copy** button next to it to copy the key to your clipboard.

### Regenerating

If your API key is compromised or you simply want a new one:

1. On the dashboard, click the **Regenerate API Key** button.
2. Confirm the action when prompted.
3. A new API key is generated and the old one is immediately invalidated.
4. Update the API key in your Android app or CLI configuration.

Important: Regenerating your API key invalidates the previous key immediately. Any clients using the old key will receive authentication errors until they are updated.

Note: API key regeneration requires JWT (session) authentication -- you cannot regenerate an API key using the API key itself. This prevents a leaked key from being used to replace itself.

---

## Password Reset

If email is configured on your btest-rs-web instance (the administrator must set this up):

1. On the login page, click **Forgot password?**
2. Enter the email address associated with your account.
3. Click **Send reset link**.
4. Check your email for a message from btest-rs-web with a reset link.
5. Click the link (valid for 1 hour).
6. Enter your new password (minimum 8 characters) and confirm.
7. You can now log in with your new password.

If the "Forgot password?" link is not visible on the login page, email has not been configured on this instance. Contact your administrator to reset your password manually.

For security, the system always responds with "If that email exists, a reset link has been sent" -- it does not reveal whether an account exists for a given email.

---

## Connecting Your Clients

### btest-rs-android (Android App)

In the Android app settings:

1. Set the **Renderer URL** to your btest-rs-web instance URL (e.g. `https://btest.example.com`). Do not include a trailing slash.
2. Paste your **API Key** (copied from the dashboard).
3. Enable **Auto-submit** to automatically upload results after each test.

After each test, the Android app will compress the results with gzip and POST them to your instance. The result will appear on your dashboard within seconds.

### btest-rs CLI (Rust Client)

In the CLI configuration file, set:

```
renderer_url = "https://btest.example.com"
api_key = "btk_your_api_key_here"
auto_submit = true
```

After each test run, the CLI will gzip-compress the result payload and submit it to your instance.

### What Gets Submitted

When a client submits a result, it includes:

- Test metadata: timestamp, server, protocol, direction, duration
- Aggregate results: average TX/RX speed, total bytes, packet loss
- Network info: public IP, LAN IP, WiFi SSID
- Device identifier: a stable ID unique to the device
- Per-second interval data: speed, bytes, CPU usage, and packet loss for each second of the test

All submissions are authenticated with your API key. Only you can see your results on the dashboard (though individual result view pages are publicly accessible by URL).
