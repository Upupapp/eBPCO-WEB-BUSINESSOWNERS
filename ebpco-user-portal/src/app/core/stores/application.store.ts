import { Injectable, computed, signal } from '@angular/core';
import { AuthService } from '../session/auth.service';
import { NotificationStore } from './notification.store';
import { ApplicationRecord, StatusTimelineEntry } from '../domain/application.model';
import { ApplicationAction, GeneratedPermit, PermitType } from '../domain/permit.model';
import {
  ApplicationLifecycleStatus,
  LIFECYCLE_SEQUENCE,
  NEXT_STEP_TEXT,
  applicantStatusOf,
} from '../domain/status.model';
import { ApplicationDocument, DocumentStatus, SavedDocumentFileType } from '../domain/document.model';
import { Assessment, AssessmentLineItem } from '../domain/assessment.model';
import { PaymentMethod, PaymentTransaction } from '../domain/payment.model';
import { GENERIC_APPLICATION_DOCUMENTS, requirementsFor } from '../domain/requirements-catalog';
import { nextId, todayIso } from '../utils/ids';

export interface CreateApplicationInput {
  businessId: string;
  businessName: string;
  permitType: PermitType | 'General Business Permit';
  applicationAction: ApplicationAction;
}

let appSeq = 3000;

function prefixFor(permitType: PermitType | 'General Business Permit'): string {
  if (permitType === 'General Business Permit') return 'E-BPCO';
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
          { code: 'ZON-001', name: 'Locational / Zoning Fee', family: 'Locational/Zoning Fee', authority: 'LGU', amountCentavos: 85000, legalBasisTitle: 'LGU Fee Schedule' },
        ],
        totalCentavos: 85000,
        amountPaidCentavos: 85000,
        balanceCentavos: 0,
        opsNumber: 'OPS-2026-00231',
        dueDate: '2026-08-01T00:00:00.000Z',
        issuedAt: '2026-07-24T08:00:00.000Z',
      },
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

  /** Looks up a permit by its own real, system-generated permit number — the permit number itself doubles as the public verification token (see VerifyPermitPage). */
  permitByNumber(permitNumber: string): GeneratedPermit | undefined {
    return Object.values(this.permitsByApp()).find((p) => p.permitNumber === permitNumber);
  }

  /** True once every REQUIRED document for this application's permit type is on file in a resolved state (never Missing/Rejected/Revision Required/Expired) — the same real "documents resolved" check the generated permit document's draft-watermark gate reads. */
  documentsResolvedFor(applicationId: string): boolean {
    const app = this.applicationById(applicationId);
    if (!app || app.permitType === 'General Business Permit') return true;
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
    appSeq += 1;
    const record: ApplicationRecord = {
      id: nextId('app'),
      applicationNumber: `${prefixFor(input.permitType)}-${new Date().getFullYear()}-${String(appSeq).padStart(5, '0')}`,
      businessId: input.businessId,
      businessName: input.businessName,
      applicantId: uid,
      permitType: input.permitType,
      applicationAction: input.applicationAction,
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

  attachDocument(
    applicationId: string,
    requirementId: string,
    label: string,
    fileName: string,
    fileType: SavedDocumentFileType,
  ): void {
    this.documentsByApp.update((map) => {
      const existing = map[applicationId] ?? [];
      const idx = existing.findIndex((d) => d.requirementId === requirementId);
      const entry: ApplicationDocument = {
        id: idx >= 0 ? existing[idx].id : nextId('appdoc'),
        applicationId,
        requirementId,
        label,
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
        ? [{ code: 'FIL-001', name: 'Filing / Processing Fee', family: 'Filing/Processing', authority: 'LGU', amountCentavos: 525000, legalBasisTitle: 'LGU Fee Schedule' }]
        : [{ code: 'FIL-002', name: `${app.applicationAction} Fee`, family: 'Filing/Processing', authority: 'LGU', amountCentavos: app.applicationAction === 'Renewal' ? 320000 : 150000, legalBasisTitle: 'LGU Fee Schedule' }];
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
      }
      this.updateApplication(applicationId, {
        lifecycleStatus: next,
        paymentStatus: next === 'Payment Verified' ? 'Paid' : 'Pending Verification',
      });
      this.pushTimeline(applicationId, next, null);
      return;
    }
    if (next === 'Permit Generated') {
      const req = app.permitType === 'General Business Permit' ? null : requirementsFor(app.permitType);
      const validityMonths = req ? req.validityMonths : 12;
      const reviewingOffice = req ? req.reviewingOffice : 'Business Permit and Licensing Office';
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
