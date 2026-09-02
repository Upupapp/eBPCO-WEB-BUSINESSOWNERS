import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApplicationAction, PermitType, isValidPermitType } from '../../core/domain/permit.model';
import { RequirementDocument } from '../../core/domain/requirements-catalog';
import { SavedDocumentFileType } from '../../core/domain/document.model';
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
              <div style="margin-top:8px; display:flex; gap:8px; align-items:center;">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="onFileSelected($event, d)" />
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

  removeAttachment(d: RequirementDocument): void {
    const { [d.id]: _removed, ...rest } = this.attached;
    this.attached = rest;
  }

  toStep(next: Step): void {
    if (next === 2 && !this.businessId) {
      this.error.set('Please select a business.');
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
