# btest-rs-web Deployment Guide

This guide walks through deploying your own btest-rs-web instance. Two deployment paths are available:

| Path | Best For | Requirements |
|---|---|---|
| **Vercel** (recommended) | Quick setup, zero ops | GitHub + Vercel + Neon accounts (all free) |
| **Docker** | Self-hosted, full control | Any Linux server with Docker |

---

## Option A: Vercel Deployment

### Prerequisites

- **GitHub** ([github.com](https://github.com)) -- to fork the repository
- **Vercel** ([vercel.com](https://vercel.com)) -- to host the Next.js application
- **Neon** ([neon.tech](https://neon.tech)) -- to host the PostgreSQL database

All three offer free tiers. No credit card is required.

---

## Fork and Deploy (Recommended)

This is the fastest path. The entire process takes about 5 minutes.

### Step 1: Fork the Repository

1. Go to the btest-rs-web repository on GitHub.
2. Click the **Fork** button in the top-right corner.
3. Keep the default settings and click **Create fork**.
4. You now have your own copy at `github.com/YOUR_USERNAME/btest-rs-web`.

### Step 2: Create a Neon Postgres Database

1. Go to [console.neon.tech](https://console.neon.tech) and sign in.
2. Click **New Project**.
3. Configure the project:
   - **Project name**: `btest-rs-web` (or any name you prefer)
   - **Region**: Choose the region closest to your users. If deploying on Vercel, pick a Neon region in the same cloud region as your Vercel deployment (e.g. `us-east-1` for Vercel's default US region, or `eu-central-1` for European deployments).
   - **Postgres version**: Use the default (latest stable).
4. Click **Create Project**.
5. On the project dashboard, find the **Connection string**. It looks like:

   ```
   postgres://username:password@ep-cool-name-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

6. Copy this connection string. You will need it in the next step.

> **Tip**: The Neon free tier includes 512 MB of storage, which is more than enough for tens of thousands of test results.

### Step 3: Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Click **Import** next to your forked `btest-rs-web` repository. If it does not appear, click **Adjust GitHub App Permissions** to grant Vercel access to the repository.
3. On the configuration page, expand the **Environment Variables** section.
4. Add the following two environment variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Paste the Neon connection string from Step 2 |
   | `JWT_SECRET` | A random 64-character hex string (see below) |

5. To generate the `JWT_SECRET`, run this command in your terminal:

   ```bash
   openssl rand -hex 32
   ```

   This produces a 64-character hexadecimal string. Copy and paste it as the value.

6. Click **Deploy**.
7. Wait for the build to complete (typically 1--2 minutes).
8. Vercel assigns a URL like `btest-rs-web-xxx.vercel.app`. Click it to verify the landing page loads.

> **Alternative**: If you add the [Neon integration](https://vercel.com/integrations/neon) directly on Vercel, the `DATABASE_URL` / `POSTGRES_URL` variables are set automatically. You would still need to add `JWT_SECRET` manually.

### Step 4: Run the Database Migration

The first deploy creates the application but the database tables do not exist yet. Run the migration:

1. Open your browser and navigate to:

   ```
   https://your-app.vercel.app/api/migrate
   ```

2. You should see:

   ```json
   {"success": true, "message": "Database migrated successfully"}
   ```

3. If you see an error, verify that `DATABASE_URL` is set correctly on Vercel (Settings > Environment Variables).

### Step 5: Test Registration

1. Visit your deployed app at `https://your-app.vercel.app`.
2. Switch to the **Register** tab.
3. Enter an email and password (minimum 8 characters).
4. Click **Register**.
5. You should be redirected to the dashboard.
6. Your API key (`btk_...`) is displayed on the dashboard.

Your instance is now live and ready to receive test results.

### Step 6: Secure the Migration Endpoint

Now that the database is set up, secure the migration endpoint:

1. On Vercel, go to **Settings > Environment Variables**.
2. Add a new variable:

   | Variable | Value |
   |---|---|
   | `MIGRATE_SECRET` | A random string (e.g. `openssl rand -hex 16`) |

3. Redeploy (or the variable takes effect on the next deploy).
4. The `/api/migrate` endpoint now requires the `x-migrate-secret` header:

   ```bash
   curl -H "x-migrate-secret: your-secret" https://your-app.vercel.app/api/migrate
   ```

---

## Custom Domain Setup

To use a custom domain (e.g. `btest.example.com`) instead of the default `.vercel.app` URL:

1. On Vercel, go to your project **Settings > Domains**.
2. Enter your custom domain and click **Add**.
3. Vercel displays DNS records to configure. Typically:
   - **CNAME**: Point `btest.example.com` to `cname.vercel-dns.com`
   - Or **A record**: Point to Vercel's IP address (for apex domains).
4. Add the DNS records at your domain registrar.
5. Wait for DNS propagation (5--60 minutes).
6. Vercel automatically provisions an SSL certificate.
7. Optionally set `NEXT_PUBLIC_APP_URL=https://btest.example.com` in your Vercel environment variables. This ensures password reset email links use your custom domain.

---

## Email Setup (Optional)

Email is required only for the password reset feature. Without it, everything else works normally.

### Step 1: Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up.
2. The free tier provides 100 emails/day, which is sufficient for password resets.

### Step 2: Create an API Key

1. In the Resend dashboard, navigate to **API Keys**.
2. Click **Create API Key**.
3. Name it `btest-rs-web` and select **Sending access**.
4. Copy the key (format: `re_xxxxxxxxxxxx`).

### Step 3: Verify Your Domain (Recommended for Production)

Using the default `noreply@resend.dev` sender works for testing but emails may go to spam.

1. In Resend, go to **Domains** and click **Add Domain**.
2. Enter your domain (e.g. `example.com`).
3. Resend provides DNS records to add:

   | Record Type | Name | Value |
   |---|---|---|
   | MX | (varies) | Provided by Resend |
   | TXT | (varies) | SPF record provided by Resend |
   | CNAME | `resend._domainkey` | DKIM record provided by Resend |

4. Add these DNS records at your domain registrar.
5. Click **Verify** in Resend (may take 5--60 minutes for propagation).

### Step 4: Configure Environment Variables

Add these to your Vercel project (Settings > Environment Variables):

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | `re_your_api_key_here` |
| `EMAIL_FROM` | `btest-rs-web <noreply@yourdomain.com>` |

### Step 5: Test

1. Log out of your btest-rs-web instance.
2. On the login page, you should now see a **Forgot password?** link.
3. Click it, enter your email, and verify you receive the reset email.
4. The email is styled with the btest-rs-web dark theme (dark background, blue header, blue reset button).

---

## Local Development Setup

For developing and testing locally:

### Step 1: Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/btest-rs-web.git
cd btest-rs-web
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```
DATABASE_URL=postgres://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
JWT_SECRET=any-random-string-at-least-32-chars-for-dev
```

You can use the same Neon database as production (for testing) or create a separate Neon project/branch for development.

### Step 4: Run Migration

```bash
npx tsx scripts/migrate.ts
```

You should see: `Migration completed successfully.`

### Step 5: Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Updating Your Instance

When the upstream repository has new features or fixes:

### Sync Your Fork

```bash
# Add upstream remote (one-time setup)
git remote add upstream https://github.com/manawenuz/btest-rs-web.git

# Fetch and merge latest changes
git fetch upstream
git merge upstream/main

# Push to your fork (triggers Vercel redeploy)
git push origin main
```

### Run Migration After Update

Some updates include database schema changes. After redeployment, run the migration:

```bash
curl -H "x-migrate-secret: your-secret" https://your-app.vercel.app/api/migrate
```

Or visit the URL in your browser if `MIGRATE_SECRET` is not set.

### Verify

Check `/api/version` to confirm the new commit is deployed:

```bash
curl https://your-app.vercel.app/api/version
```

---

## Option B: Docker Deployment

Self-host btest-rs-web on any server with Docker. Two compose files are provided:

| File | Use Case |
|---|---|
| `compose.yml` | You have your own reverse proxy (nginx, traefik, etc.) |
| `compose.caddy.yml` | Includes Caddy as a reverse proxy with automatic HTTPS |

### Prerequisites

- A Linux server (VPS, dedicated, etc.) with Docker and Docker Compose installed
- A domain name pointing to your server (for HTTPS)
- Ports 80 and 443 open (for the Caddy variant)

### Deploy with Your Own Reverse Proxy

This runs the app on port 3000. Point your existing reverse proxy to it.

```bash
# Clone the repository
git clone https://github.com/manawenuz/btest-rs-web.git
cd btest-rs-web

# Configure environment
cp .env.example .env
```

Edit `.env`:

```env
POSTGRES_PASSWORD=a-strong-database-password
JWT_SECRET=paste-output-of-openssl-rand-hex-32
NEXT_PUBLIC_APP_URL=https://btest.example.com

# Optional — password reset emails
# RESEND_API_KEY=re_xxxxxxxxxxxx
# EMAIL_FROM=btest-rs-web <noreply@yourdomain.com>
```

```bash
# Start the stack
docker compose up -d

# Wait for containers to be healthy (~30 seconds)
docker compose ps

# Run database migration
curl http://localhost:3000/api/migrate
```

The app is now running on `http://localhost:3000`. Configure your reverse proxy to forward traffic to it.

### Deploy with Caddy (Automatic HTTPS)

This includes Caddy as a reverse proxy that auto-provisions Let's Encrypt certificates.

```bash
git clone https://github.com/manawenuz/btest-rs-web.git
cd btest-rs-web

cp .env.example .env
```

Edit `.env`:

```env
DOMAIN=btest.example.com
POSTGRES_PASSWORD=a-strong-database-password
JWT_SECRET=paste-output-of-openssl-rand-hex-32

# Optional — password reset emails
# RESEND_API_KEY=re_xxxxxxxxxxxx
# EMAIL_FROM=btest-rs-web <noreply@yourdomain.com>
```

```bash
# Start the stack with the Caddy compose file
docker compose -f compose.caddy.yml up -d

# Wait for Caddy to provision the certificate (~30 seconds)
# Run migration
curl https://btest.example.com/api/migrate
```

Your instance is live at `https://btest.example.com` with automatic HTTPS.

### Docker Architecture

```mermaid
graph TB
    subgraph Server
        subgraph "Docker Compose"
            CA[Caddy<br/>Reverse Proxy<br/>Auto HTTPS]
            APP[btest-rs-web<br/>Next.js App<br/>:3000]
            DB[(PostgreSQL 16<br/>:5432)]
        end
    end

    CL[Clients<br/>Android / CLI / Browser] -->|HTTPS :443| CA
    CA -->|HTTP :3000| APP
    APP -->|TCP :5432| DB

    style CA fill:#1E1E1E,stroke:#42A5F5,color:#FFFFFF
    style APP fill:#1E1E1E,stroke:#66BB6A,color:#FFFFFF
    style DB fill:#1E1E1E,stroke:#FFA726,color:#FFFFFF
```

> In the `compose.yml` variant (without Caddy), replace the Caddy box with your own reverse proxy.

### Managing the Docker Deployment

```bash
# View logs
docker compose logs -f app
docker compose logs -f db

# Restart the app (after pulling updates)
git pull
docker compose up -d --build

# Run migration after updates
curl http://localhost:3000/api/migrate

# Stop everything
docker compose down

# Stop and remove data (destructive!)
docker compose down -v

# Check database
docker compose exec db psql -U btest -d btest -c "SELECT count(*) FROM test_runs;"
```

### Updating a Docker Deployment

```bash
cd btest-rs-web
git pull origin main
docker compose up -d --build
curl http://localhost:3000/api/migrate
curl http://localhost:3000/api/version
```

### Docker Troubleshooting

**App can't connect to database**: The `db` container must be healthy before `app` starts. Check with `docker compose ps`. If db shows `unhealthy`, check `docker compose logs db`.

**Port 3000 already in use**: Change the port mapping in `compose.yml`: `"8080:3000"` instead of `"3000:3000"`.

**Caddy can't provision certificate**: Ensure your domain's DNS A record points to the server's public IP, and ports 80/443 are open.

**Permission denied on volume**: Run `docker compose down -v` and `docker compose up -d` to recreate volumes with correct permissions.

---

## Deployment Architecture

```mermaid
graph TB
    subgraph Clients
        A[btest-rs-android<br/>Android App]
        B[btest-rs CLI<br/>Rust Client]
        C[Web Browser]
    end

    subgraph Vercel
        D[Vercel Edge Network<br/>CDN + SSL + Routing]
        E[Next.js 16<br/>API Routes + SSR]
    end

    subgraph Neon
        F[(Neon Postgres<br/>Serverless Database)]
    end

    subgraph Resend
        G[Resend Email API<br/>Password Reset Emails]
    end

    A -->|HTTPS + gzip<br/>API key auth| D
    B -->|HTTPS + gzip<br/>API key auth| D
    C -->|HTTPS<br/>Cookie auth| D
    D --> E
    E -->|Neon serverless driver<br/>over WebSocket| F
    E -.->|Optional<br/>Password reset| G
    G -.->|SMTP| C
```

### How the Pieces Fit Together

1. **Clients** (Android app, CLI, or browser) make HTTPS requests to the Vercel Edge Network.
2. **Vercel** terminates SSL, routes requests to the appropriate Next.js API route or serves the frontend.
3. **Next.js API routes** handle authentication (JWT or API key), validate input (Zod schemas), and query the database.
4. **Neon Postgres** stores all data. The `@neondatabase/serverless` driver connects over WebSocket, which is compatible with Vercel's serverless functions (no persistent TCP connections needed).
5. **Resend** (optional) sends password reset emails when configured.

---

## Troubleshooting

### Missing DATABASE_URL

**Symptom**: 500 Internal Server Error on all endpoints.

**Error in logs**: `DATABASE_URL or POSTGRES_URL environment variable is required`

**Fix**: Add `DATABASE_URL` in Vercel Settings > Environment Variables with your Neon connection string. Redeploy.

### Table Does Not Exist

**Symptom**: 500 error on register, login, or result submission.

**Error in logs**: `relation "users" does not exist`

**Fix**: Run the migration by visiting `https://your-app.vercel.app/api/migrate`.

### 500 on Register

**Symptom**: Registration fails with a 500 error.

**Possible causes**:
- Database not migrated (see above).
- `DATABASE_URL` points to a database that is unreachable (check Neon project status).
- Neon project is suspended (free tier suspends after 5 days of inactivity -- reactivate in Neon console).

### Email Not Sending

**Symptom**: Password reset email never arrives.

**Check list**:
1. Is `RESEND_API_KEY` set? Check with `GET /api/auth/email-enabled` -- it should return `{"enabled": true}`.
2. Is the domain verified in Resend? Unverified domains may have sending restrictions.
3. Check the spam/junk folder.
4. Check Resend dashboard for failed deliveries or bounces.
5. Verify `EMAIL_FROM` uses an address on your verified domain.

### CORS Issues

**Symptom**: Browser console shows CORS errors when calling the API from a different origin.

**Explanation**: btest-rs-web is designed as a single-origin application where the frontend and API are on the same domain. If you need cross-origin access (e.g. calling the API from a different frontend), you would need to add CORS headers to the API routes.

For Android and CLI clients, CORS does not apply -- it is a browser-only restriction. These clients connect directly to the API with no CORS considerations.

### 403 on Migration Endpoint

**Symptom**: Accessing `/api/migrate` returns `{"error": "Unauthorized: invalid or missing migration secret"}`

**Fix**: Include the `x-migrate-secret` header:

```bash
curl -H "x-migrate-secret: your-secret-value" https://your-app.vercel.app/api/migrate
```

If you have forgotten the secret, update it in Vercel Settings > Environment Variables and redeploy.

### Build Failures on Vercel

**Symptom**: Deployment fails during the build step.

**Check**:
1. Ensure `package.json` is at the root of the repository.
2. Check Vercel build logs for TypeScript errors.
3. Verify the framework preset is set to **Next.js** (check `vercel.json` has `"framework": "nextjs"`).

### Database Connection Timeouts

**Symptom**: Requests hang or time out after 10 seconds.

**Possible causes**:
- Neon project is in a different region than Vercel functions.
- Neon project is waking up from suspension (free tier cold start can take 2--5 seconds on first request).
- Connection string is malformed.

**Fix**: Ensure `?sslmode=require` is at the end of your connection string. Consider choosing a Neon region that matches your Vercel deployment region.
