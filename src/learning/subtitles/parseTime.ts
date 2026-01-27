export function parseTimestampToMs(ts: string): number {
  // Supports:
  // - SRT: 00:00:01,234
  // - VTT: 00:00:01.234 or 00:01.234
  const s = ts.trim();
  const normalized = s.replace(',', '.');
  const parts = normalized.split(':');
  let h = 0;
  let m = 0;
  let secMs = '0';

  if (parts.length === 3) {
    h = Number(parts[0]);
    m = Number(parts[1]);
    secMs = parts[2];
  } else if (parts.length === 2) {
    m = Number(parts[0]);
    secMs = parts[1];
  } else if (parts.length === 1) {
    secMs = parts[0];
  } else {
    throw new Error(`Invalid timestamp: ${ts}`);
  }

  const [secStr, msStr = '0'] = secMs.split('.');
  const sec = Number(secStr);
  const ms = Number(msStr.padEnd(3, '0').slice(0, 3));

  if ([h, m, sec, ms].some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid timestamp: ${ts}`);
  }

  return (((h * 60 + m) * 60 + sec) * 1000) + ms;
}


