import { Injectable, computed, signal } from '@angular/core';
import { AuthService } from '../session/auth.service';
import { Business, BusinessCategory } from '../domain/business.model';
import { nextId, todayIso } from '../utils/ids';

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

@Injectable({ providedIn: 'root' })
export class BusinessStore {
  private readonly businesses = signal<Business[]>([]);

  constructor(private readonly auth: AuthService) {
    this.seed();
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
    const ownerId = this.auth.currentUser()?.id;
    if (!ownerId) return [];
    return this.businesses().filter((b) => b.ownerApplicantId === ownerId);
  });

  businessById(id: string): Business | undefined {
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
}
