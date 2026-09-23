import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../session/auth.service';
import { NotificationStore } from './notification.store';
import { ApplicationRecord, StatusTimelineEntry, actionReferenceIsComplete } from '../domain/application.model';
import { ApplicationAction, GeneratedPermit, PermitType, PublishedPermitType } from '../domain/permit.model';
import {
  ApplicationLifecycleStatus,
  LIFECYCLE_SEQUENCE,
  NEXT_STEP_TEXT,
  applicantStatusOf,
} from '../domain/status.model';
import { ApplicationDocument, DocumentStatus, SavedDocumentFileType } from '../domain/document.model';
import { Assessment, AssessmentLineItem, ILLUSTRATIVE_FEE_BASIS } from '../domain/assessment.model';
import { PaymentMethod, PaymentTransaction } from '../domain/payment.model';
import { GENERIC_APPLICATION_DOCUMENTS, RequirementDocument, documentsFor, requirementsFor } from '../domain/requirements-catalog';
import { nextId, todayIso } from '../utils/ids';
import { MUNICIPAL_ENGINEER } from '../domain/lgu-contact';
import { CitizenApiClient, newIdempotencyKey } from '../api/citizen-api.client';
import { ApplicationSummary, PermitRelease, PermitResponse, SubmitApplicationRequest, SubmitPaymentRequest } from '../api/citizen-api.models';
import { ApiError } from '../api/problem';

export interface CreateApplicationInput {
  businessId: string;
  businessName: string;
  permitType: PublishedPermitType;
  applicationAction: ApplicationAction;
  /** The permit being renewed or amended. Null for a 'New' application; required otherwise unless `priorPermitClaim` is set instead. */
  relatedPermitNumber: string | null;
  /** The unverified alternative to `relatedPermitNumber`, for a permit that predates eBPCO. See `actionReferenceIsComplete`. */
  priorPermitClaim: string | null;
}

let appSeq = 3000;

/**
 * `ApplicationSummary` (the server's real wire shape, `GET /applications`)
 * → `ApplicationRecord` (this portal's local domain type), so the many
 * existing call sites that read `myApplications()` keep working unchanged.
 *
 * NOT a faithful superset — it can't be. Five fields on `ApplicationRecord`
 * have no server equivalent for an applicant, and that is by design on the
 * server's side, not a gap this mapping papers over:
 *
 * - `evaluationStage`/`evaluationResult` are staff-internal working state.
 *   `applicant-view.ts`'s own doc comment calls this out explicitly:
 *   "Officer-scope. Never reaches an applicant payload." Defaulted to
 *   'Initial'/'Pending' below ONLY because the TypeScript field is
 *   non-optional — nothing in this portal reads these two fields off a
 *   REAL (as opposed to demo-seeded) application today, and anything that
 *   starts doing so must go back to the real signal that does exist,
 *   `applicantStatus` (already on `ApplicationSummary`, already computed
 *   server-side), not trust these placeholders.
 * - `permitReleaseStatus`/`permitNumber`/`issuedDate`/`expiryDate` DO have
 *   real server answers, just not on this endpoint — they live on
 *   `GET /applications/{id}/permit`, a separate call by design (`the detail
 *   is read on every list refresh, and the permit is read once, at the
 *   end`). Null/'Not Ready' here, not fetched eagerly for every row in a
 *   list.
 *
 * `assessedAmountCentavos` and `paymentStatus`, by contrast, ARE faithful:
 * the server's `payment.status` vocabulary is a subset of this portal's
 * `PaymentStatus` type, and `orderOfPayment.totalCentavos` is the real
 * assessed amount, not a placeholder.
 */
function fromServerSummary(row: ApplicationSummary, applicantId: string): ApplicationRecord {
  return {
    id: row.id,
    applicationNumber: row.referenceNumber,
    businessId: row.businessId ?? '',
    businessName: row.businessName ?? '',
    applicantId,
    permitType: row.permitType as PublishedPermitType,
    applicationAction: row.applicationAction as ApplicationAction,
    relatedPermitNumber: null,
    priorPermitClaim: null,
    dateSubmitted: row.dateSubmitted,
    lifecycleStatus: row.lifecycleStatus as ApplicationLifecycleStatus,
    applicantStatus: row.applicantStatus,
    requiresApplicantAction: row.requiresApplicantAction,
    // See doc comment above — no server field exists for these two.
    evaluationStage: 'Initial',
    evaluationResult: 'Pending',
    paymentStatus: row.payment.status,
    permitReleaseStatus: 'Not Ready',
    assessedAmountCentavos: row.payment.orderOfPayment?.totalCentavos ?? null,
    permitNumber: null,
    issuedDate: null,
    expiryDate: null,
  };
}

function describeApplicationError(error: unknown): string {
  if (error instanceof ApiError) return error.citizenMessage;
  return 'We could not reach the Municipality’s system. Check your connection and try again.';
}

function prefixFor(permitType: PublishedPermitType): string {
  if (permitType === 'Business Permit') return 'E-BPCO';
  if (permitType.startsWith('Building Permit')) return 'BP';
  if (permitType === 'Zoning / Locational Clearance') return 'ZLC';
  if (permitType === 'FSEC for Building Permit (BFP)') return 'FSEC';
  if (permitType === 'FSIC for Occupancy Permit (BFP)') return 'FSIC';
  if (permitType === 'Certificate of Occupancy') return 'COO';
  if (permitType === 'Demolition Permit') return 'DEM';
  return permitType.slice(0, 3).toUpperCase();
}

@Injectable({ providedIn: 'root' })
export class ApplicationStore {
  private readonly applications = signal<ApplicationRecord[]>([]);
  private readonly documentsByApp = signal<Record<string, ApplicationDocument[]>>({});
  private readonly assessmentsByApp = signal<Record<string, Assessment>>({});
  private readonly paymentsByApp = signal<Record<string, PaymentTransaction[]>>({});
  private readonly timelineByApp = signal<Record<string, StatusTimelineEntry[]>>({});
  private readonly permitsByApp = signal<Record<string, GeneratedPermit>>({});

  private readonly api = inject(CitizenApiClient);

  /**
   * The citizen's REAL applications, fetched from `GET /applications`.
   *
   * `null` means "not fetched yet" (or the API isn't configured, e.g. in a
   * unit test) — distinct from `[]`, which means "fetched, genuinely none
   * yet". `myApplications` below prefers this the moment it is non-null,
   * over the local demo seed in `applications`.
   */
  private readonly realApplications = signal<ApplicationRecord[] | null>(null);

  /**
   * Raw `GET /applications/{id}/permit` responses, keyed by application id.
   * Fetched on demand via `fetchPermit()` (both `application-details.page.ts`
   * and `permit-document.page.ts` call it, since they're separate
   * routes/components that don't share signals). A 404 — no permit issued
   * yet — is a normal error on this endpoint (see `citizen-api.client.spec.ts`),
   * so it's swallowed the same way `listDocuments`/`getTimeline` errors are
   * swallowed elsewhere: the id simply never gets a key here, and every
   * reader below falls through to the existing local-demo behavior.
   */
  private readonly realPermitResponses = signal<Record<string, PermitResponse>>({});

  constructor(
    private readonly auth: AuthService,
    private readonly notifications: NotificationStore,
  ) {
    // Only when no real API is configured -- this is what actually
    // distinguishes local/demo-only running from a real deployment (staging
    // or production both set EBPCO_API_BASE_URL). Seeding unconditionally
    // meant `applicationById('app-seed-1')` returned "Dela Cruz Hardware &
    // Construction Supply"'s fake, non-existent application to ANY signed-in
    // citizen on the real deployed site who happened to open that URL --
    // reachable by guessing, since the id is a hardcoded, publicly-visible
    // constant in this file, not by discovery through any real navigation
    // path (myApplications() already preferred realApplications correctly).
    // The other seeded maps (documents/timeline/permit/assessment/payment)
    // are keyed by these same two ids and are unreachable dead weight
    // without this data existing at all, so gating this one call is enough.
    if (!this.api.configured) this.seed();

    // Refetches whenever sign-in state changes — covers both a fresh login
    // and a session restored on reload (Stage 3's AuthService.restore()).
    // Guarded by `api.configured` so this never fires a real request in a
    // unit test, where API_BASE_URL is never set unless a spec opts in.
    effect(() => {
      if (this.auth.isAuthenticated() && this.api.configured) {
        void this.refreshMine();
      } else {
        this.realApplications.set(null);
      }
    });
  }

  /**
   * Fetches the citizen's real applications and replaces `realApplications`.
   *
   * A failure leaves whatever was there before rather than blanking the
   * list — a transient network error should not make a citizen's own
   * applications appear to vanish while they are looking at them.
   */
  async refreshMine(): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.listApplications());
      const applicantId = this.auth.currentUser()?.id ?? '';
      this.realApplications.set(response.data.map((row) => fromServerSummary(row, applicantId)));
    } catch {
      // See doc comment above.
    }
  }

  private seed(): void {
    const app1: ApplicationRecord = {
      id: 'app-seed-1',
      applicationNumber: 'BP-2026-00147',
      businessId: 'biz-1',
      businessName: 'Dela Cruz Hardware & Construction Supply',
      applicantId: 'user-demo',
      permitType: 'Building Permit',
      applicationAction: 'New',
      relatedPermitNumber: null,
      priorPermitClaim: null,
      dateSubmitted: '2026-08-10T08:00:00.000Z',
      lifecycleStatus: 'Under Evaluation',
      evaluationStage: 'OBO',
      evaluationResult: 'Pending',
      paymentStatus: 'Not Yet Available',
      permitReleaseStatus: 'Not Ready',
      assessedAmountCentavos: null,
      permitNumber: null,
      issuedDate: null,
      expiryDate: null,
    };
    const app2: ApplicationRecord = {
      id: 'app-seed-2',
      applicationNumber: 'ZLC-2026-00089',
      businessId: 'biz-2',
      businessName: "Juan's Eatery",
      applicantId: 'user-demo',
      permitType: 'Zoning / Locational Clearance',
      applicationAction: 'New',
      relatedPermitNumber: null,
      priorPermitClaim: null,
      dateSubmitted: '2026-07-15T08:00:00.000Z',
      lifecycleStatus: 'Ready for Release',
      evaluationStage: 'Final Approval',
      evaluationResult: 'Passed',
      paymentStatus: 'Paid',
      permitReleaseStatus: 'Ready for Release',
      assessedAmountCentavos: 85000,
      permitNumber: 'ZLC-2026-0231',
      issuedDate: '2026-08-05T00:00:00.000Z',
      expiryDate: '2027-08-05T00:00:00.000Z',
    };
    this.applications.set([app1, app2]);

    // Documents for the seeded applications.
    //
    // Both used to have NONE. app2 carried an issued permit number and
    // "Ready for Release" over an empty document list — the office had approved
    // an application with nothing on file, which cannot happen, and it is the
    // screen people look at most. A citizen reading their own approved
    // application saw an empty Documents card, which reads as "the office lost
    // them" rather than "this is a demo".
    //
    // Derived from the requirements catalogue rather than listed here, so the
    // seed cannot drift from what the permit type actually requires — the
    // failure that would put this defect straight back.
    this.documentsByApp.set({
      // Under evaluation: most accepted, one sent back with a real reason, so
      // the rejection path is visible in the demo rather than only in tests.
      [app1.id]: this.seedDocumentsFor(app1, (i, total) =>
        i === total - 1 ? 'Revision Required' : i === total - 2 ? 'Under Review' : 'Accepted'),
      // Approved with a permit issued: every required document accepted. Any
      // other state here would contradict the permit sitting beside it.
      [app2.id]: this.seedDocumentsFor(app2, () => 'Accepted'),
    });
    this.timelineByApp.set({
      [app1.id]: [
        { status: 'Submitted', timestamp: '2026-08-10T08:00:00.000Z', remarks: null },
        { status: 'Received', timestamp: '2026-08-11T09:00:00.000Z', remarks: null },
        { status: 'Document Verification', timestamp: '2026-08-12T10:00:00.000Z', remarks: null },
        { status: 'Under Evaluation', timestamp: '2026-08-14T13:00:00.000Z', remarks: null },
      ],
      [app2.id]: [
        { status: 'Submitted', timestamp: '2026-07-15T08:00:00.000Z', remarks: null },
        { status: 'Received', timestamp: '2026-07-16T08:00:00.000Z', remarks: null },
        { status: 'Document Verification', timestamp: '2026-07-18T08:00:00.000Z', remarks: null },
        { status: 'Under Evaluation', timestamp: '2026-07-22T08:00:00.000Z', remarks: null },
        { status: 'Assessed', timestamp: '2026-07-24T08:00:00.000Z', remarks: null },
        { status: 'Payment Verified', timestamp: '2026-07-28T08:00:00.000Z', remarks: null },
        { status: 'Approved', timestamp: '2026-08-01T08:00:00.000Z', remarks: null },
        { status: 'Permit Generated', timestamp: '2026-08-04T08:00:00.000Z', remarks: null },
        { status: 'Ready for Release', timestamp: '2026-08-05T08:00:00.000Z', remarks: null },
      ],
    });
    // app2's record already carries permitNumber/issuedDate/expiryDate and a
    // Paid paymentStatus, but the Application Details page reads the permit
    // and assessment CARDS from these separate maps, not those denormalized
    // fields — without seeding them here those cards silently never render
    // for this demo application, even though its own fields say it's done.
    this.permitsByApp.set({
      [app2.id]: {
        applicationId: app2.id,
        permitNumber: app2.permitNumber!,
        // Seeded demo data — never an office issuance. See PermitProvenance.
        provenance: 'demo',
        // No office has pronounced on this. See PermitStanding.
        standing: null,
          conditions: [],   // ditto
        issuedDateValue: new Date(app2.issuedDate!),
        issuedDate: app2.issuedDate!,
        expiryDateValue: new Date(app2.expiryDate!),
        expiryDate: app2.expiryDate!,
        approvingOfficial: 'Zoning Administrator',
        approvingOffice: 'Municipal Planning and Development Office (MPDO / Zoning)',
      },
    });
    this.assessmentsByApp.set({
      [app2.id]: {
        id: 'assess-seed-2',
        applicationId: app2.id,
        status: 'Paid',
        lineItems: [
          { code: 'ZON-001', name: 'Locational / Zoning Fee', family: 'Locational/Zoning Fee', authority: 'LGU', amountCentavos: 85000, legalBasisTitle: ILLUSTRATIVE_FEE_BASIS },
        ],
        totalCentavos: 85000,
        amountPaidCentavos: 85000,
        balanceCentavos: 0,
        opsNumber: 'OPS-2026-00231',
        dueDate: '2026-08-01T00:00:00.000Z',
        issuedAt: '2026-07-24T08:00:00.000Z',
      },
    });
    // app2's assessment and timeline already say "Paid" / "Payment Verified",
    // but the applicant-facing receipt (payment-receipt.page.ts) reads the
    // actual PaymentTransaction record, not those denormalized fields —
    // without seeding one here, "View Receipt" on this demo application had
    // nothing to show, same gap the comment above already fixed once for
    // the permit/assessment cards.
    this.paymentsByApp.set({
      [app2.id]: [
        {
          id: 'pay-seed-2',
          assessmentId: 'assess-seed-2',
          applicationId: app2.id,
          amountCentavos: 85000,
          method: 'Onsite',
          agency: 'OBO/LGU',
          transactionReference: 'ONSITE-20260727-0231',
          proofFileName: null,
          status: 'Verified',
          submittedAt: '2026-07-27T09:00:00.000Z',
          verifiedAt: '2026-07-28T08:00:00.000Z',
          rejectionReason: null,
          orNumber: 'OR-2026-00231',
          orDate: '2026-07-28T00:00:00.000Z',
        },
      ],
    });
  }

  /**
   * The citizen's own applications — real once fetched, the local demo seed
   * until then or if no backend is configured. See `realApplications`'s doc
   * comment for why `null` (not fetched) and `[]` (fetched, none) are kept
   * distinct rather than treated the same.
   */
  readonly myApplications = computed(() => {
    const real = this.realApplications();
    if (real !== null) return real;
    const uid = this.auth.currentUser()?.id;
    if (!uid) return [];
    return [...this.applications()]
      .filter((a) => a.applicantId === uid)
      .sort((a, b) => ((a.dateSubmitted ?? '') < (b.dateSubmitted ?? '') ? 1 : -1));
  });

  /**
   * Checks `realApplications` (once fetched) FIRST, then the local demo
   * signal — never through `myApplications()`, which is filtered to the
   * SIGNED-IN citizen's own applications. This method is not: `verify-permit
   * .page.ts` calls it for an anonymous visitor scanning a QR code on
   * someone else's permit, and filtering by the current signer's id here
   * would break public verification entirely. The ownership check already
   * happened server-side, when this citizen's OWN applications were fetched
   * into `realApplications` — this just looks a real id up in what has
   * already been loaded, the same trust boundary the old code had (a bare
   * search of the local signal, no ownership filter).
   */
  applicationById(id: string): ApplicationRecord | undefined {
    const real = this.realApplications();
    const foundReal = real?.find((a) => a.id === id);
    if (foundReal) return foundReal;
    return this.applications().find((a) => a.id === id);
  }

  /**
   * True when this id came from the real backend (`realApplications`), not
   * the local in-memory demo list. `application-details.page.ts` uses this
   * to hide `advanceForDemo`'s "Simulate Office Update" affordance for a
   * real application — that button's own label ("No backend exists yet")
   * would be a lie for one, and `advanceForDemo` writes into the local demo
   * signals (`applications`, `timelineByApp`, ...) keyed by this same id,
   * which would otherwise inject fake timeline/permit data alongside the
   * real fetched data for a genuinely filed application.
   */
  isReal(id: string): boolean {
    return this.realApplications()?.some((a) => a.id === id) ?? false;
  }

  documentsFor(applicationId: string): ApplicationDocument[] {
    return this.documentsByApp()[applicationId] ?? [];
  }

  assessmentFor(applicationId: string): Assessment | undefined {
    return this.assessmentsByApp()[applicationId];
  }

  paymentsFor(applicationId: string): PaymentTransaction[] {
    return this.paymentsByApp()[applicationId] ?? [];
  }

  timelineFor(applicationId: string): StatusTimelineEntry[] {
    return this.timelineByApp()[applicationId] ?? [];
  }

  permitFor(applicationId: string): GeneratedPermit | undefined {
    const real = this.realPermitResponses()[applicationId];
    if (real) {
      return {
        applicationId,
        permitNumber: real.permitNumber,
        // A successful response from this endpoint IS the issuance signal —
        // the server does not return a row for a permit nobody issued.
        provenance: 'issued',
        conditions: real.conditions,
        // Neither the endpoint nor the `generated_permits` table carries
        // these — see `GeneratedPermit.standing`'s own doc comment ("NOTHING
        // sets this today; it is the seam the backend fills") and
        // `approvingOfficial`/`approvingOffice`'s. Honestly null, not guessed.
        standing: null,
        issuedDateValue: new Date(real.issuedDate),
        issuedDate: real.issuedDate,
        expiryDateValue: null,
        expiryDate: null,
        approvingOfficial: null,
        approvingOffice: null,
      };
    }
    return this.permitsByApp()[applicationId];
  }

  /**
   * Fetches the real permit for one application and caches the raw response.
   * Safe to call for an id that turns out to have no real permit (yet, or
   * ever, e.g. a local demo id) — the 404 is swallowed and `permitFor`/
   * `releaseFor` simply keep using their existing local-demo fallback.
   */
  fetchPermit(applicationId: string): void {
    if (!this.api.configured) return;
    this.api.getPermit(applicationId).subscribe({
      next: (p) => this.realPermitResponses.update((map) => ({ ...map, [applicationId]: p })),
      error: () => {},
    });
  }

  /**
   * The real `release` sub-object once fetched — preserved without
   * translation, meaningful `null` included (see `PermitResponse.release`'s
   * own doc comment: "null is a fact to render... not a missing value").
   * Falls back to the existing demo construction from
   * `ApplicationRecord.permitReleaseStatus` otherwise.
   */
  releaseFor(applicationId: string): PermitRelease | null {
    const real = this.realPermitResponses()[applicationId];
    if (real) return real.release;
    const app = this.applicationById(applicationId);
    if (!app || !this.permitFor(applicationId)) return null;
    return { status: app.permitReleaseStatus, method: null, releasedAt: null };
  }

  /**
   * The signed-in citizen's own issued permits, newest first — what a Renewal
   * or Amendment may act on.
   *
   * Sourced from applications that actually reached an issued permit, so the
   * list cannot offer something that does not exist. It is deliberately NOT
   * filtered by expiry: a lapsed permit is often exactly what a citizen has
   * come to renew, and this build has no authority on standing anyway (the
   * Municipality holds no expiry_date — see the backend handoff). The choice
   * of what is still renewable belongs to the office, not to this form; the
   * form's job is to let the citizen say which permit they mean.
   */
  readonly renewablePermits = computed(() => {
    const uid = this.auth.currentUser()?.id;
    if (!uid) return [];
    const permits = this.permitsByApp();
    return this.applications()
      .filter((a) => a.applicantId === uid && a.permitNumber !== null)
      .map((a) => ({
        applicationId: a.id,
        permitNumber: a.permitNumber!,
        permitType: a.permitType,
        businessName: a.businessName,
        issuedDate: a.issuedDate,
        expiryDate: a.expiryDate,
        provenance: permits[a.id]?.provenance ?? null,
      }))
      .sort((x, y) => (y.issuedDate ?? '').localeCompare(x.issuedDate ?? ''));
  });

  /** Looks up a permit by its own real, system-generated permit number — the permit number itself doubles as the public verification token (see VerifyPermitPage). */
  permitByNumber(permitNumber: string): GeneratedPermit | undefined {
    return Object.values(this.permitsByApp()).find((p) => p.permitNumber === permitNumber);
  }

  /** True once every REQUIRED document for this application's permit type is on file in a resolved state (never Missing/Rejected/Revision Required/Expired) — the same real "documents resolved" check the generated permit document's draft-watermark gate reads. */
  /**
   * Example documents for a seeded application, taken from the catalogue.
   *
   * `file: null` is deliberate and already handled everywhere that matters:
   * these rows never had bytes behind them, and the preview says so rather
   * than showing an empty frame. See ApplicationDocument.file — a filename is
   * not a document, and a seed that pretended otherwise would be the very
   * defect the rest of this store is built to prevent.
   */
  private seedDocumentsFor(
    app: ApplicationRecord,
    statusAt: (index: number, total: number) => DocumentStatus,
  ): ApplicationDocument[] {
    if (app.permitType === 'Business Permit') return [];
    const required = documentsFor(app.permitType, app.applicationAction).filter((d) => d.required);
    return required.map((doc, i) => {
      const status = statusAt(i, required.length);
      return {
        id: `seed-doc-${app.id}-${doc.id}`,
        applicationId: app.id,
        requirementId: doc.id,
        label: doc.label,
        fileName: `${doc.id}.pdf`,
        fileType: 'pdf' as const,
        file: null,
        uploadedAt: app.dateSubmitted ?? '2026-07-15T08:00:00.000Z',
        status,
        issuingOffice: null,
        // The date the issuing office certified it. Distinct from uploadedAt —
        // "uploaded 9 months ago" is not the statement "certified on <date>",
        // and the officer judges a reused document by the second. Seeded on the
        // first two so the reuse note has something real to show; null on the
        // rest, which is honest: null means NOT RECORDED.
        issueDate: i < 2 ? '2025-06-12T00:00:00.000Z' : null,
        // One clearance carries a real expiry so the validity line (F-24) is
        // visible in the demo at all. The office sends this; until now nothing
        // in the seed ever exercised it.
        expiryDate: i === 0 ? '2026-11-30T00:00:00.000Z' : null,
        remarks:
          status === 'Revision Required'
            ? 'The setback dimension on sheet 2 cannot be read. Please re-scan at a higher resolution.'
            : null,
        history: [],
      };
    });
  }

  documentsResolvedFor(applicationId: string): boolean {
    const app = this.applicationById(applicationId);
    if (!app || app.permitType === 'Business Permit') return true;
    const required = documentsFor(app.permitType, app.applicationAction).filter((d) => d.required);
    const docs = this.documentsFor(applicationId);
    const unresolved: DocumentStatus[] = ['Missing', 'Rejected', 'Revision Required', 'Expired'];
    return required.every((req) => {
      const doc = docs.find((d) => d.requirementId === req.id);
      return !!doc && !unresolved.includes(doc.status);
    });
  }

  nextStepText(status: ApplicationLifecycleStatus): string {
    return NEXT_STEP_TEXT[status];
  }

  /**
   * Real per-permit-type checklists, from `GET /requirements/{permitType}`
   * (the same catalogue the Admin Portal's own "Permit Release > Permit
   * Types" editor publishes to) — keyed by permit type, `'generic'` mapped
   * to `'Business Permit'` the way `requiredDocumentsFor` already did for
   * the static catalog. A key absent from this map means "never asked for
   * yet"; present-but-`null` means "asked, and the LGU has published
   * nothing for it" (falls back to the static catalog, same as before).
   */
  private readonly realRequiredDocuments = signal<Record<string, RequirementDocument[] | null>>({});

  private permitTypeFor(permitType: PermitType | 'generic'): PublishedPermitType {
    return permitType === 'generic' ? 'Business Permit' : permitType;
  }

  /**
   * `applicationAction` folded into the cache key since migration 047:
   * Building Permit's checklist now varies by it, so the 'New' and
   * 'Renewal' answers for the same permit type must not overwrite each
   * other in `realRequiredDocuments`.
   */
  private requirementsKeyFor(permitType: PermitType | 'generic', applicationAction?: ApplicationAction): string {
    const type = this.permitTypeFor(permitType);
    return applicationAction === undefined ? type : `${type}::${applicationAction}`;
  }

  /**
   * Kicks off the real fetch for `permitType` (and, since migration 047,
   * `applicationAction` — Building Permit's checklist now varies by it) if
   * it hasn't been asked for yet. Side-effecting (writes
   * `realRequiredDocuments`) — call this from a constructor or `effect()`,
   * never from inside a `computed()`; `requiredDocumentsFor` below stays a
   * pure read for exactly that reason.
   */
  ensureRequiredDocumentsLoaded(permitType: PermitType | 'generic', applicationAction?: ApplicationAction): void {
    const key = this.requirementsKeyFor(permitType, applicationAction);
    if (key in this.realRequiredDocuments()) return;
    this.api.getRequirementsForPermitType(this.permitTypeFor(permitType), applicationAction).subscribe({
      next: (result) => {
        const docs: RequirementDocument[] = result.documents.map((d) => ({
          id: d.code,
          label: d.label,
          required: d.required,
          description: d.description || undefined,
        }));
        this.realRequiredDocuments.update((m) => ({ ...m, [key]: docs.length > 0 ? docs : null }));
      },
      // A local demo permit type, or a deployment that can't answer this
      // route yet, 404s harmlessly — left `null` so the static catalog
      // below keeps standing in, same as everywhere else in this portal.
      error: () => this.realRequiredDocuments.update((m) => ({ ...m, [key]: null })),
    });
  }

  /**
   * True once the real, live checklist for `permitType`/`applicationAction`
   * has actually loaded (not merely requested) — check this before sending
   * a document's `id` as `requirementCode`. A static-catalog id sent as one
   * is a real, honest server refusal: the two id schemes only coincide
   * because nothing has re-published this permit type's checklist since
   * it was first seeded — see `requirements.controller.ts`.
   */
  hasRealRequiredDocuments(permitType: PermitType | 'generic', applicationAction?: ApplicationAction): boolean {
    return !!this.realRequiredDocuments()[this.requirementsKeyFor(permitType, applicationAction)];
  }

  /**
   * The live checklist once `ensureRequiredDocumentsLoaded` has resolved
   * it, else the static catalog — never triggers the fetch itself (see
   * that method's own doc comment on why this one must stay pure).
   */
  requiredDocumentsFor(permitType: PermitType | 'generic', applicationAction?: ApplicationAction): RequirementDocument[] {
    const real = this.realRequiredDocuments()[this.requirementsKeyFor(permitType, applicationAction)];
    if (real) return real;
    return permitType === 'generic' ? GENERIC_APPLICATION_DOCUMENTS : documentsFor(permitType, applicationAction ?? 'New');
  }

  /** Creates a Draft application — the applicant fills documents in before submitting. */
  createDraft(input: CreateApplicationInput): ApplicationRecord {
    const uid = this.auth.currentUser()!.id;
    // The form blocks this too, but a rule enforced only in the template is
    // enforced only for callers who go through the template.
    if (!actionReferenceIsComplete(input.applicationAction, input.relatedPermitNumber, input.priorPermitClaim)) {
      throw new Error(
        `A ${input.applicationAction} application must name the permit it acts on.`,
      );
    }
    appSeq += 1;
    const record: ApplicationRecord = {
      id: nextId('app'),
      applicationNumber: `${prefixFor(input.permitType)}-${new Date().getFullYear()}-${String(appSeq).padStart(5, '0')}`,
      businessId: input.businessId,
      businessName: input.businessName,
      applicantId: uid,
      permitType: input.permitType,
      applicationAction: input.applicationAction,
      relatedPermitNumber: input.relatedPermitNumber,
      priorPermitClaim: input.priorPermitClaim,
      dateSubmitted: null,
      lifecycleStatus: 'Draft',
      evaluationStage: 'Initial',
      evaluationResult: 'Pending',
      paymentStatus: 'Not Yet Available',
      permitReleaseStatus: 'Not Ready',
      assessedAmountCentavos: null,
      permitNumber: null,
      issuedDate: null,
      expiryDate: null,
    };
    this.applications.update((list) => [record, ...list]);
    return record;
  }

  /**
   * `POST /applications` for real — files a genuine application with the
   * backend. Returns the real, server-assigned id on success so the caller
   * can navigate straight to it (found via `applicationById`, which checks
   * `realApplications` first).
   *
   * `documentIds` must be REAL, already-uploaded document ids (from
   * `CitizenApiClient.uploadDocument`) — not local library or wizard-only
   * ids. `application-wizard.page.ts` is the only caller today and tracks
   * exactly this: a document only earns an entry once its own real
   * `POST /documents` has completed, never merely because the citizen
   * attached it in the UI. A reused document (from a previous permit, or
   * from the library before real upload existed) has no real id to give and
   * is correctly left out — the caller is responsible for telling the
   * citizen that honestly, not this method.
   */
  async fileReal(
    request: SubmitApplicationRequest,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    try {
      const summary = await firstValueFrom(
        this.api.fileApplication(request, newIdempotencyKey()),
      );
      await this.refreshMine();
      return { ok: true, id: summary.id };
    } catch (error) {
      return { ok: false, error: describeApplicationError(error) };
    }
  }

  /**
   * `POST /applications/{id}/cancel` for real. Only accepted before an
   * Order of Payment exists (E-4) — refused server-side, not guessed here;
   * the refusal message is the server's own explanation.
   */
  async cancelReal(
    applicationId: string,
    reason?: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await firstValueFrom(
        this.api.cancelApplication(applicationId, reason ? { reason } : {}, newIdempotencyKey()),
      );
      await this.refreshMine();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describeApplicationError(error) };
    }
  }

  /**
   * `POST /applications/{id}/payments` for real. `amountCentavos` must be
   * the real Order of Payment's `totalCentavos` — this method does not
   * default or compute it, since inventing a number to pay is the one
   * mistake this screen cannot afford to make silently.
   */
  async submitPaymentReal(
    applicationId: string,
    body: SubmitPaymentRequest,
  ): Promise<{ ok: true; settles: boolean } | { ok: false; error: string }> {
    try {
      const result = await firstValueFrom(
        this.api.submitPayment(applicationId, body, newIdempotencyKey()),
      );
      await this.refreshMine();
      return { ok: true, settles: result.settles };
    } catch (error) {
      return { ok: false, error: describeApplicationError(error) };
    }
  }

  /**
   * `file` is the actual File the citizen chose, and it is REQUIRED.
   *
   * It used to take only `fileName` and `fileType`, which meant the bytes were
   * already gone by the time anything reached this store — the same shape that
   * let the mobile app file applications with zero documents for its entire
   * life. Nothing downstream can upload a filename.
   */
  /**
   * Record a document CARRIED OVER from a permit the citizen already holds.
   *
   * Not an upload. The Municipality already has these bytes; what this records
   * is a reference plus the two facts the office needs — that it was reused,
   * and the date it was certified. See
   * docs/RULING-2026-09-03-renewal-reuse.md: the officer decides whether a
   * reused document is still good, and the certification date is what they
   * decide with. An expiry date cannot answer that question.
   *
   * `file` stays null and that is honest: this application did not receive a
   * file. Pretending otherwise would be the "a filename is not a document"
   * defect inverted — claiming to carry bytes we never took.
   */
  reuseDocument(
    applicationId: string,
    requirementId: string,
    label: string,
    source: { documentId: string; fileName: string; fileType: SavedDocumentFileType; certifiedOn: string | null },
  ): void {
    this.documentsByApp.update((map) => {
      const existing = map[applicationId] ?? [];
      const entry: ApplicationDocument = {
        id: nextId('appdoc'),
        applicationId,
        requirementId,
        label,
        fileName: source.fileName,
        fileType: source.fileType,
        file: null,
        uploadedAt: todayIso(),
        status: 'Submitted',
        issuingOffice: null,
        issueDate: source.certifiedOn,
        expiryDate: null,
        remarks: null,
        history: [],
        reusedFromDocumentId: source.documentId,
      };
      const idx = existing.findIndex((d) => d.requirementId === requirementId);
      const next = idx >= 0 ? existing.map((d, i) => (i === idx ? entry : d)) : [...existing, entry];
      return { ...map, [applicationId]: next };
    });
  }

  attachDocument(
    applicationId: string,
    requirementId: string,
    label: string,
    file: File,
    fileType: SavedDocumentFileType,
    /**
     * The reused document this upload REPLACED, if any.
     *
     * A replacement is a fresh document: it does NOT inherit the certification
     * date of the thing it replaced, or the admin note would read "certified
     * <old date>" over a file uploaded today. It keeps only the pointer, so the
     * officer can see the chain without being misinformed about the date.
     */
    supersedesDocumentId: string | null = null,
  ): void {
    const fileName = file.name;
    this.documentsByApp.update((map) => {
      const existing = map[applicationId] ?? [];
      const idx = existing.findIndex((d) => d.requirementId === requirementId);
      const entry: ApplicationDocument = {
        id: idx >= 0 ? existing[idx].id : nextId('appdoc'),
        applicationId,
        requirementId,
        label,
        file,
        fileName,
        fileType,
        uploadedAt: todayIso(),
        status: 'Uploaded',
        issuingOffice: null,
        // NOT inherited from anything this replaced: a fresh upload has no
        // certification date, and claiming one would misinform the officer.
        issueDate: null,
        expiryDate: null,
        supersedesDocumentId,
        remarks: null,
        history: idx >= 0 ? [...existing[idx].history, this.historyEntryFrom(existing[idx])] : [],
      };
      const updated = idx >= 0 ? [...existing.slice(0, idx), entry, ...existing.slice(idx + 1)] : [...existing, entry];
      return { ...map, [applicationId]: updated };
    });
  }

  private historyEntryFrom(doc: ApplicationDocument) {
    return { fileName: doc.fileName, uploadedAt: doc.uploadedAt, status: doc.status, remarks: doc.remarks };
  }

  removeDocument(applicationId: string, requirementId: string): void {
    this.documentsByApp.update((map) => ({
      ...map,
      [applicationId]: (map[applicationId] ?? []).filter((d) => d.requirementId !== requirementId),
    }));
  }

  submit(applicationId: string): void {
    const app = this.applicationById(applicationId);
    if (!app) return;
    this.updateApplication(applicationId, { lifecycleStatus: 'Submitted', dateSubmitted: todayIso() });
    this.pushTimeline(applicationId, 'Submitted', null);
    this.notifications.push(
      'Application submitted',
      `Your application ${app.applicationNumber} has been submitted and is queued for review.`,
      'application',
      applicationId,
    );
  }

  private updateApplication(id: string, patch: Partial<ApplicationRecord>): void {
    this.applications.update((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  private pushTimeline(applicationId: string, status: ApplicationLifecycleStatus, remarks: string | null): void {
    this.timelineByApp.update((map) => ({
      ...map,
      [applicationId]: [...(map[applicationId] ?? []), { status, timestamp: todayIso(), remarks }],
    }));
  }

  private issueAssessment(applicationId: string): void {
    const app = this.applicationById(applicationId);
    if (!app) return;
    const lineItems: AssessmentLineItem[] =
      app.applicationAction === 'New'
        ? [{ code: 'FIL-001', name: 'Filing / Processing Fee', family: 'Filing/Processing', authority: 'LGU', amountCentavos: 525000, legalBasisTitle: ILLUSTRATIVE_FEE_BASIS }]
        : [{ code: 'FIL-002', name: `${app.applicationAction} Fee`, family: 'Filing/Processing', authority: 'LGU', amountCentavos: app.applicationAction === 'Renewal' ? 320000 : 150000, legalBasisTitle: ILLUSTRATIVE_FEE_BASIS }];
    const total = lineItems.reduce((sum, l) => sum + (l.amountCentavos ?? 0), 0);
    const assessment: Assessment = {
      id: nextId('assess'),
      applicationId,
      status: 'Issued',
      lineItems,
      totalCentavos: total,
      amountPaidCentavos: 0,
      balanceCentavos: total,
      opsNumber: `OPS-${new Date().getFullYear()}-${nextId('').replace('-', '')}`,
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
      issuedAt: todayIso(),
    };
    this.assessmentsByApp.update((map) => ({ ...map, [applicationId]: assessment }));
    // 'Not Yet Available', not 'Pending Verification' — matches the real
    // backend's own paymentStatusOf() exactly: "assessed but unpaid, or not
    // yet assessed" is the SAME status, told apart only by whether
    // orderOfPayment is present. 'Pending Verification' is earned only once
    // a payment is actually submitted (submitPayment(), below) — setting it
    // here meant every freshly-assessed application already read as "a
    // payment is awaiting verification" before the citizen had sent one.
    this.updateApplication(applicationId, { assessedAmountCentavos: total, paymentStatus: 'Not Yet Available' });
    this.notifications.push(
      'Order of Payment issued',
      `An assessment of ${(total / 100).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })} is ready for ${app.applicationNumber}.`,
      'payment',
      applicationId,
    );
  }

  submitPayment(applicationId: string, method: PaymentMethod, referenceOrProof: string): void {
    const app = this.applicationById(applicationId);
    const assessment = this.assessmentFor(applicationId);
    if (!app || !assessment) return;
    const tx: PaymentTransaction = {
      id: nextId('pay'),
      assessmentId: assessment.id,
      applicationId,
      amountCentavos: assessment.balanceCentavos,
      method,
      agency: 'OBO/LGU',
      transactionReference: referenceOrProof,
      proofFileName: method === 'Bank Transfer' ? referenceOrProof : null,
      status: 'Pending Verification',
      submittedAt: todayIso(),
      verifiedAt: null,
      rejectionReason: null,
      orNumber: null,
      orDate: null,
    };
    this.paymentsByApp.update((map) => ({ ...map, [applicationId]: [...(map[applicationId] ?? []), tx] }));
    this.updateApplication(applicationId, { lifecycleStatus: 'Payment Submitted', paymentStatus: 'Pending Verification' });
    this.pushTimeline(applicationId, 'Payment Submitted', null);
    this.notifications.push(
      'Payment submitted',
      `Your payment for ${app.applicationNumber} has been submitted and is awaiting verification.`,
      'payment',
      applicationId,
    );
  }

  /**
   * Demo/scaffold-only: advances an application one step along the happy
   * path. Neither the Admin Portal nor a real backend exists yet to drive
   * these transitions server-side (see master command Section 15), so this
   * stands in for that until a real API is wired up. Not part of the
   * production feature spec — remove once a backend owns lifecycle
   * transitions.
   */
  advanceForDemo(applicationId: string): void {
    const app = this.applicationById(applicationId);
    if (!app) return;
    const idx = LIFECYCLE_SEQUENCE.indexOf(app.lifecycleStatus);
    if (idx < 0 || idx >= LIFECYCLE_SEQUENCE.length - 1) return;
    const next = LIFECYCLE_SEQUENCE[idx + 1];

    if (next === 'Assessed') {
      this.updateApplication(applicationId, { lifecycleStatus: next });
      this.pushTimeline(applicationId, next, null);
      this.issueAssessment(applicationId);
      return;
    }
    if (next === 'Payment Under Verification' || next === 'Payment Verified') {
      const payments = this.paymentsFor(applicationId);
      const latest = payments[payments.length - 1];
      if (latest) {
        this.paymentsByApp.update((map) => ({
          ...map,
          [applicationId]: (map[applicationId] ?? []).map((p) =>
            p.id === latest.id
              ? next === 'Payment Verified'
                ? { ...p, status: 'Verified', verifiedAt: todayIso(), orNumber: `OR-${nextId('').replace('-', '')}`, orDate: todayIso() }
                : p
              : p,
          ),
        }));
      }
      const assessment = this.assessmentFor(applicationId);
      if (next === 'Payment Verified' && assessment) {
        this.assessmentsByApp.update((map) => ({
          ...map,
          [applicationId]: { ...assessment, status: 'Paid', amountPaidCentavos: assessment.totalCentavos, balanceCentavos: 0 },
        }));

        // An office cannot verify a payment that was never made.
        //
        // This branch marked the assessment Paid and the application
        // paymentStatus 'Paid' while creating NO PaymentTransaction — so
        // Payments showed "Paid" and the receipt for the same application said
        // "No payment has been submitted for this application yet." Two screens,
        // two answers, one fact.
        //
        // Advancing straight past the payment flow is exactly how a citizen
        // reaches this state, so the advance has to record what it claims
        // happened. If a payment already exists (the citizen went through the
        // flow), verify THAT one rather than inventing a second.
        const existing = this.paymentsByApp()[applicationId] ?? [];
        const verifiedAt = todayIso();
        if (existing.length > 0) {
          this.paymentsByApp.update((map) => ({
            ...map,
            [applicationId]: (map[applicationId] ?? []).map((tx, i, all) =>
              i === all.length - 1 ? { ...tx, status: 'Verified' as const, verifiedAt } : tx,
            ),
          }));
        } else {
          const tx: PaymentTransaction = {
            id: nextId('pay'),
            assessmentId: assessment.id,
            applicationId,
            amountCentavos: assessment.totalCentavos,
            method: 'Onsite',
            agency: 'OBO/LGU',
            transactionReference: `DEMO-${nextId('').replace('-', '')}`,
            proofFileName: null,
            status: 'Verified',
            submittedAt: verifiedAt,
            verifiedAt,
            rejectionReason: null,
            // No OR number: only a cashier assigns one, and this is the demo
            // advance. The receipt keeps its watermark because of this.
            orNumber: null,
            orDate: null,
          };
          this.paymentsByApp.update((map) => ({ ...map, [applicationId]: [...(map[applicationId] ?? []), tx] }));
        }
      }
      this.updateApplication(applicationId, {
        lifecycleStatus: next,
        paymentStatus: next === 'Payment Verified' ? 'Paid' : 'Pending Verification',
      });
      this.pushTimeline(applicationId, next, null);
      return;
    }
    if (next === 'Permit Generated') {
      const req = app.permitType === 'Business Permit' ? null : requirementsFor(app.permitType);
      const validityMonths = req ? req.validityMonths : 12;
      // The generic flow has no catalog entry to read an office from. The
      // fallback used to be the "Business Permit and Licensing Office" — a real
      // but WRONG office: the BPLO issues business permits, and this product is
      // the Electronic Building Permit and Certificate of Occupancy. The office
      // that issues these is the one on the LGU's own checklist letterhead.
      const reviewingOffice = req ? req.reviewingOffice : MUNICIPAL_ENGINEER.name;
      const issued = todayIso();
      const expiry = validityMonths
        ? new Date(new Date(issued).setMonth(new Date(issued).getMonth() + validityMonths)).toISOString()
        : null;
      const permitNumber = `${prefixFor(app.permitType)}-${new Date().getFullYear()}-${nextId('').replace('-', '')}`;
      this.permitsByApp.update((map) => ({
        ...map,
        [applicationId]: {
          applicationId,
          permitNumber,
          // Minted by advanceForDemo(), which any signed-in portal user can
          // trigger from the Application Details screen. Not an issuance.
          provenance: 'demo',
          standing: null,
          conditions: [],   // advanceForDemo mints this; no office attached conditions
          issuedDateValue: new Date(issued),
          issuedDate: issued,
          expiryDateValue: expiry ? new Date(expiry) : null,
          expiryDate: expiry,
          approvingOfficial: 'Engr. Municipal Building Official',
          approvingOffice: reviewingOffice,
        },
      }));
      this.updateApplication(applicationId, { lifecycleStatus: next, permitNumber, issuedDate: issued, expiryDate: expiry, permitReleaseStatus: 'Not Ready' });
      this.pushTimeline(applicationId, next, null);
      this.notifications.push('Permit generated', `Your permit ${permitNumber} has been generated.`, 'permit', applicationId);
      return;
    }
    if (next === 'Ready for Release') {
      this.updateApplication(applicationId, { lifecycleStatus: next, permitReleaseStatus: 'Ready for Release' });
      this.pushTimeline(applicationId, next, null);
      this.notifications.push(
        'Permit ready for release',
        `Your permit for ${app.applicationNumber} is ready for release.`,
        'permit',
        applicationId,
      );
      return;
    }

    this.updateApplication(applicationId, { lifecycleStatus: next });
    this.pushTimeline(applicationId, next, null);
    if (next === 'Approved') {
      this.notifications.push('Application approved', `${app.applicationNumber} has been approved.`, 'application', applicationId);
    }
  }

  applicantStatus(applicationId: string) {
    const app = this.applicationById(applicationId);
    return app ? applicantStatusOf(app.lifecycleStatus) : undefined;
  }
}
