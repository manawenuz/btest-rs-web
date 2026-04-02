import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

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

    const [run] = await sql`
      SELECT id, user_id, timestamp, server, protocol, direction, duration_sec,
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

    const intervals = await sql`
      SELECT interval_sec, direction, speed_mbps, bytes,
             local_cpu, remote_cpu, lost
      FROM test_intervals
      WHERE run_id = ${id}
      ORDER BY interval_sec ASC, direction ASC
    `;

    return NextResponse.json({
      id: run.id,
      timestamp: run.timestamp,
      server: run.server,
      protocol: run.protocol,
      direction: run.direction,
      duration_sec: run.duration_sec,
      tx_avg_mbps: run.tx_avg_mbps,
      rx_avg_mbps: run.rx_avg_mbps,
      tx_bytes: run.tx_bytes,
      rx_bytes: run.rx_bytes,
      lost: run.lost,
      public_ip: run.public_ip,
      lan_ip: run.lan_ip,
      ssid: run.ssid,
      created_at: run.created_at,
      intervals: intervals.map((i) => ({
        sec: i.interval_sec,
        dir: i.direction,
        speed_mbps: i.speed_mbps,
        bytes: i.bytes,
        local_cpu: i.local_cpu,
        remote_cpu: i.remote_cpu,
        lost: i.lost,
      })),
    });
  } catch (error) {
    console.error('Get result error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Delete the run (CASCADE will remove intervals)
    const result =
      await sql`DELETE FROM test_runs WHERE id = ${id} AND user_id = ${auth.userId} RETURNING id`;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Delete result error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
