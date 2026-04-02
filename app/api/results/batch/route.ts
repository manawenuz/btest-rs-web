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

const batchSchema = z.object({
  runs: z.array(submitRunSchema).min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { success, remaining } = await rateLimit(`results-batch:${auth.userId}`, {
      maxRequests: 10,
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

    const parsed = batchSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 422 }
      );
    }

    const { runs } = parsed.data;
    const sql = getDb();
    const ids: string[] = [];

    // Insert runs sequentially (neon doesn't support native transactions)
    for (const run of runs) {
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

      ids.push(inserted.id);

      // Insert intervals for this run
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
      { ids, count: ids.length },
      { status: 201 }
    );
  } catch (error) {
    console.error('Batch submit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
