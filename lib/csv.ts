function escapeCsvField(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function generateCsvExport(
  email: string,
  runs: Record<string, any>[],
  intervalsByRunId: Record<string, Record<string, any>[]>
): string {
  const lines: string[] = [];

  lines.push('# btest-rs-web export');
  lines.push(`# user: ${email}`);
  lines.push(`# exported: ${new Date().toISOString()}`);
  lines.push(`# runs: ${runs.length}`);
  lines.push('#');

  lines.push('# SECTION: runs');
  lines.push(
    'run_id,timestamp,server,protocol,direction,duration_sec,tx_avg_mbps,rx_avg_mbps,tx_bytes,rx_bytes,lost,public_ip,lan_ip,ssid'
  );

  for (const run of runs) {
    lines.push(
      [
        escapeCsvField(run.id),
        escapeCsvField(run.timestamp),
        escapeCsvField(run.server),
        escapeCsvField(run.protocol),
        escapeCsvField(run.direction),
        escapeCsvField(run.duration_sec),
        escapeCsvField(run.tx_avg_mbps),
        escapeCsvField(run.rx_avg_mbps),
        escapeCsvField(run.tx_bytes),
        escapeCsvField(run.rx_bytes),
        escapeCsvField(run.lost),
        escapeCsvField(run.public_ip),
        escapeCsvField(run.lan_ip),
        escapeCsvField(run.ssid),
      ].join(',')
    );
  }

  lines.push('#');

  lines.push('# SECTION: intervals');
  lines.push(
    'run_id,interval_sec,direction,speed_mbps,bytes,local_cpu,remote_cpu,lost'
  );

  for (const run of runs) {
    const intervals = intervalsByRunId[run.id] || [];
    for (const interval of intervals) {
      lines.push(
        [
          escapeCsvField(run.id),
          escapeCsvField(interval.interval_sec),
          escapeCsvField(interval.direction),
          escapeCsvField(interval.speed_mbps),
          escapeCsvField(interval.bytes),
          escapeCsvField(interval.local_cpu),
          escapeCsvField(interval.remote_cpu),
          escapeCsvField(interval.lost),
        ].join(',')
      );
    }
  }

  return lines.join('\n') + '\n';
}
