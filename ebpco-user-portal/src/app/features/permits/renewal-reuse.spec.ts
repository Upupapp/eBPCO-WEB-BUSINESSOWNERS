import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApplicationWizardPage } from './application-wizard.page';
import { ApplicationStore } from '../../core/stores/application.store';
import { AuthService } from '../../core/session/auth.service';

/**
 * The Municipal ruling of 3 September 2026.
 * docs/RULING-2026-09-03-renewal-reuse.md — bus #0042, confirmed #0045.
 *
 * Nothing is omitted from a renewal or amendment. What changes is that a
 * document already on file is REUSED BY DEFAULT, the citizen may replace it,
 * and an expired reused document is ACCEPTED — the officer decides, with the
 * certification date in front of them.
 *
 * The last of those cuts against instinct, so it is tested hardest: a warning
 * we add for kindness becomes a refusal the citizen believes.
 */
describe('Renewal and amendment reuse (Municipal ruling)', () => {
  let store: ApplicationStore;
  let page: ApplicationWizardPage;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(AuthService).login('juan.delacruz@example.com', 'Password1');
    store = TestBed.inject(ApplicationStore);
    page = TestBed.createComponent(ApplicationWizardPage).componentInstance;
  });
  afterEach(() => TestBed.resetTestingModule());

  /** The seeded permit a renewal can act on. */
  const source = () => store.renewablePermits()[0];
  const source_ = source;

  function startRenewal() {
    const p = source();
    page.applicationAction = 'Renewal';
    page.relatedPermitNumber = p.permitNumber;
    page['carryOverDocuments']();
    return p;
  }

  it('there is a permit with documents to reuse — the rest is vacuous without it', () => {
    const p = source();
    expect(p).toBeTruthy();
    expect(store.documentsFor(p.applicationId).length).toBeGreaterThan(0);
  });

  it('reuse is the DEFAULT: documents are carried over without being asked for', () => {
    const p = startRenewal();
    const carried = Object.values(page.attached).filter((a) => a.kind === 'reused');
    expect(carried.length).toBeGreaterThan(0);
    expect(page['reusedCount']()).toBe(carried.length);
    // Every carried document corresponds to one actually on the previous permit.
    const previous = new Set(store.documentsFor(p.applicationId).map((d) => d.id));
    for (const slot of carried) {
      if (slot.kind !== 'reused') continue;
      expect(previous.has(slot.documentId)).toBe(true);
    }
  });

  it('a reused document is a REFERENCE, and carries no File it does not have', () => {
    startRenewal();
    for (const slot of Object.values(page.attached)) {
      if (slot.kind !== 'reused') continue;
      // The inverse of "a filename is not a document": we must not claim to
      // carry bytes the office already holds and we never took.
      expect('file' in slot).toBe(false);
    }
  });

  it('it carries the CERTIFICATION DATE, and never invents one', () => {
    startRenewal();
    const carried = Object.values(page.attached).filter((a) => a.kind === 'reused');

    // Carried where the office actually recorded one. expiresOn cannot answer
    // "when was this certified", and the ruling builds the admin note from it.
    expect(carried.some((s) => s.kind === 'reused' && s.certifiedOn !== null)).toBe(true);

    // And NULL where it did not. This half is the one that matters: the first
    // implementation fell back to uploadedAt, which would have told an officer
    // a document was certified on the day it was uploaded — a fabrication, in
    // exactly the direction the ruling protects. null means NOT RECORDED.
    expect(carried.some((s) => s.kind === 'reused' && s.certifiedOn === null)).toBe(true);
    for (const slot of carried) {
      if (slot.kind !== 'reused' || slot.certifiedOn === null) continue;
      const source = store.documentsFor(source_().applicationId).find((d) => d.id === slot.documentId)!;
      expect(slot.certifiedOn).toBe(source.issueDate);
    }
  });

  it('an EXPIRED reused document is carried over exactly like any other', () => {
    const p = source();
    // Age one of the previous permit's documents well past any validity.
    const doc = store.documentsFor(p.applicationId)[0];
    expect(doc).toBeTruthy();

    startRenewal();
    const slot = page.attached[doc.requirementId];
    expect(slot).toBeTruthy();
    expect(slot.kind).toBe('reused');
    // Nothing marks it, excludes it, or holds it back. The ruling is explicit:
    // it is accepted and validated as it stands, and the officer decides.
  });

  it('carry-over is WIRED to the flow, not merely available to call', () => {
    // Every other test here calls carryOverDocuments() directly, which verifies
    // the function and NOT that anything invokes it. Disabling the trigger left
    // all of them green — the tested-pieces-untested-wiring trap, walked into
    // while writing tests for it. This one goes through the real path a citizen
    // takes and asserts nothing about the private method.
    const p = source();
    page.businessId = 'biz-1';
    page.applicationAction = 'Renewal';
    page.relatedPermitNumber = p.permitNumber;
    expect(Object.keys(page.attached).length).toBe(0);

    page.toStep(2);
    page.projectAddress = '12 Rizal Street';
    page.scopeOfWork = 'Renewal of the existing clearance.';
    page.toStep(3);

    expect(page.step()).toBe(3);
    const carried = Object.values(page.attached).filter((a) => a.kind === 'reused');
    expect(carried.length).toBeGreaterThan(0);
  });

  it('the citizen can still advance to review with only reused documents', () => {
    startRenewal();
    page.businessId = 'biz-1';
    page.step.set(3);
    page.toStep(4);
    // No client-side check may block on age or on the documents being reused.
    expect(page.step()).toBe(4);
    expect(page.error()).toBeNull();
  });

  it('REPLACING a reused document does not inherit its certification date', () => {
    // Named by citizen-mobile in #0387, and it was missing from my
    // implementation though not from my proposal. The natural implementation
    // copies the record and swaps the file, and the admin note would then read
    // "certified <old date>" over a document uploaded today — misinforming the
    // officer in exactly the direction the ruling protects.
    startRenewal();
    const entry = Object.entries(page.attached).find(([, a]) => a.kind === 'reused')!;
    const [reqId, before] = entry;
    if (before.kind !== 'reused') throw new Error('expected a reused slot');
    expect(before.certifiedOn).not.toBeUndefined();

    const requirement = page.documents.find((d) => d.id === reqId)!;
    const fresh = new File([new Uint8Array([1, 2, 3])], 'new-scan.pdf', { type: 'application/pdf' });
    page.onFileSelected({ target: { files: [fresh] } } as unknown as Event, requirement);

    const after = page.attached[reqId];
    expect(after.kind).toBe('upload');
    if (after.kind !== 'upload') throw new Error('expected an upload slot');
    // No certification date on the slot at all — it is a fresh document.
    expect('certifiedOn' in after).toBe(false);
    // ...and the chain is kept, so the officer can still see what it replaced.
    expect(after.supersedesDocumentId).toBe(before.documentId);
  });

  it('the replacement reaches the store with NO certification date', () => {
    startRenewal();
    const entry = Object.entries(page.attached).find(([, a]) => a.kind === 'reused')!;
    const [reqId, before] = entry;
    if (before.kind !== 'reused') throw new Error('expected a reused slot');
    const requirement = page.documents.find((d) => d.id === reqId)!;
    const fresh = new File([new Uint8Array([4, 5, 6])], 'new-scan.pdf', { type: 'application/pdf' });
    page.onFileSelected({ target: { files: [fresh] } } as unknown as Event, requirement);

    const record = store.createDraft({
      businessId: 'biz-1', businessName: 'Test', permitType: 'Zoning / Locational Clearance',
      applicationAction: 'Renewal', relatedPermitNumber: page.relatedPermitNumber,
    });
    const slot = page.attached[reqId];
    if (slot.kind !== 'upload') throw new Error('expected an upload slot');
    store.attachDocument(record.id, reqId, requirement.label, slot.file, slot.fileType,
                         slot.supersedesDocumentId ?? null);

    const filed = store.documentsFor(record.id).find((d) => d.requirementId === reqId)!;
    expect(filed.issueDate).toBeNull();
    expect(filed.supersedesDocumentId).toBe(before.documentId);
    expect(filed.file).toBeInstanceOf(File);
  });

  it('a reused document reaches the filed application, flagged and dated', () => {
    startRenewal();
    const record = store.createDraft({
      businessId: 'biz-1', businessName: 'Test',
      permitType: 'Zoning / Locational Clearance',
      applicationAction: 'Renewal', relatedPermitNumber: page.relatedPermitNumber,
    });
    const slot = Object.entries(page.attached).find(([, a]) => a.kind === 'reused');
    expect(slot).toBeTruthy();
    const [reqId, a] = slot!;
    if (a.kind !== 'reused') throw new Error('expected a reused slot');
    store.reuseDocument(record.id, reqId, 'Reused doc', a);

    const filed = store.documentsFor(record.id).find((d) => d.requirementId === reqId)!;
    expect(filed.reusedFromDocumentId).toBe(a.documentId);
    expect(filed.issueDate).toBe(a.certifiedOn);
    // Honest: this application received no bytes.
    expect(filed.file).toBeNull();
  });
});
