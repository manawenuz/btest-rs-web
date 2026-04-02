import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { gunzipSync } from 'zlib';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const intervalSchema = z.object({
  sec: z.number().int().positive(),
  dir: z.string(),
  speed_mbps: z.number(),
  bytes: z.number().int(),
  local_cpu: z.number().int().nullable().optional(),
  remote_cpu: z.number().int().nullable().optional(),
  lost: z.number().int().nullable().optional(),
});

const submitRunSchema = z.object({
  timestamp: z.string(),
  server: z.string().min(1),
  protocol: z.string().min(1),
  direction: z.string().min(1),
  duration_sec: z.number().int().positive(),
  tx_avg_mbps: z.number(),
  rx_avg_mbps: z.number(),
  tx_bytes: z.number().int(),
  rx_bytes: z.number().int(),
  lost: z.number().int().optional().default(0),
  public_ip: z.string().nullable().optional(),
  lan_ip: z.string().nullable().optional(),
  ssid: z.string().nullable().optional(),
  device_id: z.string().nullable().optional(),
  intervals: z.array(intervalSchema),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { success, remaining } = await rateLimit(`results-get:${auth.userId}`, {
      maxRequests: 120,
      windowMs: 60_000,
    });
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'X-RateLimit-Remaining': String(remaining) },
        }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const server = searchParams.get('server');
    const protocol = searchParams.get('protocol');
    const device = searchParams.get('device');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const offset = (page - 1) * limit;

    const sql = getDb();

    // Build conditions array for dynamic filtering
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    conditions.push(`user_id = $${paramIdx++}`);
    values.push(auth.userId);

    if (server) {
      conditions.push(`server = $${paramIdx++}`);
      values.push(server);
    }
    if (protocol) {
      conditions.push(`protocol = $${paramIdx++}`);
      values.push(protocol);
    }
    if (device) {
      conditions.push(`device_id = $${paramIdx++}`);
      values.push(device);
    }
    if (from) {
      conditions.push(`timestamp >= $${paramIdx++}`);
      values.push(from);
    }
    if (to) {
      conditions.push(`timestamp <= $${paramIdx++}`);
      values.push(to);
    }

    const whereClause = conditions.join(' AND ');

    // Use tagged template for simple queries with neon - build with unsafe for dynamic filters
    // Since neon sql template doesn't support dynamic WHERE easily, we'll use a pattern
    // that composes the query safely
    const countRows = await sql.query(
      `SELECT COUNT(*) as total FROM test_runs WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRows[0].total, 10);

    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;
    const runs = await sql.query(
      `SELECT id, timestamp, server, protocol, direction, duration_sec,
              tx_avg_mbps, rx_avg_mbps, tx_bytes, rx_bytes, lost,
              public_ip, lan_ip, ssid, device_id, created_at
       FROM test_runs
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...values, limit, offset]
    );

    return NextResponse.json({
      runs,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Get results error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { success, remaining } = await rateLimit(`results-post:${auth.userId}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'X-RateLimit-Remaining': String(remaining) },
        }
      );
    }

    // Handle gzip content encoding
    const encoding = request.headers.get('content-encoding');
    let rawBody = Buffer.from(await request.arrayBuffer());
    if (encoding === 'gzip') {
      rawBody = gunzipSync(rawBody);
    }
    const data = JSON.parse(rawBody.toString());

    const parsed = submitRunSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 422 }
      );
    }

    const run = parsed.data;
    const sql = getDb();

    // Insert the test run
    const [inserted] = await sql`
      INSERT INTO test_runs (
        user_id, timestamp, server, protocol, direction, duration_sec,
        tx_avg_mbps, rx_avg_mbps, tx_bytes, rx_bytes, lost,
        public_ip, lan_ip, ssid, device_id
      ) VALUES (
        ${auth.userId}, ${run.timestamp}, ${run.server}, ${run.protocol},
        ${run.direction}, ${run.duration_sec}, ${run.tx_avg_mbps},
        ${run.rx_avg_mbps}, ${run.tx_bytes}, ${run.rx_bytes}, ${run.lost},
        ${run.public_ip ?? null}, ${run.lan_ip ?? null}, ${run.ssid ?? null},
        ${run.device_id ?? null}
      )
      RETURNING id
    `;

    // Batch insert intervals
    if (run.intervals.length > 0) {
      for (const interval of run.intervals) {
        await sql`
          INSERT INTO test_intervals (
            run_id, interval_sec, direction, speed_mbps, bytes,
            local_cpu, remote_cpu, lost
          ) VALUES (
            ${inserted.id}, ${interval.sec}, ${interval.dir},
            ${interval.speed_mbps}, ${interval.bytes},
            ${interval.local_cpu ?? null}, ${interval.remote_cpu ?? null},
            ${interval.lost ?? null}
          )
        `;
      }
    }

    return NextResponse.json(
      { id: inserted.id, url: `/view/${inserted.id}` },
      { status: 201 }
    );
  } catch (error) {
    console.error('Submit result error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
