/**
 * A business's DTI / SEC / CDA registration number, checked the way the
 * server checks it (`businesses/registration-number.ts`, QA finding TC-24,
 * 2026-10-03: "x" was accepted, printed on the business and shown to staff,
 * and could never be corrected). Said here first so the citizen reads the
 * reason beside the field instead of after a round trip.
 *
 * Loose on purpose: the three registries number differently, and this portal
 * is not the registry. It refuses what cannot be one. Null when acceptable.
 */
export function registrationNumberProblem(value: string): string | null {
  const number = value.trim();
  if (number.length < 5 || number.length > 40) {
    return 'Enter the DTI, SEC or CDA registration number exactly as it appears on the certificate (5 to 40 characters).';
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 ./-]*$/.test(number)) {
    return 'A registration number has only letters, numbers, spaces, hyphens, slashes and periods.';
  }
  if ((number.match(/\d/g) ?? []).length < 4) {
    return 'A registration number has at least 4 digits. Copy it from the DTI, SEC or CDA certificate.';
  }
  return null;
}

/** Registered on a real day (YYYY-MM-DD), and not in the future. */
export function registrationDateProblem(value: string, today: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Enter the registration date as it appears on the certificate.';
  const day = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value) {
    return 'Enter the registration date as it appears on the certificate.';
  }
  const local = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  if (value > local) return 'The registration date cannot be in the future.';
  return null;
}
