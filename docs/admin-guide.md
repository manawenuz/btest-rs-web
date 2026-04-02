# btest-rs-web Administration Guide

This guide is for administrators who deploy, configure, and maintain a btest-rs-web instance.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | -- | Neon Postgres connection string. Format: `postgres://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require` |
| `JWT_SECRET` | Yes | `dev-secret-change-me` | Random secret used to sign JWT tokens with HS256. Must be at least 32 characters. Generate with `openssl rand -hex 32`. |
| `MIGRATE_SECRET` | No | -- | Protects the `/api/migrate` endpoint. When set, requests must include the `x-migrate-secret` header with this value. When not set, the endpoint is open (convenient for initial setup). |
| `RESEND_API_KEY` | No | -- | API key from [Resend](https://resend.com) for sending password reset emails. Without this, the "Forgot password?" feature is disabled. Format: `re_xxxxxxxxxxxx`. |
| `EMAIL_FROM` | No | `btest-rs-web <noreply@resend.dev>` | The sender address for password reset emails. Use a verified domain for production (e.g. `btest-rs-web <noreply@yourdomain.com>`). |
| `NEXT_PUBLIC_APP_URL` | No | Auto-detected from `Host` header | Your app's canonical public URL (e.g. `https://btest.example.com`). Used in password reset email links. If not set, the system falls back to the request's `Host` header. |

Note: `POSTGRES_URL` is also supported as a fallback alias for `DATABASE_URL`, providing compatibility with the Vercel Neon integration which sets `POSTGRES_URL` automatically.

---

## Database Migrations

### Via the Web Endpoint

After deploying, run the database migration by accessing:

```
GET https://your-app.vercel.app/api/migrate
```

On success, you receive:

```json
{"success": true, "message": "Database migrated successfully"}
```

The migration creates all required tables (`users`, `test_runs`, `test_intervals`, `password_reset_tokens`) and indexes. It uses `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`, so it is safe to run multiple times.

### Via CLI Script

For local development or CI pipelines, run the migration directly:

```bash
npx tsx scripts/migrate.ts
```

This executes the same migration logic as the web endpoint.

### Securing the Migrate Endpoint

In production, set the `MIGRATE_SECRET` environment variable. Once set, the endpoint requires the secret in a custom header:

```bash
curl -H "x-migrate-secret: your-secret-value" https://your-app.vercel.app/api/migrate
```

Requests without the correct header receive a `403 Forbidden` response. If `MIGRATE_SECRET` is not configured, the endpoint is open to anyone -- this is only acceptable during initial setup.

---

## Setting Up Email for Password Reset

Password reset requires the [Resend](https://resend.com) email service. Without it, the "Forgot password?" link does not appear on the login page.

### Step 1: Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up.
2. Resend offers a free tier sufficient for most btest-rs-web instances.

### Step 2: Get Your API Key

1. In the Resend dashboard, go to **API Keys**.
2. Create a new API key with "Sending access" permission.
3. Copy the key (it starts with `re_`).

### Step 3: Verify Your Domain (Recommended)

Using the default `noreply@resend.dev` sender works for testing but emails may land in spam. For production:

1. In Resend, go to **Domains** and add your domain (e.g. `yourdomain.com`).
2. Resend will provide DNS records to add.

### Step 4: Add DNS Records

Add the following DNS records to your domain registrar:

| Type | Name | Value | Purpose |
|---|---|---|---|
| MX | -- | Provided by Resend | Mail routing |
| TXT | -- | `v=spf1 include:resend.com ~all` | SPF verification |
| CNAME | `resend._domainkey` | Provided by Resend | DKIM signing |

Wait for DNS propagation (typically 5--60 minutes), then click **Verify** in Resend.

### Step 5: Configure Environment Variables

Add these environment variables on Vercel (or in `.env.local` for local development):

```
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=btest-rs-web <noreply@yourdomain.com>
```

### Step 6: Test

1. Register a test account on your instance.
2. Log out.
3. Click "Forgot password?" and enter the test email.
4. Verify that the reset email arrives.
5. Click the reset link and confirm that password reset works.

---

## Monitoring

### Vercel Logs

If deployed on Vercel, check application logs at:

```
https://vercel.com/<team>/<project>/logs
```

All errors are logged to `console.error` with descriptive prefixes (e.g. `Registration error:`, `Submit result error:`, `Migration error:`). Search for these prefixes to find issues.

### Version Endpoint

The `/api/version` endpoint returns deployment metadata:

```json
{
  "name": "btest-rs-web",
  "version": "0.1.0",
  "commit": "a1b2c3d",
  "ref": "main",
  "deployed": "btest-rs-web-xxx.vercel.app"
}
```

Use this to verify which version is deployed, especially after updates. The `commit` field shows the short Git SHA, and `ref` shows the branch.

---

## Rate Limits

The application uses in-memory rate limiting to protect against abuse. Each limit uses a sliding window that resets after the specified time period.

| Endpoint | Key | Limit | Window |
|---|---|---|---|
| `POST /api/auth/register` | IP address | 10 requests | 1 minute |
| `POST /api/auth/login` | IP address | 10 requests | 1 minute |
| `POST /api/auth/forgot-password` | IP address | 5 requests | 1 minute |
| `POST /api/auth/reset-password` | IP address | 10 requests | 1 minute |
| `POST /api/results` | User ID | 60 requests | 1 minute |
| `POST /api/results/batch` | User ID | 10 requests | 1 minute |
| `GET /api/results` | User ID | 120 requests | 1 minute |

### How It Works

The rate limiter stores counters in a `Map` in process memory. Each key (IP or user ID) gets a counter that increments with each request and resets after the window expires. A background cleanup interval runs every 60 seconds to remove expired entries.

### Trade-offs

- **Resets on cold start**: Since the store is in-memory, all rate limit counters reset when the serverless function cold-starts. On Vercel, functions may scale to zero during inactivity.
- **Per-instance**: Each serverless function instance has its own rate limit store. Under high concurrency, Vercel may spin up multiple instances, each with independent counters. This means the effective rate limit could be higher than configured.
- **No persistence**: Rate limits are not persisted to the database. This is intentional to avoid adding latency to every request.

For most btest-rs-web deployments (personal or small team use), this is sufficient. If you need stricter rate limiting, consider adding an external rate limiter (e.g. Vercel Edge Middleware with KV, or Upstash Redis).

---

## Database Management

### Neon Console

Access your database at [console.neon.tech](https://console.neon.tech). From the Neon console you can:

- Browse tables and data
- Run SQL queries manually
- View connection statistics
- Manage branches and backups

### Manual User Management

To list all users:

```sql
SELECT id, email, created_at FROM users ORDER BY created_at DESC;
```

To reset a user's password manually (if email is not configured):

```sql
-- Generate a bcrypt hash for the new password using an external tool,
-- then update:
UPDATE users SET password_hash = '$2a$10$...' WHERE email = 'user@example.com';
```

To delete a user and all their data (CASCADE removes test_runs and intervals):

```sql
DELETE FROM users WHERE email = 'user@example.com';
```

To view how many test runs each user has:

```sql
SELECT u.email, COUNT(r.id) as run_count
FROM users u
LEFT JOIN test_runs r ON r.user_id = u.id
GROUP BY u.email
ORDER BY run_count DESC;
```

---

## Updating Your Instance

### If Deployed via Vercel (Connected to GitHub)

1. If you forked the repository, sync your fork with upstream:

   ```bash
   git remote add upstream https://github.com/manawenuz/btest-rs-web.git
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```

2. Vercel automatically redeploys when you push to the connected branch.

3. After deployment, run the migration endpoint again to apply any new schema changes:

   ```
   GET https://your-app.vercel.app/api/migrate
   ```

   The migration is idempotent (safe to run repeatedly).

### Verify the Update

Check `/api/version` to confirm the new commit SHA is deployed.

---

## Security Considerations

### JWT Secret

- Use a cryptographically random string of at least 32 characters: `openssl rand -hex 32`.
- Never commit the JWT secret to source control.
- If the secret is compromised, rotate it immediately by changing the `JWT_SECRET` environment variable. This will invalidate all existing sessions -- users will need to log in again.
- JWTs are signed with HS256 and expire after 7 days.

### HTTPS Enforcement

- Vercel enforces HTTPS by default on all deployments.
- Session cookies are set with `secure: true` in production, meaning they are only sent over HTTPS.
- If you deploy to a custom domain, ensure SSL is configured (Vercel handles this automatically).

### Cookie Settings

Session cookies are configured with:

| Setting | Value | Purpose |
|---|---|---|
| `httpOnly` | `true` | Prevents JavaScript access to the cookie (XSS mitigation) |
| `secure` | `true` (production) | Cookie only sent over HTTPS |
| `sameSite` | `lax` | CSRF protection -- cookie sent on top-level navigations but not on cross-site subrequests |
| `path` | `/` | Cookie available to all routes |
| `maxAge` | 7 days | Cookie expiration |

### Password Hashing

Passwords are hashed using **bcrypt** with a cost factor of 10 (via `bcryptjs`). This produces hashes of the form `$2a$10$...`. The cost factor of 10 provides a good balance between security and performance on serverless functions.

### API Key Format

API keys follow the format `btk_` followed by 32 hex characters (16 random bytes). Example: `btk_a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8`.

- API keys are stored in plaintext in the database (they need to be looked up for authentication).
- Each user has exactly one API key at a time.
- Regenerating a key immediately invalidates the previous one.
- API key regeneration requires JWT authentication, not the API key itself, to prevent a leaked key from being used to replace itself.

### Password Reset Token Security

Reset tokens are handled securely:

- A 32-byte random token is generated (64 hex characters).
- Only the **SHA-256 hash** of the token is stored in the database. The raw token is sent to the user via email.
- Tokens expire after **1 hour**.
- Tokens are single-use -- they are marked as `used = TRUE` after the password is reset.
- When a new reset is requested, all existing unused tokens for that user are invalidated.
- The forgot-password endpoint always returns the same response regardless of whether the email exists, preventing email enumeration attacks.

---

## Backup Strategy

### Neon Built-in Features

Neon Postgres provides several backup capabilities:

- **Point-in-time recovery**: Neon stores a continuous WAL (Write-Ahead Log) and supports branching from any point in time within the retention window.
- **Database branching**: Create a branch of your database for testing migrations or debugging issues, without affecting production data.
- **Auto-suspend and scale-to-zero**: The database suspends after inactivity, but data is persisted on Neon's storage layer.

### Manual Backups

For additional safety, you can export data periodically:

```bash
# Export all data using pg_dump
pg_dump "postgres://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require" > backup.sql
```

Or use the CSV export feature in the web UI to export test results per user.

### Disaster Recovery

If you need to restore from a backup:

1. Create a new Neon project (or branch).
2. Import the SQL dump: `psql "connection-string" < backup.sql`.
3. Update the `DATABASE_URL` environment variable on Vercel to point to the new database.
4. Redeploy.

---

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---|---|---|
| 500 on any endpoint | `DATABASE_URL` not set or invalid | Verify the env var on Vercel. Check Neon is accessible. |
| "relation does not exist" | Migration not run | Access `/api/migrate` to create tables. |
| "Forgot password?" not visible | `RESEND_API_KEY` not configured | Add the Resend API key to environment variables. |
| Reset email not arriving | Domain not verified in Resend | Complete DNS verification in Resend dashboard. Check spam folder. |
| 403 on `/api/migrate` | `MIGRATE_SECRET` set but header missing | Include `x-migrate-secret` header in the request. |
| Sessions expire immediately | `JWT_SECRET` changed between deploys | Ensure `JWT_SECRET` is consistent. Users must re-login after rotation. |
