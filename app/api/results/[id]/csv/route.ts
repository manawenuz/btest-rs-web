import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { generateCsvExport } from '@/lib/csv';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const sql = getDb();

    // Fetch the run ensuring it belongs to the authenticated user
    const [run] = await sql`
      SELECT id, timestamp, server, protocol, direction, duration_sec,
             tx_avg_mbps, rx_avg_mbps, tx_bytes, rx_bytes, lost,
             public_ip, lan_ip, ssid, created_at
      FROM test_runs
      WHERE id = ${id} AND user_id = ${auth.userId}
      LIMIT 1
    `;

    if (!run) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      );
    }

    // Fetch intervals for this run
    const intervals = await sql`
      SELECT run_id, interval_sec, direction, speed_mbps, bytes,
             local_cpu, remote_cpu, lost
      FROM test_intervals
      WHERE run_id = ${id}
      ORDER BY interval_sec ASC, direction ASC
    `;

    // Fetch user email for CSV header
    const [user] = await sql`
      SELECT email FROM users WHERE id = ${auth.userId} LIMIT 1
    `;

    // Build intervals map: { runId: intervals[] }
    const intervalsMap: Record<string, typeof intervals> = {
      [run.id]: intervals,
    };

    const csv = generateCsvExport(user.email, [run], intervalsMap);

    const shortId = run.id.split('-')[0];
    const filename = `btest-${shortId}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('CSV export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
