import { ApplicationDocument } from '../../core/domain/document.model';
import { ApplicationDocumentResponse, DocumentReviewStatus } from '../../core/api/citizen-api.models';

/**
 * Presents this build's in-memory documents in the CONTRACT's shape, so the
 * documents view is written once against what the server actually sends.
 *
 * This adapter invents nothing. Where the demo has no answer, the field is
 * `null` — which the view renders as "Not yet reviewed" or as nothing at all,
 * never as a pass:
 *
 *   reviewReason           the demo has no reason catalogue -> null
 *   supersedes/supersededBy the demo cannot replace a document yet -> null
 *   sha256 / byteSize      not recorded here -> empty / '0', shown nowhere
 *
 * `scanCleared: true, quarantined: false` is the one pair that cannot be null,
 * because the contract types them as booleans. It is safe ONLY because the view
 * renders nothing at all for the 'clear' state — it makes no claim on screen.
 * If that view ever shows a "scanned and clear" tick, this adapter becomes a
 * lie and must be revisited.
 */
export function toContractShape(d: ApplicationDocument): ApplicationDocumentResponse {
  return {
    id: d.id,
    label: d.label,
    fileName: d.fileName,
    contentType: '',
    byteSize: String(d.file?.size ?? 0),
    sha256: '',
    uploadedAt: d.uploadedAt,
    expiresOn: d.expiryDate,
    reviewStatus: reviewStatusOf(d.status),
    reviewedAt: null,
    reviewReason: null,
    reviewRemark: d.remarks,
    supersedesDocumentId: null,
    supersededByDocumentId: null,
    scanCleared: true,
    quarantined: false,
  };
}

/**
 * The demo's DocumentStatus onto the office's vocabulary.
 *
 * Anything this build cannot map becomes `null` — "not yet reviewed" — rather
 * than being forced into the nearest-looking verdict. Guessing 'Accepted' for
 * an unrecognised state is exactly the failure the contract warns about.
 */
function reviewStatusOf(status: string): DocumentReviewStatus | null {
  const known: DocumentReviewStatus[] = [
    'Missing', 'Uploaded', 'Submitted', 'Under Review', 'Accepted', 'Rejected', 'Revision Required', 'Expired',
  ];
  return (known as string[]).includes(status) ? (status as DocumentReviewStatus) : null;
}
