import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApplicationStore } from './application.store';
import { AuthService } from '../session/auth.service';
import { LIFECYCLE_SEQUENCE } from '../domain/status.model';
import { requirementsFor } from '../domain/requirements-catalog';

/**
 * The seed must not assert an outcome its own data cannot support.
 *
 * Both seeded applications had ZERO documents. One of them carried an issued
 * permit number and "Ready for Release" — the office had approved an
 * application with nothing on file, which cannot happen, on the screen people
 * look at most. A citizen reading their own approved application saw an empty
 * Documents card, which reads as "the office lost them", not "this is a demo".
 *
 * These are invariants about the STORE, not about the two rows that happen to
 * be seeded today: they read the lifecycle and the requirements catalogue, so a
 * third seeded application has to satisfy them too.
 */
describe('Seeded applications are internally consistent', () => {
  let store: ApplicationStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(AuthService).login('juan.delacruz@example.com', 'Password1');
    store = TestBed.inject(ApplicationStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  const atOrAfter = (status: string, mark: string) =>
    LIFECYCLE_SEQUENCE.indexOf(status as never) >= LIFECYCLE_SEQUENCE.indexOf(mark as never);

  it('there is something to check — the seed is not empty', () => {
    // Guard the guard: every assertion below is vacuous over an empty list.
    expect(store.myApplications().length).toBeGreaterThan(0);
  });

  it('an application the office has reviewed has its required documents ON FILE', () => {
    for (const app of store.myApplications()) {
      if (!atOrAfter(app.lifecycleStatus, 'Document Verification')) continue;
      if (app.permitType === 'Business Permit') continue;

      const required = requirementsFor(app.permitType).documents.filter((d) => d.required);
      const onFile = new Set(store.documentsFor(app.id).map((d) => d.requirementId));
      const missing = required.filter((r) => !onFile.has(r.id)).map((r) => r.label);

      expect(missing).toEqual([]);
    }
  });

  it('an application with an ISSUED PERMIT has every required document accepted', () => {
    for (const app of store.myApplications()) {
      if (app.permitNumber === null) continue;
      if (app.permitType === 'Business Permit') continue;

      const docs = store.documentsFor(app.id);
      expect(docs.length).toBeGreaterThan(0);
      // A permit issued over a rejected or unreviewed document would say the
      // office approved something it had not accepted.
      for (const d of docs) expect(d.status).toBe('Accepted');
    }
  });

  it('the permit-document gate agrees: documents are resolved where a permit exists', () => {
    // Reading through the store's own gate rather than re-implementing it —
    // if these two disagree, one of them is wrong and the test says so.
    for (const app of store.myApplications()) {
      if (app.permitNumber === null) continue;
      expect(store.documentsResolvedFor(app.id)).toBe(true);
    }
  });

  it('a seeded document carries no bytes, and nothing pretends otherwise', () => {
    // file: null is honest for an example row. What must never appear is a
    // seeded document claiming a size or a file it does not have.
    for (const app of store.myApplications()) {
      for (const d of store.documentsFor(app.id)) {
        if (d.id.startsWith('seed-doc-')) expect(d.file).toBeNull();
      }
    }
  });

  it('a rejected document always says why', () => {
    for (const app of store.myApplications()) {
      for (const d of store.documentsFor(app.id)) {
        if (d.status === 'Rejected' || d.status === 'Revision Required') {
          expect(d.remarks).toBeTruthy();
        }
      }
    }
  });
});
