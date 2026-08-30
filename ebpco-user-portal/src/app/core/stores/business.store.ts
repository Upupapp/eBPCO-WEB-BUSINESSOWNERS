import { Injectable, computed, signal } from '@angular/core';
import { AuthService } from '../session/auth.service';
import { Business, BusinessCategory } from '../domain/business.model';
import { nextId, todayIso } from '../utils/ids';

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
}
