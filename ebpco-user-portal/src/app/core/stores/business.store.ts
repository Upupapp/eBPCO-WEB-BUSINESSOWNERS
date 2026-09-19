import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../session/auth.service';
import { Business, BusinessCategory } from '../domain/business.model';
import { nextId, todayIso } from '../utils/ids';
import { CitizenApiClient } from '../api/citizen-api.client';
import { BusinessSummary, SubmitBusinessRequest } from '../api/citizen-api.models';
import { ApiError } from '../api/problem';

/**
 * What a citizen may change about their own business.
 *
 * Deliberately NOT the whole of `Business`. `registrationNumber` and
 * `dateRegistered` are system-generated, `ownerApplicantId` is who the record
 * belongs to, and `status` is the Municipality's judgement — a form that let a
 * citizen set their own business to Active would be offering them a decision
 * that is not theirs to make. Those four are unreachable from here by
 * construction rather than by the form omitting them.
 */
export interface EditBusinessInput {
  name: string;
  category: BusinessCategory;
  street: string;
  barangay: string;
  city: string;
  province: string;
}

export interface RegisterBusinessInput {
  name: string;
  category: BusinessCategory;
  street: string;
  barangay: string;
  city: string;
  province: string;
}

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
function fromServerBusiness(row: BusinessSummary, ownerApplicantId: string): Business {
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
    status: row.status as Business['status'],
  };
}

@Injectable({ providedIn: 'root' })
export class BusinessStore {
  private readonly businesses = signal<Business[]>([]);
  private readonly api = inject(CitizenApiClient);

  /**
   * Real businesses, from `GET /businesses`. `null` means "not fetched"
   * (or not configured, e.g. a unit test) — distinct from `[]`, "fetched,
   * genuinely none yet" — the same pattern `ApplicationStore.realApplications`
   * uses, for the same reason.
   */
  private readonly realBusinesses = signal<Business[] | null>(null);

  /**
   * True once real data is the source of truth. `updateReal`/`deactivateReal`/
   * `reactivateReal` exist now (PATCH /businesses/:id and its two status
   * routes) — this no longer gates WHETHER a citizen may edit a business,
   * only which methods (`update()` vs `updateReal()`) the page should call.
   */
  readonly usingReal = computed(() => this.realBusinesses() !== null);

  constructor(private readonly auth: AuthService) {
    this.seed();
    effect(() => {
      if (this.auth.isAuthenticated() && this.api.configured) {
        void this.refreshMine();
      } else {
        this.realBusinesses.set(null);
      }
    });
  }

  async refreshMine(): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.listBusinesses());
      const ownerId = this.auth.currentUser()?.id ?? '';
      this.realBusinesses.set(response.data.map((row) => fromServerBusiness(row, ownerId)));
    } catch {
      // Leave whatever was there before — a transient failure should not
      // make a citizen's own businesses appear to vanish.
    }
  }

  private seed(): void {
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

  readonly myBusinesses = computed(() => {
    const real = this.realBusinesses();
    if (real !== null) return real;
    const ownerId = this.auth.currentUser()?.id;
    if (!ownerId) return [];
    return this.businesses().filter((b) => b.ownerApplicantId === ownerId);
  });

  businessById(id: string): Business | undefined {
    const real = this.realBusinesses();
    const foundReal = real?.find((b) => b.id === id);
    if (foundReal) return foundReal;
    return this.businesses().find((b) => b.id === id);
  }

  register(input: RegisterBusinessInput): Business {
    const ownerId = this.auth.currentUser()!.id;
    regSeq += 1;
    const business: Business = {
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
  async registerReal(
    request: SubmitBusinessRequest,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    try {
      const summary = await firstValueFrom(this.api.registerBusiness(request));
      await this.refreshMine();
      return { ok: true, id: summary.id };
    } catch (error) {
      return { ok: false, error: this.messageFor(error) };
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
  update(id: string, input: EditBusinessInput): Business {
    const ownerId = this.auth.currentUser()?.id;
    const existing = this.businesses().find((b) => b.id === id);
    if (!existing || !ownerId || existing.ownerApplicantId !== ownerId) {
      throw new Error('That business could not be found in your account.');
    }
    const updated: Business = {
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

  /** Local-demo counterpart to `deactivateReal`/`reactivateReal` below — same ownership guard as `update()`, no server call. */
  setStatus(id: string, status: Business['status']): Business {
    const ownerId = this.auth.currentUser()?.id;
    const existing = this.businesses().find((b) => b.id === id);
    if (!existing || !ownerId || existing.ownerApplicantId !== ownerId) {
      throw new Error('That business could not be found in your account.');
    }
    const updated: Business = { ...existing, status };
    this.businesses.update((list) => list.map((b) => (b.id === id ? updated : b)));
    return updated;
  }

  /** `PATCH /businesses/:id` for real — the same field set `update()` above changes locally, sent to the server and the real list refreshed from its answer. */
  async updateReal(id: string, input: EditBusinessInput): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await firstValueFrom(this.api.updateBusiness(id, {
        name: input.name.trim(),
        category: input.category,
        street: input.street.trim(),
        barangay: input.barangay.trim(),
        city: input.city.trim(),
        province: input.province.trim(),
      }));
      await this.refreshMine();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.messageFor(error) };
    }
  }

  /** `POST /businesses/:id/deactivate` — the server itself refuses this while an application against the business is still in progress; see that route's own doc comment. */
  async deactivateReal(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await firstValueFrom(this.api.deactivateBusiness(id));
      await this.refreshMine();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.messageFor(error) };
    }
  }

  /** `POST /businesses/:id/reactivate` — reverses `deactivateReal`. */
  async reactivateReal(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await firstValueFrom(this.api.reactivateBusiness(id));
      await this.refreshMine();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.messageFor(error) };
    }
  }

  private messageFor(error: unknown): string {
    return error instanceof ApiError
      ? error.citizenMessage
      : 'We could not reach the Municipality’s system. Check your connection and try again.';
  }
}
