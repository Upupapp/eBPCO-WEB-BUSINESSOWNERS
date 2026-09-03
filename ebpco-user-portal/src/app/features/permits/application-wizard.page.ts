import { Component, computed, inject, signal } from '@angular/core';
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
 * document checklist from requirements-catalog.ts and adapts — same
 * document/feature coverage, far less duplicated code to maintain.
 */
@Component({
  selector: 'app-application-wizard',
  imports: [FormsModule, RouterLink],
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
            <label for="application-wizard-business-1">Business*</label>
            <select id="application-wizard-business-1" class="input" [(ngModel)]="businessId">
              <option [ngValue]="null" disabled>Select a business</option>
              @for (b of businesses.myBusinesses(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
            </select>
            @if (businesses.myBusinesses().length === 0) {
              <div class="hint">No businesses yet — <a routerLink="/businesses/register">register one first</a>.</div>
            }
          </div>
          <div class="field">
            <label for="application-wizard-application-type-2">Application Type*</label>
            <select id="application-wizard-application-type-2" class="input" [(ngModel)]="applicationAction">
              <option value="New">New Permit</option>
              <option value="Renewal">Renewal</option>
              <option value="Amendment">Amendment</option>
            </select>
          </div>
          @if (needsExistingPermit()) {
            <div class="field">
              <label for="application-wizard-related-permit">{{ existingPermitPrompt(applicationAction) }}*</label>
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
          <div class="field"><label for="application-wizard-project-business-address-3">Project / Business Address*</label><input id="application-wizard-project-business-address-3" class="input" [(ngModel)]="projectAddress" placeholder="Street, Barangay, City" /></div>
          <div class="field"><label for="application-wizard-scope-of-work-4">Scope of Work / Purpose*</label><textarea id="application-wizard-scope-of-work-4" class="input" rows="3" [(ngModel)]="scopeOfWork" placeholder="Briefly describe the work or purpose of this application"></textarea></div>
          <div class="form-row">
            <div class="field"><label for="application-wizard-professional-in-charge-5">Professional in Charge (if any)</label><input id="application-wizard-professional-in-charge-5" class="input" [(ngModel)]="professionalName" placeholder="Engineer / Architect name" /></div>
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
            <div
              class="card"
              style="background:var(--warning-100); border:1px solid var(--warning-text); color:var(--warning-text); margin-bottom:12px;"
            >
              <strong>You are being asked for the full document list.</strong>
              The Municipality has not published a shorter list for
              {{ applicationAction === 'Renewal' ? 'renewals' : 'amendments' }}, so this portal asks
              for everything a new application needs rather than guessing what it can leave out.
              Anything you have uploaded before can be reused below without uploading it again.
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
                @if (attached[d.id]) {
                  <span class="badge badge-green">{{ attached[d.id].fileName }}</span>
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
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  [attr.aria-label]="'Attach ' + d.label"
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
            <button class="btn btn-secondary" (click)="step.set(3)">Back</button>
            <button class="btn btn-primary" (click)="submit()">Submit Application</button>
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

  readonly step = signal<Step>(1);
  readonly error = signal<string | null>(null);

  isGeneric = true;
  permitType: PermitType | null = null;
  documents: RequirementDocument[] = [];

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
  attached: Record<string, AttachedDoc> = {};
  understandRequirements = false;
  agreeTerms = false;

  constructor() {
    const typeParam = this.route.snapshot.queryParamMap.get('type');
    const businessParam = this.route.snapshot.queryParamMap.get('businessId');
    if (businessParam) this.businessId = businessParam;
    if (typeParam && typeParam !== 'generic' && isValidPermitType(typeParam)) {
      this.isGeneric = false;
      this.permitType = typeParam;
      this.documents = this.applicationStore.requiredDocumentsFor(typeParam);
    } else {
      this.isGeneric = true;
      this.documents = this.applicationStore.requiredDocumentsFor('generic');
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

  onFileSelected(event: Event, d: RequirementDocument): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.attached = { ...this.attached, [d.id]: { file, fileName: file.name, fileType: fileTypeFromName(file.name) } };
    this.documentLibrary.add({ file, fileName: file.name, fileType: fileTypeFromName(file.name), category: 'supportingDocument', sizeBytes: file.size });
  }

  /**
   * Documents already on file that can actually be reused.
   *
   * Filtered on `file !== null`, and that filter is the point. The library also
   * holds seeded example rows that never had bytes behind them, and attaching
   * one would put a filename on the application with no document under it —
   * recreating precisely the defect that cost the mobile app its entire
   * document history. A name in the list is not a document.
   */
  protected readonly formatDate = formatDate;

  protected readonly reusable = computed(() =>
    this.documentLibrary.myDocuments().filter((d) => d.file !== null),
  );

  /**
   * Attach a document the citizen already uploaded.
   *
   * The wizard wrote to the document library and never once read it back, so
   * every document a citizen had ever uploaded was listed under My Documents
   * and could never be used again. A renewal made that plain: the same
   * twenty-two files, uploaded a second time, all already on file.
   */
  protected reuseExisting(d: RequirementDocument, saved: SavedDocument | null): void {
    if (!saved?.file) return;
    this.attached = {
      ...this.attached,
      [d.id]: { file: saved.file, fileName: saved.fileName, fileType: saved.fileType },
    };
  }

  removeAttachment(d: RequirementDocument): void {
    const { [d.id]: _removed, ...rest } = this.attached;
    this.attached = rest;
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
    this.step.set(next);
  }

  submit(): void {
    if (!this.understandRequirements || !this.agreeTerms) {
      this.error.set('Please check both declarations to continue.');
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
      // Hands over the FILE. This one loop is the only place attachments leave
      // the wizard, so it is the single point a future upload has to hook —
      // the same reason the mobile fix went through the draft codecs rather
      // than editing nineteen wizards.
      if (a) this.applicationStore.attachDocument(record.id, d.id, d.label, a.file, a.fileType);
    }
    this.applicationStore.submit(record.id);
    // F-14: not "submitted successfully". Nothing was sent to the Municipality,
    // and this is the screen where believing otherwise costs the most — a citizen
    // could let construction proceed thinking a permit application is in progress.
    this.toast.success('Saved to this demo. NOT sent to the Municipality.');
    this.router.navigate(['/applications', record.id]);
  }
}
