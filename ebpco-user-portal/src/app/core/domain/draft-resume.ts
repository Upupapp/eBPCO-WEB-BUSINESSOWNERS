/**
 * Where a saved Draft reopens (2026-10-01): at the first step the citizen
 * has not finished, or at Review & Submit once every step is done — so
 * "Continue" takes them back to where they stopped instead of to the first
 * page of an application they already filled in. Every field stays editable
 * through Back. The mobile app decides the same way (`draft_resume.dart`).
 */
export interface DraftProgress {
  /** A business is chosen (and not known to be inactive), and a Renewal or Amendment names its permit. */
  applicantDone: boolean;
  /** The project address and scope of work are filled in. */
  detailsDone: boolean;
  /** Every required document is attached. */
  documentsDone: boolean;
}

export type WizardStep = 1 | 2 | 3 | 4;

export function resumeStep(progress: DraftProgress): WizardStep {
  if (!progress.applicantDone) return 1;
  if (!progress.detailsDone) return 2;
  if (!progress.documentsDone) return 3;
  return 4;
}
