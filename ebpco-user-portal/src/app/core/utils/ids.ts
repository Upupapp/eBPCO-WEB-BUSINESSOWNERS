let counter = 1000;

/** Simple incrementing id generator for this mock/in-memory build — swap for server-issued ids once a real backend exists (see master command Section 15, Open Decision #3). */
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function todayIso(): string {
  return new Date().toISOString();
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
