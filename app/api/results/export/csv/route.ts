import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { generateCsvExport } from '@/lib/csv';

const exportSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
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

    const body = await request.json();
    const parsed = exportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 422 }
      );
    }

    const { ids } = parsed.data;
    const sql = getDb();

    // Fetch all specified runs belonging to the user
    const runs = await sql`
      SELECT id, timestamp, server, protocol, direction, duration_sec,
             tx_avg_mbps, rx_avg_mbps, tx_bytes, rx_bytes, lost,
             public_ip, lan_ip, ssid, created_at
      FROM test_runs
      WHERE id = ANY(${ids}) AND user_id = ${auth.userId}
      ORDER BY created_at DESC
    `;

    if (runs.length === 0) {
      return NextResponse.json(
        { error: 'No matching test runs found' },
        { status: 404 }
      );
    }

    // Fetch all intervals for the found runs
    const runIds = runs.map((r) => r.id);
    const intervals = await sql`
      SELECT run_id, interval_sec, direction, speed_mbps, bytes,
             local_cpu, remote_cpu, lost
      FROM test_intervals
      WHERE run_id = ANY(${runIds})
      ORDER BY run_id, interval_sec ASC, direction ASC
    `;

    // Group intervals by run_id
    const intervalsMap: Record<string, typeof intervals> = {};
    for (const interval of intervals) {
      if (!intervalsMap[interval.run_id]) {
        intervalsMap[interval.run_id] = [];
      }
      intervalsMap[interval.run_id].push(interval);
    }

    // Fetch user email for CSV header
    const [user] = await sql`
      SELECT email FROM users WHERE id = ${auth.userId} LIMIT 1
    `;

    const csv = generateCsvExport(user.email, runs, intervalsMap);

    const today = new Date().toISOString().split('T')[0];
    const filename = `btest-export-${today}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Bulk CSV export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
