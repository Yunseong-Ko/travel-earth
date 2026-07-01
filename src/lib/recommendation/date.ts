const DAY_MS = 24 * 60 * 60 * 1000;

export function parseIsoDateUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function formatIsoDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysIso(date: string, days: number): string {
  const value = parseIsoDateUtc(date);
  value.setUTCDate(value.getUTCDate() + days);
  return formatIsoDateUtc(value);
}

export function diffDaysIso(start: string, end: string): number {
  const startMs = parseIsoDateUtc(start).getTime();
  const endMs = parseIsoDateUtc(end).getTime();
  return Math.round((endMs - startMs) / DAY_MS);
}

export function eachDateInclusive(start: string, end: string): string[] {
  const list: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    list.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }

  return list;
}

