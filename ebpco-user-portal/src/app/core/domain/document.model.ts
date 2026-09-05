// Mirrors the Admin Portal's core/domain/document.model.ts.
export type DocumentStatus =
  | 'Missing'
  | 'Uploaded'
  | 'Submitted'
  | 'Under Review'
  | 'Accepted'
  | 'Rejected'
  | 'Revision Required'
  | 'Expired';

export interface DocumentHistoryEntry {
  fileName: string;
  uploadedAt: string;
  status: DocumentStatus;
  remarks: string | null;
}

/** One uploaded file against one application's requirement checklist entry. */
export interface ApplicationDocument {
  id: string;
  applicationId: string;
  requirementId: string;
  label: string;
  fileName: string;
  fileType: SavedDocumentFileType;
  /**
   * The file the citizen actually chose.
   *
   * This exists because a filename is not a document. The mobile app filed
   * applications with ZERO documents for its entire life and nobody noticed:
   * every wizard showed the attachments in place, the review step listed them,
   * the confirmation said the application was filed — and the request carried
   * `documents: []`, because nothing upstream had ever kept the bytes.
   *
   * This portal had the same shape by construction (we are in parity with
   * mobile): `onFileSelected` read `file.name` and let the `File` go out of
   * scope on the next line. Nothing downstream could upload anything, because
   * by then there was nothing left to upload.
   *
   * `null` is honest and expected for seeded demo rows, which never had a file.
   * It must NOT be null for a document a citizen attached — see the guards in
   * application-wizard.page.spec.ts.
   */
  file: File | null;
  uploadedAt: string;
  status: DocumentStatus;
  issuingOffice: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  /** Required whenever status is 'Rejected' or 'Revision Required'. */
  remarks: string | null;
  history: DocumentHistoryEntry[];
  /**
   * Set when this document was CARRIED OVER from a permit the citizen already
   * holds, naming the document it came from.
   *
   * The office is shown that a document is reused — the Municipal ruling
   * requires it — and `issueDate` carries the date it was certified, which is
   * what the officer judges it by.
   */
  reusedFromDocumentId?: string | null;
  /**
   * The document this one REPLACED, when a citizen swapped out a reused one.
   *
   * Keeps the chain visible to the officer. A replacement is a fresh document
   * and carries NO certification date of its own — inheriting one would tell
   * the officer a file uploaded today was certified long ago.
   */
  supersedesDocumentId?: string | null;
}

export type SavedDocumentFileType = 'pdf' | 'jpg' | 'jpeg' | 'png';

/** Mirrors ebpco-mobile's SavedDocumentCategory — the citizen's reusable "My Documents" library. */
export type SavedDocumentCategory =
  | 'validGovernmentId'
  | 'proofOfAddress'
  | 'barangayClearance'
  | 'businessRegistration'
  | 'taxDocument'
  | 'propertyDocument'
  | 'authorizationLetter'
  | 'supportingDocument'
  | 'other'
  | 'uncategorized';

export const SAVED_DOCUMENT_CATEGORY_LABELS: Record<SavedDocumentCategory, string> = {
  validGovernmentId: 'Valid Government ID',
  proofOfAddress: 'Proof of Address',
  barangayClearance: 'Barangay Clearance',
  businessRegistration: 'Business Registration',
  taxDocument: 'Tax Document',
  propertyDocument: 'Property Document',
  authorizationLetter: 'Authorization Letter',
  supportingDocument: 'Supporting Document',
  other: 'Other',
  uncategorized: 'Uncategorized',
};

export interface SavedDocument {
  /** The chosen file. See ApplicationDocument.file — a filename is not a document. */
  file: File | null;
  id: string;
  ownerId: string;
  fileName: string;
  fileType: SavedDocumentFileType;
  category: SavedDocumentCategory;
  uploadedAt: string;
  sizeBytes: number;
}
