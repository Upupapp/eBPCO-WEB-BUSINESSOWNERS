/**
 * The three citizen endpoints, typed from
 * `contract/citizen-endpoints.openapi.yaml` in eBPCOBackend (C-1 f7eb40e,
 * C-2 5a0f18a, D-8 18028a8).
 *
 * Every field here is pinned by that contract against RECORDED responses — real
 * bytes from the real controllers over real PostgreSQL — and a parity spec on
 * their side fails if the contract and the samples disagree in either direction.
 * So these types describe what the server sends, not what we imagine it sends.
 * Do not add a field that is not in the contract.
 */

/** The office's verdict on one document. NULL IS ITS OWN STATE — see below. */
export type DocumentReviewStatus =
  | 'Missing'
  | 'Uploaded'
  | 'Submitted'
  | 'Under Review'
  | 'Accepted'
  | 'Rejected'
  | 'Revision Required'
  | 'Expired';

export interface ReviewReason {
  /** Switch on this. */
  code: string;
  /** Display THIS. Never keep a local copy of the catalogue — the LGU edits it. */
  label: string;
  description: string;
}

export interface PermitRelease {
  status: 'Not Ready' | 'Ready for Release' | 'Released';
  method: 'Physical Claim' | 'Authorized Representative' | null;
  releasedAt: string | null;
}

export interface PermitResponse {
  permitNumber: string;
  issuedDate: string;
  /** Null when the officer recorded none. */
  scope: string | null;
  /**
   * What the permit REQUIRES of the holder. Render in full: "a citizen who
   * cannot read these cannot comply with them." Empty array when there are none.
   */
  conditions: string[];
  /**
   * ALWAYS PRESENT, and null until an officer has prepared the release.
   * **Null is a fact to render — "not yet ready to collect" — not a missing
   * value.** Both branches are recorded server-side, so a client that treats
   * null as "no data" is contradicting a deliberate answer.
   */
  release: PermitRelease | null;
}

export interface ApplicationDocumentResponse {
  id: string;
  label: string;
  fileName: string;
  contentType: string;
  /**
   * A STRING, not a number. The column is a bigint and JSON numbers lose
   * precision. Do not `Number()` it for anything but display.
   */
  byteSize: string;
  sha256: string;
  uploadedAt: string;
  expiresOn: string | null;
  /**
   * The OFFICER's verdict. **NULL MEANS NOBODY HAS LOOKED YET.** It does not
   * mean nothing is wrong. Rendering null as a tick would tell an applicant
   * their document passed when it has not been opened.
   */
  reviewStatus: DocumentReviewStatus | null;
  reviewedAt: string | null;
  /** Null when none was cited. */
  reviewReason: ReviewReason | null;
  /** Free text written for THIS applicant about THIS document. */
  reviewRemark: string | null;
  supersedesDocumentId: string | null;
  supersededByDocumentId: string | null;
  /**
   * Malware scan completed and passed. A DIFFERENT AXIS from reviewStatus:
   * an officer's rejection does not mean a virus.
   */
  scanCleared: boolean;
  /**
   * Held by the malware scanner. **Not an evaluation outcome** — a quarantined
   * file is not a verdict on the application.
   */
  quarantined: boolean;
  /** Which checklist entry this answers (C-6). Null means unattributed, never "answers none". */
  requirementCode: string | null;
}

export interface ResubmitRequest {
  fileName: string;
  label: string;
  contentBase64: string;
}

/**
 * `GET /applications` (one row) and `GET /applications/{id}` — the
 * applicant's own view of an application, built server-side by
 * `toApplicantView()` (`applicant-view.ts`), which whitelists fields onto a
 * fresh object precisely so nothing officer-scoped (an evaluation stage, an
 * officer's name) ever reaches this payload. Re-verified 2026-09-15 by
 * reading that function directly rather than assuming a shape.
 */
export interface ApplicationSummary {
  id: string;
  referenceNumber: string;
  serviceDomain: string;
  permitType: string;
  applicationAction: string;
  businessId: string | null;
  businessName: string | null;
  location: string | null;
  /** The permit this Renewal/Amendment renews, when it's a real one already on file. Null for New, and also null on the unverified claim path — see priorPermitClaim. */
  renewsPermitNumber: string | null;
  /** The permit this Renewal/Amendment renews, self-reported because it predates eBPCO. Never verified. Mutually exclusive with renewsPermitNumber. */
  priorPermitClaim: string | null;
  lifecycleStatus: string;
  /** The coarse, citizen-facing status — computed server-side. Prefer this over deriving one locally from lifecycleStatus. */
  applicantStatus: string;
  requiresApplicantAction: boolean;
  dateSubmitted: string | null;
  updatedAt: string;
  openInstructionCount: number;
  /** The applicant's own answers, as filed. */
  form: Record<string, unknown>;
  /** Absent — not present as a key at all — when the LGU's charter has no pledge for this permit type. */
  classification?: string;
  pledge?: {
    pledgedWorkingDays: number;
    dueDate: string | null;
    approximate: boolean;
    suspended: boolean;
    suspendedSince: string | null;
  };
  payment: {
    status: 'Not Yet Available' | 'Pending Verification' | 'Paid' | 'Overdue';
    /** Absent — not present, not null — until an officer has issued one. No key means no amount to render, not zero. */
    orderOfPayment?: {
      number: string;
      assessedAt: string;
      dueDate: string | null;
      feeScheduleVersion: string;
      fees: {
        filing: number;
        processing: number;
        architectural: number;
        structural: number;
        electrical: number;
        others: number;
      };
      totalCentavos: number;
    };
  };
}

/**
 * `GET /limits` — `@Public()`, no token needed: an upload screen has to
 * validate a file before the citizen has signed in to send it.
 */
export interface LimitsResponse {
  upload: {
    /** The largest whole REQUEST the server will read. Over this is a bare 413, not a problem document. */
    maxRequestBytes: number;
    /** The largest FILE that fits once base64 + envelope overhead is accounted for — the number a client actually needs. */
    maxFileBytes: number;
    encoding: 'base64-in-json';
  };
}

/**
 * `POST /documents` — upload not yet attached to an application (or
 * attached directly, if `applicationId`/`requirementCode` are given).
 */
export interface UploadDocumentRequest {
  fileName: string;
  label: string;
  applicationId?: string | null;
  requirementCode?: string | null;
  contentBase64: string;
}

export interface UploadDocumentResult {
  documentId: string;
  status: string;
  removedMetadata: string[];
}

/**
 * `POST /businesses` and `GET /businesses` — matches `businessShape` in
 * `businesses.controller.ts` exactly, `.strict()` on the server.
 * `registrationNumber`/`dateRegistered` are REQUIRED here — unlike the old
 * local-only mock, the server does not generate these itself.
 */
export interface SubmitBusinessRequest {
  name: string;
  category: 'Retail' | 'Food Service' | 'Services' | 'Manufacturing' | 'Construction' | 'Transport' | 'Agriculture' | 'Other';
  street: string;
  barangay: string;
  city: string;
  province: string;
  registrationNumber: string;
  /** YYYY-MM-DD. */
  dateRegistered: string;
}

export interface BusinessSummary extends SubmitBusinessRequest {
  id: string;
  status: string;
}

/**
 * `PATCH /businesses/:id` — matches `businessUpdateShape` in
 * `businesses.controller.ts`: the owner-editable subset only.
 * `registrationNumber`/`dateRegistered`/`status` are not here at all —
 * the server rejects them (`.strict()`), not just ignores them.
 */
export interface UpdateBusinessRequest {
  name: string;
  category: SubmitBusinessRequest['category'];
  street: string;
  barangay: string;
  city: string;
  province: string;
}

/** `GET /businesses` — `{ data }`, not a bare array. */
export interface BusinessListResponse {
  data: BusinessSummary[];
}

/**
 * `GET /notifications` — matches the wire shape built by
 * `NotificationsController.feed()` exactly (it does its own field-by-field
 * translation from the domain, so this is the contract, not an internal
 * shape leaking through).
 */
export type NotificationCategory =
  'applicationUpdates' | 'payments' | 'permitStatus' | 'documentReminders' | 'appointments' | 'account';

export interface NotificationEntry {
  id: string;
  type: string;
  category: NotificationCategory;
  applicationId: string | null;
  title: string;
  body: string;
  deepLink: string | null;
  createdAt: string;
  readAt: string | null;
  resolvedAt: string | null;
  requiresAction: boolean;
}

export interface NotificationFeedResponse {
  data: NotificationEntry[];
  nextCursor: string | null;
  unresolvedCount: number;
}

/**
 * `GET`/`PUT /notification-preferences` — a boolean per category (true means
 * NOT muted, i.e. "send me this"), plus one shared do-not-disturb window.
 * `start`/`end` are `HH:MM`, required even when `enabled` is false so
 * switching quiet hours off does not lose the times a citizen already set.
 */
export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface NotificationPreferencesResponse {
  categories: Record<NotificationCategory, boolean>;
  quietHours: QuietHours;
}

/** `POST /me/export` — RA 10173 §18 data portability. Same request replayed while queued, not a new one. */
export interface ExportRequestResult {
  requestId: string;
  requestedAt: string;
}

/** `GET /me/export/{requestId}` — polled, not pushed: no notification catalog entry exists for this yet. */
export interface ExportStatusResult {
  requestId: string;
  status: string;
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  byteSize: number | null;
  sha256: string | null;
  failureDetail: string | null;
}

/** `GET /me/export/{requestId}/content` — a short-lived signed URL, not the bytes. */
export interface ExportContentResult {
  url: string;
}

/** `DELETE /me` — RA 10173 §16(e) right to erasure. */
export interface ErasureReceipt {
  acceptedAt: string;
  erasedCategories: string[];
  retainedCategories: { category: string; basis: string; until: string | null }[];
}

/**
 * `POST /applications/{id}/payments` — submit proof of payment against an
 * already-issued Order of Payment. Matches `paymentShape` in
 * `applicant-write.controller.ts` exactly.
 */
export interface SubmitPaymentRequest {
  referenceNumber: string;
  method: 'Bank Transfer' | 'Onsite';
  /** YYYY-MM-DD. */
  paidOn: string;
  amountCentavos: number;
  /** A real, already-uploaded document id (see `UploadDocumentResult`) — the bank-transfer receipt, if any. */
  proofDocumentId?: string | null;
}

export interface SubmitPaymentResult {
  paymentId: string;
  /** True when this was a retried Idempotency-Key, not a new submission. */
  replayed: boolean;
  /** Whether this payment settles the balance in full. */
  settles: boolean;
}

/**
 * `POST /applications` — matches `submissionShape` in
 * `applicant-write.controller.ts` exactly, `.strict()` on the server: a
 * field not listed here is refused 400, not silently dropped.
 */
export interface SubmitApplicationRequest {
  permitType: string;
  applicationAction: 'New' | 'Renewal' | 'Amendment';
  /** The permit this renews/amends, as printed on the applicant's copy. Must already be on file — the server resolves it against issued permits. Use this OR priorPermitClaim, never both. */
  renewsPermitNumber?: string | null;
  /** The permit this renews/amends, when it predates eBPCO and so is not on file. Self-reported, never verified — requires a `prior-permit-proof` document attached. */
  priorPermitClaim?: string | null;
  /** A real business UUID. Null until businesses are wired for real (connection plan Stage 8). */
  businessId?: string | null;
  location?: string | null;
  /** Real, already-uploaded document ids. Empty until document upload is wired (Stage 6). */
  documentIds?: string[];
  form?: Record<string, unknown>;
  /** Files at Draft instead of Submitted — a real, resumable row with a real reference number, just not yet filed. */
  saveAsDraft?: boolean;
}

/**
 * `PATCH /applications/{id}` — keeps editing a Draft. Every field optional:
 * a partial save is the normal case, the citizen changed one thing and
 * nothing else. Mirrors `SubmitApplicationRequest` minus the fields a Draft
 * cannot change about itself (there are none) plus `documentIds`, which
 * here means "attach these newly uploaded documents", not "replace the
 * whole set" — see `SubmissionService.updateDraft`'s own doc comment.
 */
export interface DraftPatchRequest {
  permitType?: string;
  applicationAction?: 'New' | 'Renewal' | 'Amendment';
  renewsPermitNumber?: string | null;
  priorPermitClaim?: string | null;
  businessId?: string | null;
  location?: string | null;
  form?: Record<string, unknown>;
  documentIds?: string[];
}

/** `GET /applications` — `{ data, nextCursor }`, not a bare array (unlike documents/timeline). */
export interface ApplicationListResponse {
  data: ApplicationSummary[];
  nextCursor: string | null;
}

/** `GET /applications/{id}/timeline` — a bare array, applicant's own vocabulary (no `fromStatus`, no officer/office). */
export interface TimelineEntryResponse {
  status: string;
  occurredAt: string;
  remarks: string | null;
}

/**
 * `GET /applications/{id}/payments` — a bare array, every real payment
 * attempt this citizen has submitted, oldest first. Each submission is its
 * own row server-side (never updated in place), so a rejected attempt stays
 * visible here alongside whatever was submitted after it.
 */
export interface PaymentHistoryEntry {
  id: string;
  referenceNumber: string;
  method: 'Bank Transfer' | 'Onsite';
  amountCentavos: number;
  /** The real server vocabulary — no 'Rejected' value exists; a rejection resets this to 'Not Yet Available' and is told apart by `rejectionReason` below, not by status. */
  status: 'Not Yet Available' | 'Pending Verification' | 'Paid' | 'Overdue' | 'Voided' | 'Reversed' | 'Refunded';
  submittedAt: string;
  verifiedAt: string | null;
  officialReceiptNumber: string | null;
  /** Set only when THIS submission was rejected. Null means it never was. */
  rejectionReason: string | null;
  rejectedAt: string | null;
  /** Set only for a settled payment later Voided/Reversed/Refunded — a different, later kind of undo than a rejection. */
  exceptionReason: string | null;
  exceptionAt: string | null;
}

/**
 * `GET /documents/me` — every document this citizen has ever uploaded,
 * attached or not. Used to return only unattached documents; broadened so a
 * document already doing duty on one application (`applicationId` set) is
 * still visible and still reusable on another — filing one permit must not
 * consume a citizen's only copy of a document.
 */
export interface DocumentHistoryEntry {
  id: string;
  label: string;
  fileName: string;
  contentType: string;
  /** A STRING — the column is a bigint and JSON numbers lose precision. */
  byteSize: string;
  uploadedAt: string;
  requirementCode: string | null;
  /** Null means NO EXPIRY RECORDED, never "does not expire". */
  expiresOn: string | null;
  /** When the issuing office certified it — not when it was uploaded. Null means NOT RECORDED. */
  certifiedOn: string | null;
  scanCleared: boolean;
  quarantined: boolean;
  /** Null means unattached — freely reusable. Set means it is currently doing duty on a real filing (still reusable; just not idle). */
  applicationId: string | null;
  applicationReference: string | null;
  /** Null for an unattached document — nothing has reviewed it because there is no application to review it against. */
  reviewStatus: DocumentReviewStatus | null;
}

/** `GET /applications/{id}/requirements` — the checklist snapshot taken at filing, not the live catalogue. */
export interface RequirementsChecklistResponse {
  requirements: ReadonlyArray<{
    code: string;
    label: string;
    description: string;
    required: boolean;
    documentIds: string[];
    status: 'provided' | 'not-provided';
  }>;
  unattributedDocuments: number;
  attributionComplete: boolean;
}

/** `GET /requirements/{permitType}` — the live checklist, before an application even exists: what a permit type currently asks for, as the LGU has it configured right now (`requirements.controller.ts`'s "applicant's copy" route). */
export interface PermitRequirementsResponse {
  permitType: string;
  documents: ReadonlyArray<{
    code: string;
    label: string;
    description: string;
    required: boolean;
  }>;
}

export interface ResubmitResult {
  /** The NEW document. */
  documentId: string;
  supersedesDocumentId: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Missing';
  /**
   * Metadata stripped from the file — EXIF, GPS. Returned rather than silently
   * dropped, because a photograph of a site carries its coordinates and the
   * applicant is entitled to know the LGU removed them. **Show this.**
   */
  removedMetadata: string[];
}
