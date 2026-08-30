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
  uploadedAt: string;
  status: DocumentStatus;
  issuingOffice: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  /** Required whenever status is 'Rejected' or 'Revision Required'. */
  remarks: string | null;
  history: DocumentHistoryEntry[];
}

export type SavedDocumentFileType = 'pdf' | 'jpg' | 'jpeg' | 'png';

/** Mirrors ebpco-mobile's SavedDocumentCategory — the applicant's reusable "My Documents" library. */
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
  id: string;
  ownerId: string;
  fileName: string;
  fileType: SavedDocumentFileType;
  category: SavedDocumentCategory;
  uploadedAt: string;
  sizeBytes: number;
}
