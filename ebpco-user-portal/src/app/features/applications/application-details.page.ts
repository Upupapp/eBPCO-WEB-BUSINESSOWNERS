import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApplicationStore } from '../../core/stores/application.store';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { ApplicationLifecycleStatus, LIFECYCLE_SEQUENCE, applicantStatusLabel, applicantStatusOf, isTerminalStatus } from '../../core/domain/status.model';
import { pesos } from '../../core/domain/assessment.model';
import { formatDate, formatDateTime } from '../../core/utils/ids';
import { ToastService } from '../../shared/ui/toast.service';
import { ApplicationDocumentsComponent } from './application-documents.component';
import { PermitReleaseComponent } from './permit-release.component';
import { DocumentPreviewComponent } from '../../shared/ui/document-preview.component';
import { SavedDocumentFileType } from '../../core/domain/document.model';
import { PermitRelease } from '../../core/api/citizen-api.models';
import { DocumentResubmissionService, toBase64 } from '../../core/api/document-resubmission.service';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { RequirementDocument } from '../../core/domain/requirements-catalog';
import { toContractShape } from './demo-document.adapter';
import { ApplicationDocumentResponse, InstructionLetter, TimelineEntryResponse } from '../../core/api/citizen-api.models';
import { duplicateOf } from '../../core/api/problem';

/** Same extension-sniffing fallback as my-documents.page.ts / application-wizard.page.ts. */
function fileTypeFromName(name: string): SavedDocumentFileType {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'pdf') return ext as SavedDocumentFileType;
  return 'pdf';
}

/** Everything `app-document-preview` actually reads — not the full `ApplicationDocument` shape, which a real, backend-fetched document has no local checklist/history for. */
interface PreviewableDocument {
  file: File | null;
  fileName: string;
  fileType: SavedDocumentFileType;
  label: string;
}

@Component({
  selector: 'app-application-details',
  imports: [RouterLink, StatusPillComponent, ApplicationDocumentsComponent, PermitReleaseComponent, DocumentPreviewComponent],
  template: `
    @if (app(); as a) {
      <div class="page">
        <div class="page-header">
          <div>
            <h1>{{ a.permitType }}</h1>
            <div class="subtitle">{{ a.applicationNumber }} · {{ a.businessName }} · {{ a.applicationAction }}</div>
            @if (a.relatedPermitNumber) {
              <div class="small muted">
                {{ a.applicationAction === 'Renewal' ? 'Renewing' : 'Amending' }} permit
                <strong>{{ a.relatedPermitNumber }}</strong>
              </div>
            }
          </div>
          <app-status-pill [label]="applicantStatusLabel(a.lifecycleStatus)" />
        </div>

        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong>Progress</strong>
            <span class="small muted">{{ progressPct(a.lifecycleStatus) }}%</span>
          </div>
          <div style="height:8px; background:var(--gray-100); border-radius:99px; overflow:hidden; margin-bottom:12px;">
            <div style="height:100%; background:var(--primary-500);" [style.width.%]="progressPct(a.lifecycleStatus)"></div>
          </div>
          <p class="small" style="color:var(--gray-700);">{{ store.nextStepText(a.lifecycleStatus) }}</p>

          @if (!isTerminal(a.lifecycleStatus) && !store.isReal(a.id)) {
            <button class="btn btn-secondary btn-sm" (click)="advance(a.id)">Demo: Simulate Office Update</button>
            <span class="small muted" style="margin-left:8px;">No backend exists yet — this simulates the reviewing office advancing your application.</span>
          }
          @if (a.lifecycleStatus === 'Revision Required' && api.configured) {
            <div role="region" aria-label="Send back to the office"
                 style="margin-top:12px; padding:12px 14px; border-radius:10px; border:1px solid var(--gray-200);"
                 [style.background]="returnedNotReplaced().length === 0 ? 'var(--success-100)' : 'var(--warning-100)'">
              @if (letters().length > 0) {
                <strong>What the office needs from you</strong>
                @for (letter of letters(); track letter.letterId) {
                  @for (item of letter.items; track item.id) {
                    <div style="padding:6px 0 8px; border-bottom:1px solid var(--gray-200);">
                      <p style="margin:4px 0 0; white-space:pre-line;">{{ item.remark }}</p>
                      <div class="small muted" style="margin-top:4px;">Sent {{ formatDateTime(letter.issuedAt) }}</div>
                    </div>
                  }
                }
              }
              @if (returnedNotReplaced().length === 0) {
                <strong style="display:block; margin-top:8px;">Ready to send back</strong>
                <p class="small">
                  When you have made the changes the office asked for (replace or add documents below), send the
                  application back so the office can continue evaluating it.
                </p>
              } @else {
                <strong style="display:block; margin-top:8px;">The office returned this application</strong>
                <p class="small">
                  Replace {{ returnedNotReplaced().length === 1 ? 'the returned document' : 'the ' + returnedNotReplaced().length + ' returned documents' }}
                  below ({{ returnedNotReplacedNames() }}), then send the application back to the office.
                </p>
              }
              <button class="btn btn-primary btn-sm" [disabled]="sendingBack() || returnedNotReplaced().length > 0" (click)="sendBack(a.id)">
                {{ sendingBack() ? 'Sending…' : 'Send Back to the Office' }}
              </button>
            </div>
          }
          @if (canCancel(a)) {
            <div style="margin-top:10px;">
              @if (!confirmingCancel()) {
                <button class="btn btn-danger btn-sm" (click)="confirmingCancel.set(true)">Withdraw Application</button>
                <span class="small muted" style="margin-left:8px;">
                  Available while your application waits to be received, or while it is returned to you for changes.
                </span>
              } @else {
                <div style="border:1px solid var(--danger-200, #f5c2c7); background:var(--danger-50, #fff5f5); border-radius:8px; padding:10px 12px;">
                  <strong class="small">Withdraw {{ a.applicationNumber }}?</strong>
                  <p class="small muted" style="margin:4px 0 8px;">
                    The Municipality stops processing it and this cannot be undone. You would need to file a new application.
                  </p>
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn btn-danger btn-sm" [disabled]="cancelling()" (click)="cancel(a.id)">
                      {{ cancelling() ? 'Withdrawing…' : 'Yes, withdraw it' }}
                    </button>
                    <button class="btn btn-secondary btn-sm" [disabled]="cancelling()" (click)="confirmingCancel.set(false)">Keep my application</button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        @if (permit(); as p) {
          <div class="card" style="background:var(--success-100); border:none;">
            <strong style="color:var(--success-text)">Your permit has been issued</strong>
            <table class="table" style="margin-top:8px;">
              <tbody>
                <tr><td class="muted">Permit Number</td><td><strong>{{ p.permitNumber }}</strong></td></tr>
                <tr><td class="muted">Issued</td><td>{{ formatDate(p.issuedDate) }}</td></tr>
                <tr><td class="muted">Valid Until</td><td>{{ p.expiryDate ? formatDate(p.expiryDate) : 'Not recorded by the office' }}</td></tr>
                <tr><td class="muted">Approving Office</td><td>{{ p.approvingOffice ?? 'Not on file' }}</td></tr>
              </tbody>
            </table>
            <div style="display:flex; gap:8px; align-items:center; margin-top:10px; flex-wrap:wrap;">
              <a class="btn btn-primary btn-sm" [routerLink]="['/applications', a.id, 'permit']">Preview Permit</a>
            </div>
          </div>
        }

        @if (fees(); as asmt) {
          <div class="card">
            <div class="card-title">Assessment (Order of Payment){{ asmt.opsNumber ? ' · ' + asmt.opsNumber : '' }}</div>
            <table class="table">
              <thead><tr><th>Fee</th><th>Amount</th></tr></thead>
              <tbody>
                @for (line of asmt.lineItems; track line.code) {
                  <tr><td>{{ line.name }}</td><td>{{ line.amountCentavos !== null ? pesos(line.amountCentavos) : 'Pending' }}</td></tr>
                }
              </tbody>
            </table>
            <hr class="divider" />
            <div style="display:flex; justify-content:space-between;"><strong>Total</strong><strong>{{ pesos(asmt.totalCentavos) }}</strong></div>
            <div style="display:flex; justify-content:space-between;" class="small muted"><span>Balance</span><span>{{ pesos(asmt.balanceCentavos) }}</span></div>
            @if (asmt.canPay) {
              <a class="btn btn-primary btn-sm" style="margin-top:10px;" [routerLink]="['/payments', a.id]">Pay Now</a>
            } @else if (asmt.pendingVerification) {
              <p class="small muted" style="margin-top:10px;">Your payment is waiting for the Cashier to verify it.</p>
            }
          </div>
        }

        <app-permit-release
          [permitNumber]="permit()?.permitNumber ?? null"
          [issuedDate]="permit() ? formatDate(permit()!.issuedDate) : null"
          [release]="release()"
        />

        @if (missingRequired().length > 0) {
          <div class="card" style="border:1px solid var(--danger-200, #f5c2c7); background:var(--danger-50, #fff5f5);">
            <div class="card-title">{{ a.lifecycleStatus === 'Revision Required' ? 'Add a Document' : 'Missing Required Documents' }}</div>
            <p class="small muted" style="margin-top:-4px;">
              {{ a.lifecycleStatus === 'Revision Required'
                ? 'Documents not yet on this application. Add any the office asked for.'
                : 'The Municipality still needs these to continue reviewing your application.' }}
            </p>
            <ul style="list-style:none; padding:0; margin:0;">
              @for (req of missingRequired(); track req.id) {
                <li style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid var(--border-light);">
                  <span>{{ req.label }}@if (!req.required) { <span class="small muted"> (optional)</span> }</span>
                  <span>
                    <input
                      type="file"
                      [attr.id]="'missing-doc-' + req.id"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style="display:none;"
                      [disabled]="uploadingMissingId() === req.id"
                      (change)="attachMissing(req, $event)"
                    />
                    <label
                      [attr.for]="'missing-doc-' + req.id"
                      class="btn btn-primary btn-sm"
                      style="cursor:pointer;"
                    >
                      {{ uploadingMissingId() === req.id ? 'Sending…' : 'Choose File' }}
                    </label>
                  </span>
                </li>
              }
            </ul>
          </div>
        }

        <div class="card">
          <div class="card-title">Documents</div>
          <app-application-documents
            [documents]="contractDocs()"
            (replace)="onReplace($event)"
            (preview)="onPreview($event)"
          />
          @if (previewing(); as p) {
            <app-document-preview
              [file]="p.file"
              [fileName]="p.fileName"
              [fileType]="p.fileType"
              [label]="p.label"
              [seeded]="p.file === null"
              (close)="previewing.set(null)"
            />
          }
        
        </div>

        <div class="card">
          <div class="card-title">Status Timeline</div>
          @for (t of timelineEntries(); track t.timestamp) {
            <div style="display:flex; gap:12px; padding:8px 0; border-bottom:1px solid var(--border-light);">
              <div style="width:120px;" class="small muted">{{ formatDateTime(t.timestamp) }}</div>
              <div>
                <div style="font-weight:600;">{{ t.status }}</div>
                @if (t.remarks) {
                  <div class="small muted" style="margin-top:2px;">{{ t.remarks }}</div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="page">
        <div class="card empty-state">
          <p>We couldn't find that application. It may not belong to your account, or the link may be out of date.</p>
          <a routerLink="/applications" class="btn btn-primary">Back to My Applications</a>
        </div>
      </div>
    }
  `,
})
export class ApplicationDetailsPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(ApplicationStore);
  private readonly toast = inject(ToastService);
  private readonly resubmission = inject(DocumentResubmissionService);
  protected readonly api = inject(CitizenApiClient);

  protected readonly applicantStatusOf = applicantStatusOf;
  protected readonly applicantStatusLabel = applicantStatusLabel;
  protected readonly formatDate = formatDate;
  protected readonly formatDateTime = formatDateTime;
  protected readonly pesos = pesos;

  private id(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  app() {
    return this.store.applicationById(this.id());
  }

  docs() {
    return this.store.documentsFor(this.id());
  }

  /**
   * Real documents, from `GET /applications/{id}/documents` — already built
   * (`CitizenApiClient.listDocuments`) since before this connection work
   * began, just never called from here. `null` means "not fetched" (or the
   * id belongs to a local demo application, which 404s harmlessly against
   * the real backend and is left to fall back to `docs()`); `contractDocs()`
   * below prefers this the moment it is non-null, the same "real once
   * fetched" pattern `ApplicationStore.myApplications` uses.
   */
  private readonly realDocuments = signal<ApplicationDocumentResponse[] | null>(null);

  /**
   * Real history, from `GET /applications/{id}/timeline` — same "fetch once,
   * prefer if present" shape as `realDocuments` above. Added alongside the
   * `advanceForDemo` gating fix: before this, a real application's Status
   * Timeline silently showed nothing (the page only ever read the local demo
   * `timelineByApp` map), which was mistakeable for "the office hasn't acted
   * yet" rather than "this view was never wired to the real endpoint."
   */
  private readonly realTimeline = signal<TimelineEntryResponse[] | null>(null);

  /**
   * Documents the office returned (Revision Required or Rejected) that no
   * newer upload replaces yet — the same test the server's
   * `returned-documents-replaced` precondition applies before it lets the
   * application go back.
   */
  protected returnedNotReplaced(): ApplicationDocumentResponse[] {
    return (this.realDocuments() ?? []).filter((d) =>
      (d.reviewStatus === 'Revision Required' || d.reviewStatus === 'Rejected') && d.supersededByDocumentId === null);
  }
  protected returnedNotReplacedNames(): string {
    return this.returnedNotReplaced().map((d) => d.label).join(', ');
  }

  protected readonly sendingBack = signal(false);

  async sendBack(id: string): Promise<void> {
    this.sendingBack.set(true);
    try {
      const result = await this.store.sendBackReal(id);
      if (!result.ok) {
        this.toast.error(result.error);
        return;
      }
      this.refreshTimeline();
      this.refreshDocuments();
      this.refreshLetters();
      this.toast.success('Sent back to the office for evaluation.');
    } finally {
      this.sendingBack.set(false);
    }
  }

  /** Re-fetches the document list after a write that changes it (a replacement, a send-back). */
  private refreshDocuments(): void {
    this.api.listDocuments(this.id()).subscribe({
      next: (docs) => this.realDocuments.set(docs),
      error: () => {},
    });
  }

  constructor() {
    if (this.api.configured) {
      this.api.listDocuments(this.id()).subscribe({
        next: (docs) => this.realDocuments.set(docs),
        // A local demo application id 404s against the real backend — expected,
        // not an error worth surfacing. Leaves realDocuments null, so
        // contractDocs() falls back to the local demo data below.
        error: () => {},
      });
      this.refreshTimeline();
      this.store.fetchPermit(this.id());
      this.refreshLetters();
    }
    // Side-effecting on purpose (writes the store's real-checklist cache) —
    // must live in an effect(), never inside `missingRequired` itself,
    // which is a computed() and has to stay pure. Skips 'Business Permit'
    // the same way `missingRequired` already does below.
    effect(() => {
      const permitType = this.app()?.permitType;
      if (permitType && permitType !== 'Business Permit') {
        this.store.ensureRequiredDocumentsLoaded(permitType);
      }
    });
  }

  /**
   * The office's reason for returning the application, from its open Letter
   * of Instruction (the Return for Revision remark). Shown in the Send Back
   * card; sending back answers it.
   */
  protected readonly letters = signal<InstructionLetter[]>([]);
  protected readonly confirmingCancel = signal(false);

  private refreshLetters(): void {
    if (!this.api.configured) return;
    this.api.getInstructions(this.id()).subscribe({
      next: (letters) => this.letters.set(letters),
      error: () => {},
    });
  }

  /**
   * The fee card, from the real Order of Payment (`GET /applications`'s
   * `payment.orderOfPayment`). It used to read only the local demo store, so
   * a real application said "Please view your assessment" with nothing to
   * view (found live 2026-09-27). Falls back to the demo store for a demo id.
   */
  protected fees(): {
    lineItems: { code: string; name: string; amountCentavos: number | null }[];
    totalCentavos: number; balanceCentavos: number; opsNumber: string | null;
    canPay: boolean; pendingVerification: boolean;
  } | null {
    const a = this.app();
    const real = this.store.orderOfPaymentFor(this.id());
    if (a && real) {
      const paid = a.paymentStatus === 'Paid';
      return {
        lineItems: [
          { code: 'filing', name: 'Filing Fee', amountCentavos: real.fees.filing },
          { code: 'processing', name: 'Processing Fee', amountCentavos: real.fees.processing },
          { code: 'architectural', name: 'Architectural Fee', amountCentavos: real.fees.architectural },
          { code: 'structural', name: 'Structural Fee', amountCentavos: real.fees.structural },
          { code: 'electrical', name: 'Electrical Fee', amountCentavos: real.fees.electrical },
          { code: 'others', name: 'Other Fees', amountCentavos: real.fees.others },
        ],
        totalCentavos: real.totalCentavos,
        balanceCentavos: paid ? 0 : real.totalCentavos,
        opsNumber: real.number,
        canPay: a.paymentStatus === 'Not Yet Available' || a.paymentStatus === 'Overdue',
        pendingVerification: a.paymentStatus === 'Pending Verification',
      };
    }
    const demo = this.assessment();
    if (!demo) return null;
    return {
      lineItems: demo.lineItems, totalCentavos: demo.totalCentavos, balanceCentavos: demo.balanceCentavos,
      opsNumber: demo.opsNumber, canPay: demo.balanceCentavos > 0, pendingVerification: false,
    };
  }

  /** Re-fetches `realTimeline` after a real write on this application (e.g. `cancel()`) — otherwise the Status Timeline kept showing its pre-write history until the next full page reload. */
  private refreshTimeline(): void {
    this.api.getTimeline(this.id()).subscribe({
      next: (entries) => this.realTimeline.set(entries),
      error: () => {},
    });
  }

  /** The real `release` once fetched; the local-demo construction otherwise. See `ApplicationStore.releaseFor`. */
  protected release(): PermitRelease | null {
    return this.store.releaseFor(this.id());
  }

  /** The office's shape, so the documents view is written once against what the server sends. */
  protected contractDocs(): ApplicationDocumentResponse[] {
    const real = this.realDocuments();
    if (real !== null) return real;
    return this.docs().map(toContractShape);
  }

  /**
   * Replace a rejected document.
   *
   * The size is checked BEFORE the file is read, so a citizen with a 5MB scan
   * is told immediately rather than after their phone has encoded it. The
   * idempotency key is owned by the service: stable if they retry the same
   * file, new if they pick a different one — the server treats the file as part
   * of the key's fingerprint and 409s a mismatch.
   */
  /** DOC-003. The document currently open for inspection, or null. */
  protected readonly previewing = signal<PreviewableDocument | null>(null);

  /**
   * Resolve the contract shape back to the file this build kept.
   *
   * The server's document response describes a document; it does not contain
   * one. `contractDocs()` prefers `realDocuments()` the moment it is fetched,
   * so once that has loaded, every id "Preview" is clicked with belongs to
   * the real backend, not the local demo store — looking it up in `docs()`
   * (as this used to, unconditionally) always missed, because a
   * server-generated UUID never matches a seeded demo id, and silently did
   * nothing. Fetches the real signed URL the same way
   * `application-wizard.page.ts`'s `reuseExisting()` already does, and falls
   * back to the local demo lookup only when nothing real was ever fetched.
   */
  protected async onPreview(doc: ApplicationDocumentResponse): Promise<void> {
    if (this.realDocuments() === null) {
      const local = this.docs().find((d) => d.id === doc.id);
      this.previewing.set(local ? { file: local.file, fileName: local.fileName, fileType: local.fileType, label: local.label } : null);
      return;
    }
    try {
      const { url } = await firstValueFrom(this.api.getDocumentContent(doc.id));
      const response = await fetch(url);
      if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], doc.fileName, { type: blob.type || doc.contentType });
      this.previewing.set({ file, fileName: doc.fileName, fileType: fileTypeFromName(doc.fileName), label: doc.label });
    } catch {
      this.toast.error(`Could not open "${doc.label}". Try again.`);
    }
  }

  /**
   * Required documents this application's own real document list has no
   * match for, by label rather than id — `requiredDocumentsFor` now prefers
   * the real, live checklist (`GET /requirements/{permitType}`, warmed by
   * the `effect()` in the constructor above) the moment it loads, but a
   * citizen's already-uploaded document was matched against whatever id
   * scheme was live at UPLOAD time, which may have been the static
   * fallback. Label is the one thing both id schemes originate from the
   * same source for, so it's still what actually matches an upload here,
   * same as before this fetch existed.
   *
   * A document that exists but was Rejected/Revision Required is NOT
   * missing — it already has its own "Replace this document" action above.
   * This only covers a requirement nothing has ever been sent for.
   */
  protected readonly missingRequired = computed<RequirementDocument[]>(() => {
    const a = this.app();
    // 'Business Permit' is a PublishedPermitType with no requirements-catalog
    // entry of its own (see permit.model.ts) — the same reason the wizard's
    // own carry-over logic (application-wizard.page.ts) guards against it
    // before ever calling `requiredDocumentsFor`.
    if (!a || a.permitType === 'Business Permit') return [];
    // While the office has the application returned, optional documents are
    // offered too: "add the lot owner's written consent" is an optional
    // requirement the office can still ask for (found live 2026-09-27).
    const revising = a.lifecycleStatus === 'Revision Required';
    const wanted = this.store.requiredDocumentsFor(a.permitType).filter((d) => d.required || revising);
    const haveLabels = new Set(this.contractDocs().map((d) => d.label));
    return wanted.filter((d) => !haveLabels.has(d.label));
  });

  protected readonly uploadingMissingId = signal<string | null>(null);

  /**
   * First-time attach for a requirement nothing has been sent for yet —
   * `POST /documents` with THIS application's real id, now that the
   * backend actually checks the applicant owns it (see
   * `DocumentsController.upload`'s own ownership check). `requirementCode`
   * is `req.id` only once the store's real checklist has actually loaded
   * for this permit type — sending the static fallback's id as one is a
   * real, honest server refusal (see `ApplicationStore.hasRealRequiredDocuments`).
   */
  protected async attachMissing(req: RequirementDocument, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (this.resubmission.tooLarge(file)) {
      this.toast.error(this.resubmission.explain(new Error('')) || 'That file is too large.');
      input.value = '';
      return;
    }
    this.uploadingMissingId.set(req.id);
    try {
      const contentBase64 = await toBase64(file);
      const permitType = this.app()?.permitType;
      const requirementCode =
        permitType && permitType !== 'Business Permit' && this.store.hasRealRequiredDocuments(permitType)
          ? req.id
          : null;
      const send = (reuseOf: string | null): void => {
        this.api.uploadDocument({
          fileName: file.name, label: req.label, applicationId: this.id(), requirementCode, contentBase64, reuseOf,
        }).subscribe({
          next: () => {
            this.toast.success(`"${req.label}" sent.`);
            this.api.listDocuments(this.id()).subscribe({
              next: (docs) => this.realDocuments.set(docs),
              error: () => {},
            });
          },
          error: (e) => {
            // A file they already have in My Documents: send their copy
            // instead of storing the same file a second time.
            const existing = duplicateOf(e);
            if (existing !== null && reuseOf === null) {
              this.toast.show(`You already had "${existing.fileName}" in My Documents, so that copy was used.`);
              send(existing.id);
              return;
            }
            this.toast.error(this.resubmission.explain(e));
            this.uploadingMissingId.set(null);
          },
          complete: () => this.uploadingMissingId.set(null),
        });
      };
      send(null);
    } catch {
      this.toast.error(`Could not send "${req.label}". Try again.`);
      this.uploadingMissingId.set(null);
    } finally {
      input.value = '';
    }
  }

  protected onReplace(doc: ApplicationDocumentResponse): void {
    if (!this.api.configured) {
      this.toast.show(
        `Replacing "${doc.label}" is not available in this build — the Municipality's system is not connected yet.`,
      );
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (this.resubmission.tooLarge(file)) {
        this.toast.error(this.resubmission.explain(new Error('')) || 'That file is too large.');
        return;
      }
      this.resubmission.resubmit(this.id(), doc.id, doc.label, file).subscribe({
        next: (result) => {
          // Metadata stripped from the file is reported, never silently
          // dropped: a site photograph carries its coordinates and the
          // applicant is entitled to know the LGU removed them.
          const stripped = result.removedMetadata.length
            ? ` ${result.removedMetadata.join(', ')} was removed from the file.`
            : '';
          this.toast.success(`Replacement sent for "${doc.label}".${stripped}`);
          // Without this the list kept showing the returned file as current
          // until a reload, so "Send Back to the Office" stayed disabled.
          this.refreshDocuments();
        },
        error: (e) => this.toast.error(this.resubmission.explain(e)),
      });
    };
    input.click();
  }


  assessment() {
    return this.store.assessmentFor(this.id());
  }

  permit() {
    return this.store.permitFor(this.id());
  }

  timeline() {
    return this.store.timelineFor(this.id());
  }

  /** Real timeline once fetched (mapped to the template's shape); local demo timeline otherwise. */
  protected timelineEntries(): { status: string; timestamp: string; remarks: string | null }[] {
    const real = this.realTimeline();
    if (real !== null) return real.map((t) => ({ status: t.status, timestamp: t.occurredAt, remarks: t.remarks }));
    return this.timeline();
  }

  isTerminal(status: Parameters<typeof isTerminalStatus>[0]): boolean {
    return isTerminalStatus(status);
  }

  progressPct(status: Parameters<typeof applicantStatusOf>[0]): number {
    // Revision Required is not on the forward path, so indexOf missed and the
    // bar read 100% while the application was waiting on the citizen.
    const idx = LIFECYCLE_SEQUENCE.indexOf(status === 'Revision Required' ? 'Document Verification' : status);
    if (idx < 0) return 100;
    return Math.round((idx / (LIFECYCLE_SEQUENCE.length - 1)) * 100);
  }

  advance(id: string): void {
    this.store.advanceForDemo(id);
    const updated = this.store.applicationById(id);
    if (updated) this.toast.success(`Status updated: ${applicantStatusOf(updated.lifecycleStatus)}.`);
  }

  /**
   * The real lifecycle table (`lifecycle.ts`) only ever grants the
   * APPLICANT actor a `-> Cancelled` transition from four statuses: Draft,
   * Submitted, Received, and Revision Required. `Document Verification` and
   * `Under Evaluation` both precede an Order of Payment too (so the old
   * `assessedAmountCentavos === null` check alone let the button show for
   * them) but have no applicant-cancel transition at all — the server
   * refuses with a 409 every time, previously with nothing but a toast the
   * citizen could easily miss to explain why. Listing the real four
   * statuses here — instead of inferring eligibility from unrelated fields
   * — means the button simply isn't offered where it could never work.
   */
  private static readonly APPLICANT_CANCELLABLE_STATUSES: ReadonlySet<ApplicationLifecycleStatus> = new Set([
    'Draft',
    'Submitted',
    'Received',
    'Revision Required',
  ]);

  protected canCancel(a: { assessedAmountCentavos: number | null; lifecycleStatus: ApplicationLifecycleStatus }): boolean {
    return (
      this.api.configured &&
      a.assessedAmountCentavos === null &&
      ApplicationDetailsPage.APPLICANT_CANCELLABLE_STATUSES.has(a.lifecycleStatus)
    );
  }

  protected readonly cancelling = signal(false);

  async cancel(id: string): Promise<void> {
    this.cancelling.set(true);
    try {
      const result = await this.store.cancelReal(id);
      if (!result.ok) {
        this.toast.error(result.error);
        return;
      }
      this.refreshTimeline();
      this.confirmingCancel.set(false);
      this.toast.success('Application withdrawn.');
    } finally {
      this.cancelling.set(false);
    }
  }
}
