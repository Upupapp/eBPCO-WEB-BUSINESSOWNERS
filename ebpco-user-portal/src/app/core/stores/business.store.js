import { __decorate } from "tslib";
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { nextId, todayIso } from '../utils/ids';
import { CitizenApiClient } from '../api/citizen-api.client';
import { ApiError } from '../api/problem';
let regSeq = 100;
/**
 * `BusinessSummary` (the server's real wire shape) → `Business` (this
 * portal's local domain type). A faithful mapping, unlike
 * `ApplicationStore`'s equivalent — `businesses.controller.ts`'s
 * `onTheWire()` already returns exactly the same fields this type needs,
 * so nothing here is a placeholder. `status` is cast rather than validated
 * against `BusinessStatus`'s two literals: the server column is a plain
 * string and this portal has never had a route that could produce a third
 * value, but do not treat the cast as proof one cannot appear.
 */
function fromServerBusiness(row, ownerApplicantId) {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        ownerApplicantId,
        street: row.street,
        barangay: row.barangay,
        city: row.city,
        province: row.province,
        registrationNumber: row.registrationNumber,
        dateRegistered: row.dateRegistered,
        status: row.status,
    };
}
let BusinessStore = class BusinessStore {
    auth;
    businesses = signal([]);
    api = inject(CitizenApiClient);
    /**
     * Real businesses, from `GET /businesses`. `null` means "not fetched"
     * (or not configured, e.g. a unit test) — distinct from `[]`, "fetched,
     * genuinely none yet" — the same pattern `ApplicationStore.realApplications`
     * uses, for the same reason.
     */
    realBusinesses = signal(null);
    /** True once real data is the source of truth — gates the Edit action (C-5, write-once server-side). */
    usingReal = computed(() => this.realBusinesses() !== null);
    constructor(auth) {
        this.auth = auth;
        this.seed();
        effect(() => {
            if (this.auth.isAuthenticated() && this.api.configured) {
                void this.refreshMine();
            }
            else {
                this.realBusinesses.set(null);
            }
        });
    }
    async refreshMine() {
        try {
            const response = await firstValueFrom(this.api.listBusinesses());
            const ownerId = this.auth.currentUser()?.id ?? '';
            this.realBusinesses.set(response.data.map((row) => fromServerBusiness(row, ownerId)));
        }
        catch {
            // Leave whatever was there before — a transient failure should not
            // make a citizen's own businesses appear to vanish.
        }
    }
    seed() {
        this.businesses.set([
            {
                id: 'biz-1',
                name: 'Dela Cruz Hardware & Construction Supply',
                category: 'Retail',
                ownerApplicantId: 'user-demo',
                street: '123 Rizal Street',
                barangay: 'Poblacion',
                city: 'Castilla',
                province: 'Sorsogon',
                registrationNumber: 'REG-2025-041',
                dateRegistered: '2025-03-10T00:00:00.000Z',
                status: 'Active',
            },
            {
                id: 'biz-2',
                name: "Juan's Eatery",
                category: 'Food Service',
                ownerApplicantId: 'user-demo',
                street: '45 National Highway',
                barangay: 'San Isidro',
                city: 'Castilla',
                province: 'Sorsogon',
                registrationNumber: 'REG-2025-088',
                dateRegistered: '2025-07-22T00:00:00.000Z',
                status: 'Active',
            },
        ]);
    }
    myBusinesses = computed(() => {
        const real = this.realBusinesses();
        if (real !== null)
            return real;
        const ownerId = this.auth.currentUser()?.id;
        if (!ownerId)
            return [];
        return this.businesses().filter((b) => b.ownerApplicantId === ownerId);
    });
    businessById(id) {
        const real = this.realBusinesses();
        const foundReal = real?.find((b) => b.id === id);
        if (foundReal)
            return foundReal;
        return this.businesses().find((b) => b.id === id);
    }
    register(input) {
        const ownerId = this.auth.currentUser().id;
        regSeq += 1;
        const business = {
            id: nextId('biz'),
            name: input.name,
            category: input.category,
            ownerApplicantId: ownerId,
            street: input.street,
            barangay: input.barangay,
            city: input.city,
            province: input.province,
            registrationNumber: `REG-${new Date().getFullYear()}-${regSeq}`,
            dateRegistered: todayIso(),
            status: 'Active',
        };
        this.businesses.update((list) => [business, ...list]);
        return business;
    }
    /**
     * `POST /businesses` for real. `registrationNumber`/`dateRegistered` are
     * REQUIRED by the server (unlike the local `register()` above, which
     * invents them) — the caller must collect both from the citizen.
     */
    async registerReal(request) {
        try {
            const summary = await firstValueFrom(this.api.registerBusiness(request));
            await this.refreshMine();
            return { ok: true, id: summary.id };
        }
        catch (error) {
            return {
                ok: false,
                error: error instanceof ApiError ? error.citizenMessage : 'We could not reach the Municipality’s system. Check your connection and try again.',
            };
        }
    }
    /**
     * Update a business the signed-in citizen owns.
     *
     * Does NOT touch applications already filed. `ApplicationRecord.businessName`
     * is a snapshot of the name as it stood when the application was submitted,
     * and the office assessed it under that name — rewriting it here would
     * silently restate what the Municipality received, and an applicant could
     * change the name on a filed application after the fact. The correct route
     * for a name change on a live application is an Amendment, which is why the
     * wizard now has one.
     *
     * Refuses a business the citizen does not own rather than returning
     * undefined: a silent no-op on someone else's record is indistinguishable
     * from success.
     */
    update(id, input) {
        const ownerId = this.auth.currentUser()?.id;
        const existing = this.businesses().find((b) => b.id === id);
        if (!existing || !ownerId || existing.ownerApplicantId !== ownerId) {
            throw new Error('That business could not be found in your account.');
        }
        const updated = {
            ...existing,
            name: input.name.trim(),
            category: input.category,
            street: input.street.trim(),
            barangay: input.barangay.trim(),
            city: input.city.trim(),
            province: input.province.trim(),
        };
        this.businesses.update((list) => list.map((b) => (b.id === id ? updated : b)));
        return updated;
    }
};
BusinessStore = __decorate([
    Injectable({ providedIn: 'root' })
], BusinessStore);
export { BusinessStore };
