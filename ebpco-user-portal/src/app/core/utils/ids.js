let counter = 1000;
/** Simple incrementing id generator for this mock/in-memory build — swap for server-issued ids once a backend is wired to this portal (see master command Section 15, Open Decision #3). */
export function nextId(prefix) {
    counter += 1;
    return `${prefix}-${counter}`;
}
export function todayIso() {
    return new Date().toISOString();
}
export function formatDate(iso) {
    if (!iso)
        return '—';
    return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
export function formatDateTime(iso) {
    if (!iso)
        return '—';
    return new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
