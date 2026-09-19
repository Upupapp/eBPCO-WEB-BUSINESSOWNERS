import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApplicationAction, PermitType, isValidPermitType } from '../../core/domain/permit.model';
import { RequirementDocument } from '../../core/domain/requirements-catalog';
import {
  actionNeedsExistingPermit,
  actionReferenceIsComplete,
  existingPermitPrompt,
} from '../../core/domain/application.model';
import { SavedDocument, SavedDocumentFileType } from '../../core/domain/document.model';
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

type Slot =
  | ({ kind: 'upload'; supersedesDocumentId?: string | null } & AttachedDoc)
  | ({ kind: 'reused' } & ReusedDoc);

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
  imports: [FormsModule, RouterLink, CapitalizeNameDirective],
  template: `
    <div class="page" style="max-width:760px;">
      <div class="page-header">
        <div>
          <h1>{{ isGeneric ? 'New Business Permit Application' : permitType }}</h1>
          <div class="subtitle">{{ isGeneric ? 'Generic application flow' : reviewingOffice() }}</div>
        </div>
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
            <select id="application-wizard-application-type-2" class="input" [(ngModel)]="applicationAction">
              <option value="New">New Permit</option>
              <option value="Renewal">Renewal</option>
              <option value="Amendment">Amendment</option>
            </select>
          </div>
          @if (needsExistingPermit()) {
            <div class="field">
              <label for="application-wizard-related-permit">{{ existingPermitPrompt(applicationAction) }}<span class="required">*</span></label>
              @if (renewablePermits().length > 0) {
                <select id="application-wizard-related-permit" class="input" [(ngModel)]="relatedPermitNumber">
                  <option [ngValue]="null" disabled>Select a permit</option>
                  @for (p of renewablePermits(); track p.permitNumber) {
                    <option [value]="p.permitNumber">
                      {{ p.permitNumber }} — {{ p.permitType }}{{ p.businessName ? ' · ' + p.businessName : '' }}
                    </option>
                  }
                </select>
                <div class="hint">
                  The office needs to know which permit this application acts on. Only permits already
                  issued to you are listed.
                </div>
              } @else {
                <div class="hint">
                  You have no issued permits yet, so there is nothing to
                  {{ applicationAction === 'Renewal' ? 'renew' : 'amend' }}. Choose
                  <strong>New Permit</strong> above to apply for one.
                </div>
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
                  <span class="badge" [class]="d.required ? 'badge-req' : 'badge-opt'" style="margin-right:6px;">{{ d.required ? 'Required' : 'Optional' }}</span>
                  <strong>{{ d.label }}</strong>
                  @if (d.description) { <div class="small muted">{{ d.description }}</div> }
                </div>
                @if (uploadingRequirementId() === d.id) {
                  <span class="badge">Sending…</span>
                } @else if (attached[d.id]; as slot) {
                  <span class="badge badge-green">{{ slot.fileName }}</span>
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
                  }
                }
                <input
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
                    (ngModelChange)="reuseExisting(d, $event)"
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
                  <button class="btn btn-ghost btn-sm" (click)="removeAttachment(d)">Remove</button>
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
              <tr><td class="muted">Documents Attached</td><td>{{ attachedCount() }} of {{ documents.length }}</td></tr>
            </tbody>
          </table>
          <hr class="divider" />
          <label class="checkbox-row" style="margin-bottom:8px;">
            <input type="checkbox" [(ngModel)]="understandRequirements" /> I understand the application requirements and certify the information provided is true and correct.
          </label>
          <label class="checkbox-row" style="margin-bottom:14px;">
            <input type="checkbox" [(ngModel)]="agreeTerms" /> I agree to the Terms &amp; Conditions.
          </label>
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" [disabled]="submitting()" (click)="step.set(3)">Back</button>
            <button class="btn btn-primary" [disabled]="submitting() || uploadingRequirementId() !== null" (click)="submit()">
              {{ submitting() ? 'Submitting…' : 'Submit Application' }}
            </button>
          </div>
        </div>
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

  protected readonly realDocuments = signal<DocumentHistoryEntry[]>([]);

  readonly step = signal<Step>(1);
  readonly error = signal<string | null>(null);

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

  protected readonly existingPermitPrompt = existingPermitPrompt;
  protected readonly actionReferenceIsComplete = actionReferenceIsComplete;
  protected readonly renewablePermits = computed(() => this.applicationStore.renewablePermits());
  protected needsExistingPermit(): boolean {
    return actionNeedsExistingPermit(this.applicationAction);
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
    const typeParam = this.route.snapshot.queryParamMap.get('type');
    const businessParam = this.route.snapshot.queryParamMap.get('businessId');
    if (businessParam) this.businessId = businessParam;
    if (typeParam && typeParam !== 'generic' && isValidPermitType(typeParam)) {
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
    d: RequirementDocument, item: DocumentHistoryEntry | SavedDocument | null,
  ): Promise<void> {
    if (!item) return;

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

  removeAttachment(d: RequirementDocument): void {
    const { [d.id]: _removed, ...rest } = this.attached;
    this.attached = rest;
    this.uploadedDocumentIds.update(({ [d.id]: _drop, ...ids }) => ids);
  }

  toStep(next: Step): void {
    if (next === 2 && !this.businessId) {
      this.error.set('Please select a business.');
      return;
    }
    // A Renewal or Amendment that names no permit is not a lesser application,
    // it is an unanswerable one: the office is told an existing permit is
    // involved and never told which. Blocked here AND refused by the store.
    if (next === 2 && !actionReferenceIsComplete(this.applicationAction, this.relatedPermitNumber)) {
      this.error.set(
        this.renewablePermits().length === 0
          ? `You have no issued permits to ${this.applicationAction === 'Renewal' ? 'renew' : 'amend'}. Choose "New Permit" to apply for one.`
          : `Please select the permit being ${this.applicationAction === 'Renewal' ? 'renewed' : 'amended'}.`,
      );
      return;
    }
    if (next === 3 && (!this.projectAddress || !this.scopeOfWork)) {
      this.error.set('Please complete the project address and scope of work.');
      return;
    }
    if (next === 4) {
      const missing = this.documents.filter((d) => d.required && !this.attached[d.id]);
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
    this.step.set(next);
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
      } else {
        // A reused document is a REFERENCE to one the office already holds. It
        // is flagged as reused and carries the date it was certified, because
        // the ruling leaves the judgement to the officer and that is the fact
        // they need in front of them.
        this.applicationStore.reuseDocument(record.id, d.id, d.label, a);
      }
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
      const result = await this.applicationStore.fileReal({
        permitType: this.isGeneric ? 'Business Permit' : this.permitType!,
        applicationAction: this.applicationAction,
        renewsPermitNumber: this.relatedPermitNumber,
        businessId: this.businessId,
        location: this.projectAddress,
        documentIds: Object.values(ids),
        form: {
          scopeOfWork: this.scopeOfWork,
          professionalName: this.professionalName || null,
          prcNumber: this.prcNumber || null,
        },
      });
      if (!result.ok) {
        this.error.set(result.error);
        return;
      }
      const notSent = this.documents.filter((d) => this.attached[d.id] && !ids[d.id]).map((d) => d.label);
      this.toast.success(
        notSent.length > 0
          ? `Application filed. These documents were NOT sent — reuse-from-file isn’t connected yet: ${notSent.join(', ')}.`
          : 'Application filed, with your attached documents.',
      );
      this.router.navigate(['/applications', result.id]);
    } finally {
      this.submitting.set(false);
    }
  }
}
