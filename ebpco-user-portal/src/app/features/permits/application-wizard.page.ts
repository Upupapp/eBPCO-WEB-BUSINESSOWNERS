import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ALL_PERMIT_TYPES, ApplicationAction, PermitType, isValidPermitType } from '../../core/domain/permit.model';
import { RequirementDocument } from '../../core/domain/requirements-catalog';
import {
  actionNeedsExistingPermit,
  actionReferenceIsComplete,
  existingPermitPrompt,
} from '../../core/domain/application.model';
import { SavedDocument, SavedDocumentFileType } from '../../core/domain/document.model';
import { SubmitApplicationRequest } from '../../core/api/citizen-api.models';
import { formatDate } from '../../core/utils/ids';
import { BusinessStore } from '../../core/stores/business.store';
import { ApplicationStore } from '../../core/stores/application.store';
import { DocumentLibraryStore } from '../../core/stores/document-library.store';
import { ToastService } from '../../shared/ui/toast.service';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { DocumentHistoryEntry } from '../../core/api/citizen-api.models';
import { UploadLimitsService } from '../../core/api/upload-limits.service';
import { toBase64 } from '../../core/api/document-resubmission.service';
import { ApiError } from '../../core/api/problem';
import { CapitalizeNameDirective } from '../../core/utils/capitalize-name.directive';
import { LegalDocument, LegalModalComponent } from '../../shared/ui/legal-modal.component';
import { DocumentPreviewComponent } from '../../shared/ui/document-preview.component';

type Step = 1 | 2 | 3 | 4;

interface AttachedDoc {
  /**
   * The File itself, not just its name.
   *
   * `onFileSelected` used to read `file.name` and let the File go out of scope
   * on the next line, so by the time `submit()` ran there was nothing left to
   * upload — the wizard showed every attachment in place, the review step
   * counted them, and the submission carried no documents at all. That is
   * precisely how the mobile app filed zero-document applications for its
   * entire life without anyone noticing.
   */
  file: File;
  fileName: string;
  fileType: SavedDocumentFileType;
}

/**
 * A document carried over from a permit the citizen already holds.
 *
 * Deliberately NOT an AttachedDoc with a null file. A reused document is a
 * REFERENCE to something the Municipality already has, not bytes we are
 * uploading — and the honest shape says so. Modelling it as an upload with a
 * missing file would be the "a filename is not a document" defect inverted:
 * claiming to carry something we do not, on the one path where the office
 * already has the real thing.
 *
 * `certifiedOn` is what the admin note is built from. See
 * docs/RULING-2026-09-03-renewal-reuse.md — an expiry date cannot say when a
 * document was certified, and the officer needs the certification date to make
 * the judgement the ruling leaves to them.
 */
interface ReusedDoc {
  documentId: string;
  fileName: string;
  fileType: SavedDocumentFileType;
  certifiedOn: string | null;
}

/**
 * A document already attached to THIS (still-Draft) application from an
 * earlier autosave, surviving a reload with no in-browser File to show.
 *
 * Deliberately not the 'reused' kind: that one means "carried over from a
 * DIFFERENT, previously-issued permit" and renders text saying so. This
 * document was uploaded and attached within this same application; it is
 * simply not resident in memory any more.
 */
interface AlreadyAttachedDoc {
  documentId: string;
  fileName: string;
  fileType: SavedDocumentFileType;
}

type Slot =
  | ({ kind: 'upload'; supersedesDocumentId?: string | null } & AttachedDoc)
  | ({ kind: 'reused' } & ReusedDoc)
  | ({ kind: 'attached' } & AlreadyAttachedDoc);

/** What the "view what I attached" popup needs. Built straight from an 'upload' slot's own File, or fetched fresh for a 'reused' one — see previewAttached(). */
interface WizardPreview {
  file: File;
  fileName: string;
  fileType: SavedDocumentFileType;
  label: string;
}

function fileTypeFromName(name: string): SavedDocumentFileType {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'pdf') return ext as SavedDocumentFileType;
  return 'pdf';
}

/**
 * ONE generic, catalog-driven wizard used for the Generic New Application
 * flow AND all 19 domain-specific permit types (master command Section 7.4).
 * Rather than hand-building 19 near-identical multi-step wizards (as
 * ebpco-mobile does, ~9 files each), this single component reads its
 * document checklist from `GET /requirements/{permitType}` — the LGU's own
 * live, staff-published catalogue, `loadRealDocuments` below — falling
 * back to the static requirements-catalog.ts only where nothing has been
 * published for that type yet. Same document/feature coverage either way,
 * far less duplicated code to maintain than 19 separate wizards.
 */
@Component({
  selector: 'app-application-wizard',
  imports: [FormsModule, RouterLink, CapitalizeNameDirective, LegalModalComponent, DocumentPreviewComponent],
  template: `
    <div class="page" style="max-width:760px;">
      <div class="page-header">
        <div>
          <h1>{{ isGeneric ? 'New Business Permit Application' : permitType }}</h1>
          <div class="subtitle">{{ isGeneric ? 'Generic application flow' : reviewingOffice() }}</div>
        </div>
        @if (api.configured && step() < 4) {
          <div style="text-align:right;">
            <button type="button" class="btn btn-secondary" [disabled]="saveStatus() === 'saving'" (click)="saveAndExit()">
              Save &amp; Exit
            </button>
            <div class="hint" style="margin-top:6px;">
              @switch (saveStatus()) {
                @case ('saving') { Saving… }
                @case ('saved') { Saved }
                @case ('error') { Could not save — try again }
                @default { Your progress is saved automatically as you go }
              }
            </div>
          </div>
        }
      </div>

      <div class="steps">
        <div class="step-item" [class.active]="step() === 1" [class.done]="step() > 1"><span class="dot">1</span> Business &amp; Type</div>
        <div class="step-sep"></div>
        <div class="step-item" [class.active]="step() === 2" [class.done]="step() > 2"><span class="dot">2</span> Details</div>
        <div class="step-sep"></div>
        <div class="step-item" [class.active]="step() === 3" [class.done]="step() > 3"><span class="dot">3</span> Documents</div>
        <div class="step-sep"></div>
        <div class="step-item" [class.active]="step() === 4"><span class="dot">4</span> Review &amp; Submit</div>
      </div>

      @if (step() === 1) {
        <div class="card">
          <div class="field">
            <label for="application-wizard-business-1">Business<span class="required">*</span></label>
            <select id="application-wizard-business-1" class="input" [(ngModel)]="businessId">
              <option [ngValue]="null" disabled>Select a business</option>
              @for (b of businesses.myBusinesses(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
            </select>
            @if (businesses.myBusinesses().length === 0) {
              <div class="hint">No businesses yet — <a routerLink="/businesses/register">register one first</a>.</div>
            }
          </div>
          <div class="field">
            <label for="application-wizard-application-type-2">Application Type<span class="required">*</span></label>
            <select id="application-wizard-application-type-2" class="input" [(ngModel)]="applicationAction" (ngModelChange)="onApplicationActionChange()">
              <option value="New">New Permit</option>
              <option value="Renewal">Renewal</option>
              <option value="Amendment">Amendment</option>
            </select>
          </div>
          @if (needsExistingPermit()) {
            <div class="field">
              <label for="application-wizard-related-permit">{{ existingPermitPrompt(applicationAction) }}<span class="required">*</span></label>
              @if (matchingRenewablePermits().length > 0) {
                <select id="application-wizard-related-permit" class="input" [(ngModel)]="relatedPermitNumber">
                  <option [ngValue]="null" disabled>Select a permit</option>
                  @for (p of matchingRenewablePermits(); track p.permitNumber) {
                    <option [value]="p.permitNumber">
                      {{ p.permitNumber }} — {{ p.permitType }}{{ p.businessName ? ' · ' + p.businessName : '' }}
                    </option>
                  }
                </select>
                <div class="hint">
                  The office needs to know which permit this application acts on. Only permits already
                  issued to you through eBPCO, for this business, are listed.
                </div>
              } @else {
                <!--
                  eBPCO launched into a Municipality with decades of paper
                  permits already outstanding — most real renewals have no
                  generated_permits row to select above. Automatic, not a
                  click-through: the moment eBPCO has no matching permit on
                  file for this business, the claim + proof upload appear
                  right here. Self-reported, never verified by the system,
                  and judged by staff from the attached proof (requirement
                  code prior-permit-proof).
                -->
                @if (isGeneric && !permitType) {
                  <label for="application-wizard-claim-permit-type" style="margin-top:10px; display:block;">
                    Permit Type<span class="required">*</span>
                  </label>
                  <select id="application-wizard-claim-permit-type" class="input" [(ngModel)]="permitType" (ngModelChange)="onClaimPermitTypeChosen()">
                    <option [ngValue]="null" disabled>Select a permit type</option>
                    @for (t of allPermitTypes; track t) { <option [value]="t">{{ t }}</option> }
                  </select>
                } @else {
                  <div class="hint" style="margin-bottom:8px;">
                    eBPCO has no permit of this type on file for this business, so there is nothing to
                    select — it may have been issued before this system existed.
                  </div>
                  <input
                    id="application-wizard-prior-permit-claim" class="input"
                    [(ngModel)]="priorPermitClaim"
                    placeholder="e.g. BP-1998-000042, as printed on the permit"
                  />
                  @if (priorPermitProofRequirement(); as proofReq) {
                    <div style="margin-top:10px;">
                      <label [for]="'claim-proof-' + proofReq.id" style="display:block; margin-bottom:6px;">
                        Upload a photo or scan of the permit<span class="required">*</span>
                      </label>
                      @if (uploadingRequirementId() === proofReq.id) {
                        <span class="badge">Sending…</span>
                      } @else if (attached[proofReq.id]; as slot) {
                        <button
                          type="button" class="badge badge-green"
                          style="border:none; cursor:pointer; font:inherit; margin-right:8px;"
                          [disabled]="previewingId() === proofReq.id"
                          [attr.aria-label]="'View ' + slot.fileName"
                          (click)="previewAttached(proofReq)"
                        >
                          {{ previewingId() === proofReq.id ? 'Opening…' : slot.fileName }}
                        </button>
                        <button class="btn btn-ghost btn-sm" (click)="removeAttachment(proofReq)">Remove</button>
                      } @else {
                        <input
                          [id]="'claim-proof-' + proofReq.id"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          [attr.aria-label]="'Attach ' + proofReq.label"
                          (change)="onFileSelected($event, proofReq)"
                        />
                      }
                      <div class="hint">eBPCO cannot verify this permit automatically — the office confirms it from this photo/scan.</div>
                    </div>
                  }
                }
              }
            </div>
          }
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <button class="btn btn-primary" (click)="toStep(2)">Continue</button>
        </div>
      }

      @if (step() === 2) {
        <div class="card">
          <div class="card-title">Project / Application Details</div>
          <div class="field"><label for="application-wizard-project-business-address-3">Project / Business Address<span class="required">*</span></label><input id="application-wizard-project-business-address-3" class="input" [(ngModel)]="projectAddress" placeholder="Street, Barangay, City" /></div>
          <div class="field"><label for="application-wizard-scope-of-work-4">Scope of Work / Purpose<span class="required">*</span></label><textarea id="application-wizard-scope-of-work-4" class="input" rows="3" [(ngModel)]="scopeOfWork" placeholder="Briefly describe the work or purpose of this application"></textarea></div>
          <div class="form-row">
            <div class="field"><label for="application-wizard-professional-in-charge-5">Professional in Charge (if any)</label><input id="application-wizard-professional-in-charge-5" class="input" [(ngModel)]="professionalName" placeholder="Engineer / Architect name" appCapitalizeName /></div>
            <div class="field"><label for="application-wizard-prc-license-no-6">PRC License No.</label><input id="application-wizard-prc-license-no-6" class="input" [(ngModel)]="prcNumber" /></div>
          </div>
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" (click)="step.set(1)">Back</button>
            <button class="btn btn-primary" (click)="toStep(3)">Continue</button>
          </div>
        </div>
      }

      @if (step() === 3) {
        <div class="card">
          <div class="card-title">Required Documents</div>
          <p class="small muted">Accepted formats: PDF, JPG, JPEG, PNG.</p>
          @if (needsExistingPermit()) {
            <!--
              Municipal ruling, 3 Sep 2026 (docs/RULING-2026-09-03-renewal-reuse.md).
              The previous copy told a renewing citizen the Municipality had not
              published a shorter list. That was honest when written and is now
              wrong: there is no shorter list and there was never going to be
              one. Nothing is omitted; what changes is that documents already on
              file are carried over. Neutral styling, not a warning: being asked
              for the full list is the normal case, not a problem.
            -->
            <div class="card" style="background:var(--secondary-50); margin-bottom:12px;">
              <strong>Your documents are already attached.</strong>
              {{ reusedCount() }} of your
              {{ applicationAction === 'Renewal' ? 'existing permit' : 'permit' }}'s documents have
              been carried over, so you do not need to upload them again. You can replace any of
              them with a newer copy if something has changed.
            </div>
          }
          @for (d of documents; track d.id) {
            <div style="padding:12px 0; border-bottom:1px solid var(--border-light);">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div>
                  <span class="badge" [class]="isRequired(d) ? 'badge-req' : 'badge-opt'" style="margin-right:6px;">{{ isRequired(d) ? 'Required' : 'Optional' }}</span>
                  <strong>{{ d.label }}</strong>
                  @if (d.description) { <div class="small muted">{{ d.description }}</div> }
                </div>
                @if (uploadingRequirementId() === d.id) {
                  <span class="badge">Sending…</span>
                } @else if (attached[d.id]; as slot) {
                  <button
                    type="button" class="badge badge-green"
                    style="border:none; cursor:pointer; font:inherit;"
                    [disabled]="previewingId() === d.id"
                    [attr.aria-label]="'View ' + slot.fileName"
                    (click)="previewAttached(d)"
                  >
                    {{ previewingId() === d.id ? 'Opening…' : slot.fileName }}
                  </button>
                  @if (slot.kind === 'upload' && api.configured && !uploadedDocumentIds()[d.id]) {
                    <span class="small muted">Not sent yet</span>
                  }
                }
              </div>
              <div style="margin-top:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <!--
                  The requirement's name lives in a <strong> above, not a
                  <label>, so this control had no accessible name at all. It
                  renders once per requirement — twenty-two times on a Zoning
                  application — so a screen reader user met twenty-two identical
                  unnamed file pickers with no way to tell which document each
                  one was for. Named from the requirement itself so the two can
                  never drift apart.
                -->
                <!--
                  A reused document says so, and says WHEN IT WAS CERTIFIED,
                  because that is the fact the officer needs to make the
                  judgement the Municipal ruling leaves to them.

                  Deliberately NEUTRAL: no amber, no warning icon, and nothing
                  about age even when the document is long past its validity.
                  The ruling is explicit that an expired reused document is
                  accepted and that the officer decides — and a warning we add
                  for kindness becomes a refusal the citizen believes. See
                  docs/RULING-2026-09-03-renewal-reuse.md.
                -->
                @if (attached[d.id]; as slot) {
                  @if (slot.kind === 'reused') {
                    <div class="small muted" style="flex-basis:100%;">
                      Reused from your previous permit@if (slot.certifiedOn) {, certified {{ formatDate(slot.certifiedOn) }}}.
                    </div>
                  } @else if (slot.kind === 'attached') {
                    <div class="small muted" style="flex-basis:100%;">Saved from where you left off.</div>
                  }
                }
                <!--
                  #fileInput is handed to Remove and to the reuse picker so
                  they can clear it. A native file input keeps showing the
                  last chosen filename on its own, so after "Remove" the row
                  read "Choose File  sample.pdf" while nothing was attached —
                  the citizen could not tell whether the removal had happened.
                -->
                <input
                  #fileInput
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  [attr.aria-label]="(attached[d.id]?.kind === 'reused' ? 'Replace ' : 'Attach ') + d.label"
                  (change)="onFileSelected($event, d)"
                />
                @if (reusable().length > 0) {
                  <label [for]="'reuse-' + d.id" class="small muted">or reuse</label>
                  <select
                    [id]="'reuse-' + d.id"
                    class="input"
                    style="max-width:260px;"
                    [ngModel]="null"
                    [ngModelOptions]="{ standalone: true }"
                    (ngModelChange)="reuseExisting(d, $event, fileInput)"
                  >
                    <option [ngValue]="null">A document you've already uploaded…</option>
                    @for (saved of reusable(); track saved.id) {
                      <!--
                        The upload date is shown because it is the only thing
                        this portal knows about a saved document's age. The
                        library carries no expiry date, so the portal cannot say
                        whether a document is still valid — but it can stop a
                        citizen reusing a two-year-old clearance without ever
                        seeing how old it was.
                      -->
                      <option [ngValue]="saved">{{ saved.fileName }} · uploaded {{ formatDate(saved.uploadedAt) }}</option>
                    }
                  </select>
                }
                @if (attached[d.id]) {
                  <button class="btn btn-ghost btn-sm" (click)="removeAttachment(d, fileInput)">Remove</button>
                }
              </div>
            </div>
          }
          @if (error()) { <div class="field error" style="margin-top:10px;">{{ error() }}</div> }
          <div style="display:flex; gap:10px; margin-top:14px;">
            <button class="btn btn-secondary" (click)="step.set(2)">Back</button>
            <button class="btn btn-primary" (click)="toStep(4)">Continue</button>
          </div>
        </div>
      }

      @if (step() === 4) {
        <div class="card">
          <div class="card-title">Review &amp; Declaration</div>
          <table class="table">
            <tbody>
              <tr><td class="muted">Business</td><td>{{ selectedBusinessName() }}</td></tr>
              <tr><td class="muted">Permit Type</td><td>{{ isGeneric ? 'New Business Permit (Generic)' : permitType }}</td></tr>
              <tr><td class="muted">Application Type</td><td>{{ applicationAction }}</td></tr>
              @if (needsExistingPermit() && relatedPermitNumber) {
                <tr><td class="muted">{{ existingPermitPrompt(applicationAction) }}</td><td><strong>{{ relatedPermitNumber }}</strong></td></tr>
              }
              @if (needsExistingPermit() && priorPermitClaim) {
                <tr>
                  <td class="muted">{{ existingPermitPrompt(applicationAction) }}</td>
                  <td><strong>{{ priorPermitClaim }}</strong> <span class="small muted">(not on file in eBPCO — unverified)</span></td>
                </tr>
              }
              <tr><td class="muted">Documents Attached</td><td>{{ attachedCount() }} of {{ documents.length }}</td></tr>
            </tbody>
          </table>
          <hr class="divider" />
          <label class="checkbox-row" style="margin-bottom:8px;">
            <input type="checkbox" [(ngModel)]="understandRequirements" /> I understand the application requirements and certify the information provided is true and correct.
          </label>
          <!--
            Same overlay the sign-up form uses (legal-modal.component.ts) —
            a citizen asked to agree to terms mid-application must be able to
            read them without leaving the form, and this used to be plain text.
          -->
          <label class="checkbox-row" style="margin-bottom:14px;">
            <input type="checkbox" [(ngModel)]="agreeTerms" /> I agree to the
            <button type="button" class="link-button" (click)="openLegalModal.set('terms')">Terms &amp; Conditions</button>
          </label>
          @if (openLegalModal(); as doc) {
            <app-legal-modal [document]="doc" (close)="openLegalModal.set(null)" />
          }
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" [disabled]="submitting()" (click)="step.set(3)">Back</button>
            <button class="btn btn-primary" [disabled]="submitting() || uploadingRequirementId() !== null" (click)="submit()">
              {{ submitting() ? 'Submitting…' : 'Submit Application' }}
            </button>
          </div>
        </div>
      }

      @if (preview(); as p) {
        <app-document-preview
          [file]="p.file"
          [fileName]="p.fileName"
          [fileType]="p.fileType"
          [label]="p.label"
          (close)="preview.set(null)"
        />
      }
    </div>
  `,
})
export class ApplicationWizardPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly businesses = inject(BusinessStore);
  private readonly applicationStore = inject(ApplicationStore);
  private readonly documentLibrary = inject(DocumentLibraryStore);
  private readonly toast = inject(ToastService);
  protected readonly api = inject(CitizenApiClient);
  private readonly uploadLimits = inject(UploadLimitsService);
  readonly submitting = signal(false);
  /** Which legal document the Review step's overlay is showing, if any. */
  readonly openLegalModal = signal<LegalDocument | null>(null);

  /**
   * Real, server-assigned document ids for this wizard's uploads, keyed by
   * requirement id — populated as each file finishes a real `POST
   * /documents`, whether it was freshly picked (`onFileSelected`) or reused
   * from the real library (`reuseExisting`, which re-uploads the reused
   * document's own bytes — there is no "attach by reference" route).
   * `submitReal()` reads this map, not `attached`, to build `documentIds` —
   * the two are allowed to disagree, and when they do, the citizen is told
   * so rather than it being papered over.
   */
  protected readonly uploadedDocumentIds = signal<Record<string, string>>({});
  protected readonly uploadingRequirementId = signal<string | null>(null);

  /** What's showing in the "view what I attached" popup, or null. See previewAttached(). */
  protected readonly preview = signal<WizardPreview | null>(null);
  /** Which requirement's reused document is currently being fetched for preview (an 'upload' slot already holds its File, so this only ever applies to 'reused'). */
  protected readonly previewingId = signal<string | null>(null);

  protected readonly realDocuments = signal<DocumentHistoryEntry[]>([]);

  readonly step = signal<Step>(1);
  readonly error = signal<string | null>(null);

  /** The real server id, once this application exists there as a Draft — set by the first autosave, or by resumeDraft(). */
  protected readonly draftId = signal<string | null>(null);
  /** Drives the small status line beside Save & Exit. 'idle' before the first autosave has any reason to fire. */
  protected readonly saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  /**
   * Document ids already confirmed attached to this draft server-side, so a
   * later autosave sends only what is actually new. Resending an id already
   * attached would fail `updateDraft`'s own ownership check — it looks for
   * an UNATTACHED document uploaded by this citizen, and an id already
   * attached to this same application no longer matches that.
   */
  private readonly attachedToServer = new Set<string>();

  isGeneric = true;
  permitType: PermitType | null = null;
  documents: RequirementDocument[] = [];
  /**
   * True once `documents` above holds the real, live checklist (from
   * `GET /requirements/{permitType}`) rather than the static
   * requirements-catalog.ts fallback — `uploadReal()` checks this before
   * sending a document's `id` as `requirementCode`: a static-catalog id
   * sent as one is a real, honest server refusal (see that method's own
   * comment). Starts false on every (re)assignment of `documents` and
   * flips true only inside `loadRealDocuments`'s own success callback.
   */
  usingRealRequirementCodes = false;

  /**
   * Upgrades `documents`/`usingRealRequirementCodes` in place once the
   * real checklist answers — same "start with what's known locally, swap
   * in the real thing the moment it arrives" shape as `realDocuments`
   * above. Left quietly on the static catalog (no error surfaced) when
   * the LGU hasn't published a checklist for this permit type yet, or the
   * call fails: the static catalog is a genuine, disclosed fallback, not
   * an error state.
   */
  private loadRealDocuments(permitType: PermitType | 'generic', applicationAction: ApplicationAction): void {
    const key = permitType === 'generic' ? 'Business Permit' : permitType;
    this.api.getRequirementsForPermitType(key, applicationAction).subscribe({
      next: (result) => {
        if (result.documents.length === 0) return;
        const previousDocs = this.documents;
        const nextDocs: RequirementDocument[] = result.documents.map((d) => ({
          id: d.code,
          label: d.label,
          required: d.required,
          description: d.description || undefined,
        }));
        // Re-key anything already attached/reused under the static
        // catalog's id, by label, so swapping in the real ids doesn't drop
        // a file the citizen already picked. Both catalogs were seeded
        // from the same source, so labels line up even where ids might
        // not once a staff member republishes this permit type's checklist.
        const reattached: Record<string, Slot> = {};
        for (const [oldId, slot] of Object.entries(this.attached)) {
          const oldDoc = previousDocs.find((d) => d.id === oldId);
          const match = oldDoc ? nextDocs.find((d) => d.label === oldDoc.label) : undefined;
          reattached[match ? match.id : oldId] = slot;
        }
        this.attached = reattached;
        this.documents = nextDocs;
        this.usingRealRequirementCodes = true;
      },
      error: () => {},
    });
  }

  businessId: string | null = null;
  applicationAction: ApplicationAction = 'New';
  relatedPermitNumber: string | null = null;
  /**
   * The unverified alternative to `relatedPermitNumber` — a permit the
   * citizen says the Municipality issued before eBPCO existed, so it has no
   * `generated_permits` row to select from `matchingRenewablePermits()`
   * below. See `SubmissionService.resolveRenewal`'s own doc comment on the
   * backend for why this is a separate field rather than a looser
   * `relatedPermitNumber`.
   */
  priorPermitClaim: string | null = null;
  protected readonly allPermitTypes = ALL_PERMIT_TYPES;

  protected readonly existingPermitPrompt = existingPermitPrompt;
  protected readonly actionReferenceIsComplete = actionReferenceIsComplete;
  protected readonly renewablePermits = computed(() => this.applicationStore.renewablePermits());
  /**
   * `renewablePermits()` narrowed to what THIS application could actually be
   * about: the same business (a permit belongs to one business, never a
   * shared pool across all of a citizen's businesses), and — once a type is
   * known — the same permit type, since a Fencing Permit must never appear
   * while renewing a Building Permit. Not a `computed()`: it reads plain
   * `businessId`/`permitType` properties, not signals, so Angular's default
   * change detection is what keeps it live — see the constructor's own
   * pattern. This is what makes the switch between "select a permit" and
   * "claim one" fully automatic: the moment a business (and, once relevant,
   * a permit type) is chosen, this re-evaluates with no click required.
   */
  protected matchingRenewablePermits() {
    return this.renewablePermits().filter((p) =>
      (this.businessId === null || p.businessId === this.businessId)
      && (this.isGeneric || p.permitType === this.permitType));
  }
  protected needsExistingPermit(): boolean {
    return actionNeedsExistingPermit(this.applicationAction);
  }
  /**
   * Reloads the document checklist for the newly chosen action — Building
   * Permit's varies by action (migration 047), and `prior-permit-proof`
   * (053) only exists on the Renewal/Amendment entries, so without this the
   * claim path's own proof-upload field could never find its requirement.
   * Also clears both permit references when switching back to New, which
   * asserts a relationship the citizen never claimed otherwise.
   */
  protected onApplicationActionChange(): void {
    if (this.applicationAction === 'New') {
      this.relatedPermitNumber = null;
      this.priorPermitClaim = null;
    }
    if (!this.isGeneric && this.permitType) {
      this.documents = this.applicationStore.requiredDocumentsFor(this.permitType, this.applicationAction);
      this.usingRealRequirementCodes = false;
      this.loadRealDocuments(this.permitType, this.applicationAction);
    }
  }
  /** The generic flow has no permit type until either a matched permit or this picker supplies one. */
  protected onClaimPermitTypeChosen(): void {
    if (!this.permitType) return;
    this.isGeneric = false;
    this.documents = this.applicationStore.requiredDocumentsFor(this.permitType, this.applicationAction);
    this.usingRealRequirementCodes = false;
    this.loadRealDocuments(this.permitType, this.applicationAction);
  }
  /** The claim path's own upload target, once the checklist for this type/action actually carries it (see `onApplicationActionChange`/`onClaimPermitTypeChosen`). */
  protected priorPermitProofRequirement(): RequirementDocument | undefined {
    return this.documents.find((d) => d.id === 'prior-permit-proof');
  }
  /**
   * `d.required` is the catalog's own answer — a pure function of permit
   * type and action, blind to whether THIS citizen has anything to select
   * above. `prior-permit-proof` is deliberately `required: false` there
   * (053) for exactly that reason; this is where its real requiredness,
   * specific to the claim path, is enforced instead.
   */
  protected isRequired(d: RequirementDocument): boolean {
    return d.required || (d.id === 'prior-permit-proof' && !!this.priorPermitClaim);
  }
  projectAddress = '';
  scopeOfWork = '';
  professionalName = '';
  prcNumber = '';
  attached: Record<string, Slot> = {};

  /**
   * Carry the previous permit's documents over, pre-selected.
   *
   * Reuse is the DEFAULT state of a renewal or amendment, not an opt-in — the
   * Municipality ruled that nothing is omitted and that what changes is who
   * supplies the documents. So this runs the moment a permit is chosen, and the
   * citizen arrives at step 3 with the list already satisfied.
   */
  protected carryOverDocuments(): void {
    if (!actionNeedsExistingPermit(this.applicationAction) || !this.relatedPermitNumber) return;
    const source = this.applicationStore
      .renewablePermits()
      .find((p) => p.permitNumber === this.relatedPermitNumber);
    if (!source) return;

    // A renewal or amendment is of the SAME permit type as the permit it acts
    // on — you cannot renew a Zoning clearance through the generic form. The
    // chosen permit therefore decides the form, and this is also what makes the
    // requirement ids line up so the carry-over below can match anything at all.
    if (source.permitType !== 'Business Permit') {
      this.isGeneric = false;
      this.permitType = source.permitType as PermitType;
      this.documents = this.applicationStore.requiredDocumentsFor(source.permitType, this.applicationAction);
      this.usingRealRequirementCodes = false;
      this.loadRealDocuments(source.permitType, this.applicationAction);
    }

    const previous = this.applicationStore.documentsFor(source.applicationId);
    const next: Record<string, Slot> = {};
    for (const d of this.documents) {
      const match = previous.find((p) => p.requirementId === d.id);
      if (!match) continue;
      next[d.id] = {
        kind: 'reused',
        documentId: match.id,
        fileName: match.fileName,
        fileType: match.fileType,
        // The issue date ONLY. Falling back to uploadedAt was wrong: an upload
        // date is not a certification date, and "uploaded 9 months ago" is not
        // the statement "certified on <date>". A null here means NOT RECORDED,
        // which is honest — the officer is told nothing rather than told
        // something invented. (backend #0391: nothing in the estate records a
        // certification date yet, and who supplies it is an open owner question.)
        certifiedOn: match.issueDate ?? null,
      };
    }
    // A citizen who has already replaced something keeps their choice.
    this.attached = { ...next, ...this.attached };
  }

  /** How many of this application's documents came from the previous permit. */
  protected reusedCount(): number {
    return Object.values(this.attached).filter((a) => a.kind === 'reused').length;
  }

  understandRequirements = false;
  agreeTerms = false;

  constructor() {
    const draftParam = this.route.snapshot.queryParamMap.get('draft');
    const typeParam = this.route.snapshot.queryParamMap.get('type');
    const businessParam = this.route.snapshot.queryParamMap.get('businessId');
    if (businessParam) this.businessId = businessParam;
    if (draftParam && this.api.configured) {
      // Resume replaces every field below once it answers -- see its own
      // doc comment. Still need SOME starting checklist in the meantime so
      // the template has something to render before that arrives.
      this.isGeneric = true;
      this.documents = this.applicationStore.requiredDocumentsFor('generic', this.applicationAction);
      void this.resumeDraft(draftParam);
    } else if (typeParam && typeParam !== 'generic' && isValidPermitType(typeParam)) {
      this.isGeneric = false;
      this.permitType = typeParam;
      this.documents = this.applicationStore.requiredDocumentsFor(typeParam, this.applicationAction);
      this.loadRealDocuments(typeParam, this.applicationAction);
    } else {
      this.isGeneric = true;
      this.documents = this.applicationStore.requiredDocumentsFor('generic', this.applicationAction);
      this.loadRealDocuments('generic', this.applicationAction);
    }
    if (this.api.configured) {
      this.api.getMyDocuments().subscribe({
        next: (docs) => this.realDocuments.set(docs),
        error: () => {},
      });
    }
  }

  /**
   * Resume a Draft this citizen already started — `?draft=<id>` from either
   * "Continue" on My Applications or the wizard's own Save & Exit.
   *
   * `GET /applications/{id}` and `GET /applications/{id}/documents` are the
   * server's own record of what was saved, read back the same way a fresh
   * GET always would be — nothing here is reconstructed from local state,
   * because there is none: a reload is exactly the case this exists for.
   *
   * Lands on step 1 rather than guessing which step the citizen was on —
   * every field is pre-filled and still editable from there regardless, and
   * guessing wrong would hide a field that needs a second look.
   */
  private async resumeDraft(id: string): Promise<void> {
    const result = await this.applicationStore.fetchForResume(id);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    const { application, documents } = result;
    this.draftId.set(id);
    this.businessId = application.businessId;
    this.applicationAction = (application.applicationAction as ApplicationAction) ?? 'New';
    this.relatedPermitNumber = application.renewsPermitNumber;
    this.priorPermitClaim = application.priorPermitClaim;
    this.projectAddress = application.location ?? '';
    const form = application.form ?? {};
    this.scopeOfWork = typeof form['scopeOfWork'] === 'string' ? form['scopeOfWork'] : '';
    this.professionalName = typeof form['professionalName'] === 'string' ? form['professionalName'] : '';
    this.prcNumber = typeof form['prcNumber'] === 'string' ? form['prcNumber'] : '';

    // 'Business Permit' is the one value the generic flow's own submit
    // always sends and the claim picker's PermitType list never offers
    // (PublishedPermitType's own doc comment) — so it unambiguously means
    // the generic flow, never a specific chosen type.
    if (application.permitType !== 'Business Permit' && isValidPermitType(application.permitType)) {
      this.isGeneric = false;
      this.permitType = application.permitType;
    } else {
      this.isGeneric = true;
      this.permitType = null;
    }
    this.documents = this.applicationStore.requiredDocumentsFor(
      this.isGeneric ? 'generic' : this.permitType!, this.applicationAction,
    );
    this.usingRealRequirementCodes = false;
    this.loadRealDocuments(this.isGeneric ? 'generic' : this.permitType!, this.applicationAction);

    // Every already-attached document came back with the requirement code
    // it answers (C-6) — re-hydrated as 'attached' rather than 'upload':
    // there is no in-browser File to reconstruct after a reload, and unlike
    // a carried-over renewal document (Slot's 'reused' kind) this is not a
    // reuse of something from a DIFFERENT permit, so it gets its own kind
    // rather than borrowing that label and its "reused from your previous
    // permit" text.
    const attached: Record<string, Slot> = {};
    const ids: Record<string, string> = {};
    for (const doc of documents) {
      if (!doc.requirementCode) continue;
      attached[doc.requirementCode] = {
        kind: 'attached', documentId: doc.id, fileName: doc.fileName, fileType: fileTypeFromName(doc.fileName),
      };
      ids[doc.requirementCode] = doc.id;
      this.attachedToServer.add(doc.id);
    }
    this.attached = attached;
    this.uploadedDocumentIds.set(ids);
    this.saveStatus.set('saved');
  }

  reviewingOffice(): string {
    if (this.isGeneric || !this.permitType) return '';
    return this.applicationStore.requiredDocumentsFor(this.permitType) ? '' : '';
  }

  selectedBusinessName(): string {
    return this.businesses.myBusinesses().find((b) => b.id === this.businessId)?.name ?? '';
  }

  attachedCount(): number {
    return Object.keys(this.attached).length;
  }

  async onFileSelected(event: Event, d: RequirementDocument): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // Replacing a REUSED document does not inherit its certification date.
    // The natural implementation copies the record and swaps the file, and the
    // admin note would then read "certified <old date>" over a document
    // uploaded today — misinforming the officer in exactly the direction the
    // ruling protects. A replacement is a fresh document with NO certification
    // date, and it keeps a pointer to what it superseded so the chain stays
    // visible. (citizen-mobile #0387 named this rule; our two lanes converged
    // on everything else independently.)
    const previous = this.attached[d.id];
    const supersedes = previous?.kind === 'reused' ? previous.documentId : null;
    this.attached = {
      ...this.attached,
      [d.id]: {
        kind: 'upload',
        file,
        fileName: file.name,
        fileType: fileTypeFromName(file.name),
        supersedesDocumentId: supersedes,
      },
    };
    this.documentLibrary.add({ file, fileName: file.name, fileType: fileTypeFromName(file.name), category: 'supportingDocument', sizeBytes: file.size });
    // A real id for THIS attachment, invalidated the moment a different file
    // replaces it — hence the delete before every fresh attempt below.
    this.uploadedDocumentIds.update(({ [d.id]: _drop, ...rest }) => rest);
    if (this.api.configured) await this.uploadReal(d, file);
  }

  /**
   * `POST /documents` for real, unattached (no `applicationId` yet — the
   * application does not exist until `submitReal()` files it, and this
   * upload has to survive the citizen changing their mind about which
   * requirement it answers before then).
   *
   * Checked against `UploadLimitsService`'s LIVE ceiling, not the wizard's
   * own guess — the same real number `DocumentResubmissionService` uses.
   */
  private async uploadReal(d: RequirementDocument, file: File): Promise<void> {
    if (file.size > this.uploadLimits.maxFileBytes()) {
      this.error.set(
        `"${file.name}" is ${Math.round(file.size / 1000)} KB. The Municipality's system accepts up to about ` +
        `${Math.round(this.uploadLimits.maxFileBytes() / 1000)} KB.`,
      );
      return;
    }
    this.uploadingRequirementId.set(d.id);
    try {
      const contentBase64 = await toBase64(file);
      // `d.id` is only a real, server-recognised requirement code once
      // `usingRealRequirementCodes` is true (see `loadRealDocuments`) — the
      // static requirements-catalog.ts fallback's own ids (e.g. 'land-title')
      // are NOT the same scheme a staff member's republished checklist can
      // end up using, and sending one that doesn't match is a real, honest
      // server refusal ("This permit type has no requirement called...").
      // Omitted (not a guessed code) whenever the real checklist hasn't
      // loaded yet, exactly as before this fetch existed.
      const requirementCode = this.usingRealRequirementCodes ? d.id : null;
      const result = await firstValueFrom(
        this.api.uploadDocument({ fileName: file.name, label: d.label, requirementCode, contentBase64 }),
      );
      this.uploadedDocumentIds.update((map) => ({ ...map, [d.id]: result.documentId }));
    } catch (error) {
      this.error.set(
        error instanceof ApiError
          ? error.citizenMessage
          : `"${file.name}" could not be sent to the Municipality. It is still attached here — try again, or remove it.`,
      );
    } finally {
      this.uploadingRequirementId.set(null);
    }
  }

  /**
   * Documents already on file that can actually be reused.
   *
   * Real path: `GET /documents/me` (broadened — see `citizen-api.client.ts`),
   * every document this citizen has ever uploaded, attached or not. Used to
   * be sourced from `DocumentLibraryStore` filtered on `file !== null` —
   * which worked only within the tab that did the upload (a `File` object
   * cannot survive a reload), so a document from an earlier session, or a
   * PREVIOUS permit, could never actually be reused. Real documents have no
   * in-browser `File` until `reuseExisting` fetches one — see there.
   *
   * Demo path unchanged: filtered on `file !== null` because the library also
   * holds seeded example rows that never had bytes behind them, and attaching
   * one would put a filename on the application with no document under it.
   */
  protected readonly formatDate = formatDate;

  protected readonly reusable = computed(() =>
    this.api.configured
      ? this.realDocuments()
      : this.documentLibrary.myDocuments().filter((d) => d.file !== null),
  );

  /**
   * Attach a document the citizen already uploaded.
   *
   * Real path: there is no "attach by reference" route — `POST /documents`
   * always creates a new row from fresh bytes — so reuse means fetching the
   * existing document's real content via its signed URL
   * (`GET /documents/{id}/content`, the same route the office's own download
   * link redeems) and re-uploading those bytes against this application.
   * This doubles server-side storage per reuse but needs no new backend
   * surface, and is what makes `uploadedDocumentIds` end up with a real id
   * for a reused document exactly the same way a fresh pick does.
   *
   * Demo path unchanged: the wizard wrote to the local library and never
   * once read it back, so every document a citizen had ever uploaded was
   * listed under My Documents and could never be used again.
   */
  protected async reuseExisting(
    d: RequirementDocument, item: DocumentHistoryEntry | SavedDocument | null, fileInput?: HTMLInputElement,
  ): Promise<void> {
    if (!item) return;
    // Reusing replaces whatever the native control last picked; clear it so the
    // row does not show one filename beside an attachment that is another.
    if (fileInput) fileInput.value = '';

    if (this.api.configured) {
      const real = item as DocumentHistoryEntry;
      this.uploadingRequirementId.set(d.id);
      try {
        const { url } = await firstValueFrom(this.api.getDocumentContent(real.id));
        const response = await fetch(url);
        if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
        const blob = await response.blob();
        const file = new File([blob], real.fileName, { type: blob.type || real.contentType });
        this.attached = {
          ...this.attached,
          [d.id]: { kind: 'upload', file, fileName: real.fileName, fileType: fileTypeFromName(real.fileName) },
        };
        this.uploadedDocumentIds.update(({ [d.id]: _drop, ...rest }) => rest);
        await this.uploadReal(d, file);
      } catch {
        this.error.set(`Could not reuse "${real.fileName}". Try again, or upload a new file.`);
      } finally {
        this.uploadingRequirementId.set(null);
      }
      return;
    }

    const saved = item as SavedDocument;
    if (!saved.file) return;
    this.attached = {
      ...this.attached,
      [d.id]: { kind: 'upload', file: saved.file, fileName: saved.fileName, fileType: saved.fileType },
    };
    this.uploadedDocumentIds.update(({ [d.id]: _drop, ...rest }) => rest);
  }

  removeAttachment(d: RequirementDocument, fileInput?: HTMLInputElement): void {
    const { [d.id]: _removed, ...rest } = this.attached;
    this.attached = rest;
    this.uploadedDocumentIds.update(({ [d.id]: _drop, ...ids }) => ids);
    // The native control remembers the last pick independently of our state;
    // clear it so the row does not keep naming a file that is no longer attached.
    if (fileInput) fileInput.value = '';
  }

  /**
   * Shows what's actually attached to this requirement, in-page.
   *
   * An 'upload' slot already holds the real File in memory (AttachedDoc's
   * own doc comment on why) — no network trip needed, straight into the
   * preview. A 'reused' slot is deliberately just a reference to a real
   * document on the server (ReusedDoc's own doc comment), so its bytes are
   * fetched fresh, the same fetch-then-blob: URL pattern
   * my-documents.page.ts's viewReal() uses and for the same reason: a
   * direct GET /documents/{id}/content response is ALWAYS
   * Content-Disposition: attachment (documents.controller.ts, backend
   * repo — a deliberate XSS guard), which navigating to it directly would
   * always download rather than show.
   */
  async previewAttached(d: RequirementDocument): Promise<void> {
    const slot = this.attached[d.id];
    if (!slot) return;

    if (slot.kind === 'upload') {
      this.preview.set({ file: slot.file, fileName: slot.fileName, fileType: slot.fileType, label: d.label });
      return;
    }

    // 'reused' and 'attached' both hold only a reference — the real bytes
    // are fetched fresh, same as my-documents.page.ts's viewReal().
    this.previewingId.set(d.id);
    try {
      const { url } = await firstValueFrom(this.api.getDocumentContent(slot.documentId));
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      this.preview.set({
        file: new File([blob], slot.fileName),
        fileName: slot.fileName,
        fileType: slot.fileType,
        label: d.label,
      });
    } catch {
      this.toast.error('Could not open this document. Try again.');
    } finally {
      this.previewingId.set(null);
    }
  }

  toStep(next: Step): void {
    if (next === 2 && !this.businessId) {
      this.error.set('Please select a business.');
      return;
    }
    // A Renewal or Amendment that names no permit is not a lesser application,
    // it is an unanswerable one: the office is told an existing permit is
    // involved and never told which. Blocked here AND refused by the store.
    if (
      next === 2
      && !actionReferenceIsComplete(this.applicationAction, this.relatedPermitNumber, this.priorPermitClaim)
    ) {
      this.error.set(
        this.needsExistingPermit() && this.matchingRenewablePermits().length === 0
          ? (this.isGeneric && !this.permitType
              ? 'Please select which permit type this is.'
              : `Please enter the permit number being ${this.applicationAction === 'Renewal' ? 'renewed' : 'amended'}.`)
          : `Please select the permit being ${this.applicationAction === 'Renewal' ? 'renewed' : 'amended'}.`,
      );
      return;
    }
    // Caught here rather than left for Step 4's blanket "required documents"
    // check — the upload sits right next to the claim field in Step 1 now,
    // so the citizen should hear about it before clicking through two more
    // steps to be told something they filled in three screens ago is missing.
    if (next === 2 && this.priorPermitClaim) {
      const proof = this.priorPermitProofRequirement();
      if (proof && !this.attached[proof.id]) {
        this.error.set('Please attach a photo or scan of the permit.');
        return;
      }
    }
    if (next === 3 && (!this.projectAddress || !this.scopeOfWork)) {
      this.error.set('Please complete the project address and scope of work.');
      return;
    }
    if (next === 4) {
      const missing = this.documents.filter((d) => this.isRequired(d) && !this.attached[d.id]);
      if (missing.length > 0) {
        this.error.set(`Please attach all required documents (${missing.length} missing).`);
        return;
      }
    }
    this.error.set(null);
    // Reuse is the DEFAULT state of a renewal or amendment, so the documents are
    // already carried over by the time the citizen reaches step 3 rather than
    // being something they have to ask for.
    if (next >= 3) this.carryOverDocuments();
    // Fire-and-forget, on navigation only — never on keystroke. By the time
    // `next` is 2 or more, Step 1's own checks above already established the
    // real minimum a Draft row needs (a business, and a complete reference
    // if this is a Renewal/Amendment), so there is always something worth
    // saving from here on.
    if (next >= 2) void this.autoSave();
    this.step.set(next);
  }

  /** What both autosave and the final filing send — the one place their shapes are kept from drifting apart. */
  private buildRequest(): Omit<SubmitApplicationRequest, 'documentIds' | 'saveAsDraft'> {
    return {
      permitType: this.isGeneric ? 'Business Permit' : this.permitType!,
      applicationAction: this.applicationAction,
      renewsPermitNumber: this.relatedPermitNumber,
      priorPermitClaim: this.priorPermitClaim,
      businessId: this.businessId,
      location: this.projectAddress || null,
      form: {
        scopeOfWork: this.scopeOfWork,
        professionalName: this.professionalName || null,
        prcNumber: this.prcNumber || null,
      },
    };
  }

  /** Document ids uploaded but not yet confirmed attached to the draft server-side — see attachedToServer's own comment. */
  private newlyUploadedIds(): string[] {
    return Object.values(this.uploadedDocumentIds()).filter((id) => !this.attachedToServer.has(id));
  }

  /**
   * Saves progress for real — the first call per application files a Draft
   * (`POST /applications` with `saveAsDraft: true`) and captures its id;
   * every call after that is a `PATCH` against that same id. Demo mode has
   * its own local, unrelated draft mechanism (`ApplicationStore.createDraft`)
   * and is untouched here.
   */
  private async autoSave(): Promise<void> {
    if (!this.api.configured) return;
    this.saveStatus.set('saving');
    const request = this.buildRequest();
    const newIds = this.newlyUploadedIds();
    const id = this.draftId();

    if (id === null) {
      const result = await this.applicationStore.fileReal({ ...request, saveAsDraft: true, documentIds: newIds });
      if (!result.ok) { this.saveStatus.set('error'); return; }
      this.draftId.set(result.id);
    } else {
      const result = await this.applicationStore.updateDraftReal(
        id, { ...request, ...(newIds.length > 0 ? { documentIds: newIds } : {}) },
      );
      if (!result.ok) { this.saveStatus.set('error'); return; }
    }
    for (const docId of newIds) this.attachedToServer.add(docId);
    this.saveStatus.set('saved');
  }

  /** The explicit "Save & Exit" button — the same save, just awaited and immediate rather than fired on step navigation. */
  protected async saveAndExit(): Promise<void> {
    await this.autoSave();
    this.router.navigate(['/applications']);
  }

  async submit(): Promise<void> {
    if (!this.understandRequirements || !this.agreeTerms) {
      this.error.set('Please check both declarations to continue.');
      return;
    }

    if (this.api.configured) {
      await this.submitReal();
      return;
    }

    const business = this.businesses.myBusinesses().find((b) => b.id === this.businessId)!;
    const record = this.applicationStore.createDraft({
      businessId: business.id,
      businessName: business.name,
      permitType: this.isGeneric ? 'Business Permit' : this.permitType!,
      applicationAction: this.applicationAction,
      relatedPermitNumber: this.relatedPermitNumber,
      priorPermitClaim: this.priorPermitClaim,
    });
    for (const d of this.documents) {
      const a = this.attached[d.id];
      if (!a) continue;
      if (a.kind === 'upload') {
        // Hands over the FILE. This one loop is the only place attachments
        // leave the wizard, so it is the single point a future upload has to
        // hook — the same reason the mobile fix went through the draft codecs
        // rather than editing nineteen wizards.
        this.applicationStore.attachDocument(
          record.id, d.id, d.label, a.file, a.fileType, a.supersedesDocumentId ?? null,
        );
      } else if (a.kind === 'reused') {
        // A reused document is a REFERENCE to one the office already holds. It
        // is flagged as reused and carries the date it was certified, because
        // the ruling leaves the judgement to the officer and that is the fact
        // they need in front of them.
        this.applicationStore.reuseDocument(record.id, d.id, d.label, a);
      }
      // 'attached' never occurs here: it is only ever produced by
      // resumeDraft(), which requires `api.configured` and so never runs
      // this demo-only path.
    }
    this.applicationStore.submit(record.id);
    // F-14: not "submitted successfully". Nothing was sent to the Municipality,
    // and this is the screen where believing otherwise costs the most — a citizen
    // could let construction proceed thinking a permit application is in progress.
    this.toast.success('Saved to this demo. NOT sent to the Municipality.');
    this.router.navigate(['/applications', record.id]);
  }

  /**
   * Files for real, against `POST /applications`.
   *
   * `businessId` goes out as `this.businessId` — a real server UUID.
   * Businesses ARE wired to the backend now (`BusinessStore.myBusinesses()`
   * reads from `GET /businesses` the moment a citizen is signed in against a
   * configured API), so the dropdown at step 1 already offers only real
   * businesses with real ids by the time this runs; sending it was refused
   * only back when that dropdown could still be showing local-demo ids. A
   * business linked at filing is how staff's own Businesses page ever
   * learns which applications belong to it — sending null here silently
   * broke that join for every real filing, even one made against a real,
   * just-registered business.
   *
   * `documentIds` carries exactly the requirements whose upload actually
   * completed (`uploadedDocumentIds` — real server ids, not merely
   * "attached in the UI"). A REUSED document (from a previous permit, or
   * from the library before this stage wired real upload) has no real id
   * and is never in that map, so it is correctly left out here too — the
   * toast below is what tells the citizen that plainly, by name, rather
   * than letting "Application filed" imply everything they saw attached
   * actually went.
   */
  private async submitReal(): Promise<void> {
    if (this.uploadingRequirementId() !== null) {
      this.error.set('Please wait for the current file to finish sending.');
      return;
    }
    this.submitting.set(true);
    try {
      const ids = this.uploadedDocumentIds();
      const request = this.buildRequest();
      const draftId = this.draftId();

      let applicationId: string;
      if (draftId !== null) {
        // The normal path: every step advance already autosaved this
        // application into existence as a Draft. One last sync catches
        // anything changed since (a document picked on this very step,
        // Review's own two checkboxes are declarations, not saved fields),
        // then the Draft is finalized through the transition engine —
        // `POST /applications` is not called again, which would file a
        // SECOND application.
        const newIds = this.newlyUploadedIds();
        const synced = await this.applicationStore.updateDraftReal(
          draftId, { ...request, ...(newIds.length > 0 ? { documentIds: newIds } : {}) },
        );
        if (!synced.ok) { this.error.set(synced.error); return; }
        const finalized = await this.applicationStore.submitDraftReal(draftId);
        if (!finalized.ok) { this.error.set(finalized.error); return; }
        applicationId = draftId;
      } else {
        // Autosave never landed (offline for a moment, or a transient
        // error) — fall back to filing directly, exactly as before this
        // feature existed, rather than blocking the citizen on a retry.
        const result = await this.applicationStore.fileReal({ ...request, documentIds: Object.values(ids) });
        if (!result.ok) { this.error.set(result.error); return; }
        applicationId = result.id;
      }

      const notSent = this.documents.filter((d) => this.attached[d.id] && !ids[d.id]).map((d) => d.label);
      this.toast.success(
        notSent.length > 0
          ? `Application filed. These documents were NOT sent — reuse-from-file isn’t connected yet: ${notSent.join(', ')}.`
          : 'Application filed, with your attached documents.',
      );
      this.router.navigate(['/applications', applicationId]);
    } finally {
      this.submitting.set(false);
    }
  }
}
