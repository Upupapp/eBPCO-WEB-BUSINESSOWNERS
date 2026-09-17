import { ApiError } from '../api/problem';
/**
 * A fake `CitizenIdentityApi`, standing in for a real backend unit tests must
 * not depend on being up. Auth became real HTTP once the User Portal was
 * wired to `eBPCOBackend` (see `auth.service.ts`) — every spec that used to
 * log into the old in-memory mock needs something to answer `signIn`, and
 * this is that something, seeded with the same demo identity the old mock
 * shipped, reached through the exact shape `AuthService` actually calls in
 * production so these tests exercise real call sites, not a parallel path.
 *
 * Provide via `{ provide: CitizenIdentityApi, useClass: FakeCitizenIdentityApi }`
 * alongside `provideHttpClient()` + `provideHttpClientTesting()` (still
 * required: `AuthService` constructs `CitizenIdentityApi`, which injects
 * `HttpClient`, even though this fake never calls it).
 */
export class FakeCitizenIdentityApi {
    account = {
        id: 'user-demo',
        kind: 'applicant',
        email: 'juan.delacruz@example.com',
        emailVerifiedAt: '2026-01-15T00:00:00.000Z',
        mobileVerifiedAt: '2026-01-15T00:00:00.000Z',
        firstName: 'Juan',
        middleName: 'Santos',
        lastName: 'Dela Cruz',
        mobileNumber: '09171234567',
        street: 'Purok 3, Zone 2',
        barangay: 'Poblacion',
        city: 'Castilla',
        province: 'Sorsogon',
        postalCode: '4712',
        dateOfBirth: '1990-05-12',
        sex: 'Male',
        civilStatus: 'Married',
        nationality: 'Filipino',
    };
    async signIn(email, password) {
        if (email === this.account.email && password === 'Password1')
            return { ...this.account };
        throw new ApiError(401, { title: 'Check your email and password and try again' }, false);
    }
    async register() { }
    async signOut() { }
    me() {
        return Promise.resolve({ ...this.account });
    }
    async requestPasswordReset() { }
    async resetPassword() {
        return { kind: 'done' };
    }
}
