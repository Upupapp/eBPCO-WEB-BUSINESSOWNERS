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
}

export interface ResubmitRequest {
  fileName: string;
  label: string;
  contentBase64: string;
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
