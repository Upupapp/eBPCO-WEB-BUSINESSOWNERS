import { Injectable, computed, signal } from '@angular/core';
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
import { GENERIC_APPLICATION_DOCUMENTS, requirementsFor } from '../domain/requirements-catalog';
import { nextId, todayIso } from '../utils/ids';
import { MUNICIPAL_ENGINEER } from '../domain/lgu-contact';

export interface CreateApplicationInput {
  businessId: string;
  businessName: string;
  permitType: PublishedPermitType;
  applicationAction: ApplicationAction;
  /** The permit being renewed or amended. Null for a 'New' application; required otherwise. */
  relatedPermitNumber: string | null;
}

let appSeq = 3000;

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

  constructor(
    private readonly auth: AuthService,
    private readonly notifications: NotificationStore,
  ) {
    this.seed();
  }

  private seed(): void {
    const app1: ApplicationRecord = {
      id: 'app-seed-1',
      applicationNumber: 'BP-2026-00147',
      businessId: 'biz-1',
      businessName: 'Dela Cruz Hardware & Construction Supply',
      applicantId: 'user-demo',
      permitType: 'Building Permit – New Construction',
      applicationAction: 'New',
      relatedPermitNumber: null,
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

  readonly myApplications = computed(() => {
    const uid = this.auth.currentUser()?.id;
    if (!uid) return [];
    return [...this.applications()]
      .filter((a) => a.applicantId === uid)
      .sort((a, b) => ((a.dateSubmitted ?? '') < (b.dateSubmitted ?? '') ? 1 : -1));
  });

  applicationById(id: string): ApplicationRecord | undefined {
    return this.applications().find((a) => a.id === id);
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
    return this.permitsByApp()[applicationId];
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
    const required = requirementsFor(app.permitType).documents.filter((d) => d.required);
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
        issueDate: null,
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
    const required = requirementsFor(app.permitType).documents.filter((d) => d.required);
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

  requiredDocumentsFor(permitType: PermitType | 'generic') {
    return permitType === 'generic' ? GENERIC_APPLICATION_DOCUMENTS : requirementsFor(permitType).documents;
  }

  /** Creates a Draft application — the applicant fills documents in before submitting. */
  createDraft(input: CreateApplicationInput): ApplicationRecord {
    const uid = this.auth.currentUser()!.id;
    // The form blocks this too, but a rule enforced only in the template is
    // enforced only for callers who go through the template.
    if (!actionReferenceIsComplete(input.applicationAction, input.relatedPermitNumber)) {
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
   * `file` is the actual File the citizen chose, and it is REQUIRED.
   *
   * It used to take only `fileName` and `fileType`, which meant the bytes were
   * already gone by the time anything reached this store — the same shape that
   * let the mobile app file applications with zero documents for its entire
   * life. Nothing downstream can upload a filename.
   */
  attachDocument(
    applicationId: string,
    requirementId: string,
    label: string,
    file: File,
    fileType: SavedDocumentFileType,
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
        issueDate: null,
        expiryDate: null,
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
    this.updateApplication(applicationId, { assessedAmountCentavos: total, paymentStatus: 'Pending Verification' });
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
