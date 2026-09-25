import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { DEFAULT_BANK_INFO, PaymentMethod } from '../../core/domain/payment.model';
import { MUNICIPAL_ENGINEER, MUNICIPAL_HALL_ADDRESS } from '../../core/domain/lgu-contact';
import { pesos } from '../../core/domain/assessment.model';
import { ToastService } from '../../shared/ui/toast.service';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { UploadLimitsService } from '../../core/api/upload-limits.service';
import { toBase64 } from '../../core/api/document-resubmission.service';
import { ApiError } from '../../core/api/problem';

@Component({
  selector: 'app-payment-flow',
  imports: [FormsModule, RouterLink],
  template: `
    @if (app(); as a) {
      <div class="page" style="max-width:560px;">
        <div class="page-header">
          <div>
            <h1>Pay Assessment</h1>
            <div class="subtitle">{{ a.applicationNumber }} · {{ a.permitType }}</div>
          </div>
        </div>

        @if (assessment(); as asmt) {
          <div class="card">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span class="muted">Total Assessment</span><strong>{{ pesos(asmt.totalCentavos) }}</strong></div>
            <div style="display:flex; justify-content:space-between;"><span class="muted">Balance Due</span><strong style="color:var(--danger-text)">{{ pesos(asmt.balanceCentavos) }}</strong></div>
          </div>

          <div class="card">
            <div class="card-title">Payment Method</div>
            <div style="display:flex; gap:10px; margin-bottom:14px;">
              <button class="btn btn-sm" [class.btn-primary]="method() === 'Bank Transfer'" [class.btn-secondary]="method() !== 'Bank Transfer'" (click)="method.set('Bank Transfer')">Bank Transfer</button>
              <button class="btn btn-sm" [class.btn-primary]="method() === 'Onsite'" [class.btn-secondary]="method() !== 'Onsite'" (click)="method.set('Onsite')">Onsite Payment</button>
            </div>

            @if (method() === 'Bank Transfer') {
              @if (bank; as b) {
                <div class="card" style="background:var(--secondary-50);">
                  <div class="small"><strong>Bank:</strong> {{ b.bankName }}</div>
                  <div class="small"><strong>Account Name:</strong> {{ b.accountName }}</div>
                  <div class="small"><strong>Account Number:</strong> {{ b.accountNumber }}</div>
                  <div class="small"><strong>Branch:</strong> {{ b.branch }}</div>
                </div>
                <div class="field" style="margin-top:12px;">
                  <label for="payment-flow-proof-of-payment-1">Proof of Payment<span class="required">*</span></label>
                  <input id="payment-flow-proof-of-payment-1" type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="onProofSelected($event)" />
                </div>
              } @else {
                <!--
                  F-4: never render a placeholder account number here. See
                  DEFAULT_BANK_INFO — this screen asks a user to move real money,
                  so "not yet available" is the only safe empty state.
                -->
                <div class="card" style="background:var(--warning-100, #fff4e5); border:1px solid var(--warning-text, #a15c00);">
                  <div class="card-title" style="margin-bottom:6px;">Bank transfer is not available yet</div>
                  <p class="small" style="margin:0 0 8px;">
                    The Municipality of Castilla has not published a deposit account for permit fees,
                    so this portal has no account details to show you.
                    <strong>Do not transfer permit fees to any account you have not confirmed with the
                    Municipality directly.</strong>
                  </p>
                  <p class="small" style="margin:0;">
                    Use <strong>Onsite Payment</strong> instead, or confirm the current payment
                    arrangements with the {{ engineer.name }} — {{ engineer.mobile }} or
                    <a [href]="'mailto:' + engineer.email">{{ engineer.email }}</a>.
                  </p>
                </div>
              }
            } @else {
              <div class="card" style="background:var(--secondary-50);">
                <p class="small" style="margin:0;">Pay directly at the {{ engineer.name }}, {{ hallAddress }}. Bring a copy of your Order of Payment.</p>
              </div>
            }

            @if (error()) { <div class="field error" style="margin-top:10px;">{{ error() }}</div> }
            @if (method() !== 'Bank Transfer' || bank) {
              <button class="btn btn-primary btn-block" style="margin-top:14px;" [disabled]="submitting()" (click)="submit(a.id)">
                {{ submitting() ? 'Sending…' : (method() === 'Bank Transfer' ? 'Submit Payment' : 'Mark as Paid') }}
              </button>
            }
          </div>
        } @else {
          <div class="card empty-state">No assessment has been issued yet for this application.</div>
        }
      </div>
    } @else {
      <div class="page" style="max-width:560px;">
        <div class="card empty-state">
          <p>We couldn't find that application. This can happen after a page refresh, since this demo build keeps data in memory only (no backend yet — see the project README).</p>
          <a routerLink="/payments" class="btn btn-primary">Back to Payments</a>
        </div>
      </div>
    }
  `,
})
export class PaymentFlowPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(ApplicationStore);
  private readonly toast = inject(ToastService);
  private readonly api = inject(CitizenApiClient);
  private readonly uploadLimits = inject(UploadLimitsService);

  protected readonly bank = DEFAULT_BANK_INFO;
  protected readonly engineer = MUNICIPAL_ENGINEER;
  protected readonly hallAddress = MUNICIPAL_HALL_ADDRESS;
  protected readonly pesos = pesos;
  readonly method = signal<PaymentMethod>('Bank Transfer');
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);
  proofFileName: string | null = null;
  private proofFile: File | null = null;

  /**
   * The real Order of Payment, from `GET /applications/{id}` — `payment
   * .orderOfPayment` (see `ApplicationSummary`). `realChecked` is a separate
   * flag rather than folding "not fetched" into the value itself: `null`
   * has to keep meaning "confirmed — no Order of Payment issued yet" (a
   * real, common state, not an error), which is different from "the
   * request just hasn't come back yet."
   */
  private readonly realChecked = signal(false);
  private readonly realOrderOfPayment = signal<{ totalCentavos: number } | null>(null);

  constructor() {
    if (this.api.configured) {
      this.api.getApplication(this.id()).subscribe({
        next: (summary) => {
          this.realOrderOfPayment.set(summary.payment.orderOfPayment ?? null);
          this.realChecked.set(true);
        },
        // A local demo application id 404s against the real backend —
        // expected, not an error. Leaves realChecked false, so assessment()
        // falls back to the local demo data below.
        error: () => {},
      });
    }
  }

  private id(): string {
    return this.route.snapshot.paramMap.get('applicationId')!;
  }

  app() {
    return this.store.applicationById(this.id());
  }

  /**
   * `{ totalCentavos, balanceCentavos }` only — the two fields this screen
   * actually renders. Real applications have no "partially paid" state
   * server-side (payment.status only reaches Pending Verification or Paid,
   * never a partial balance), so balance === total until this screen's own
   * submission changes that.
   */
  assessment(): { totalCentavos: number; balanceCentavos: number } | undefined {
    if (this.api.configured) {
      if (!this.realChecked()) return undefined;
      const real = this.realOrderOfPayment();
      return real ? { totalCentavos: real.totalCentavos, balanceCentavos: real.totalCentavos } : undefined;
    }
    const a = this.store.assessmentFor(this.id());
    return a ? { totalCentavos: a.totalCentavos, balanceCentavos: a.balanceCentavos } : undefined;
  }

  onProofSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.proofFile = file;
    this.proofFileName = file?.name ?? null;
  }

  async submit(applicationId: string): Promise<void> {
    if (this.method() === 'Bank Transfer' && !this.proofFileName) {
      this.error.set('Please attach your proof of payment.');
      return;
    }

    if (this.api.configured && this.realOrderOfPayment()) {
      await this.submitReal(applicationId);
      return;
    }

    const reference = this.method() === 'Bank Transfer' ? this.proofFileName! : `ONSITE-${Date.now()}`;
    this.store.submitPayment(applicationId, this.method(), reference);
    // F-14: nobody will verify this. No payment record leaves the browser.
    this.toast.success('Recorded in this demo. No payment was sent or received.');
    this.router.navigate(['/applications', applicationId]);
  }

  /**
   * Submits for real, against `POST /applications/{id}/payments`.
   *
   * `amountCentavos` is the real Order of Payment's own `totalCentavos` —
   * never derived from anything the citizen typed, since inventing the
   * amount to pay is the one mistake this screen cannot afford. A bank-
   * transfer proof is uploaded for real first (same `POST /documents` path
   * as the application wizard's attachments — Stage 6), and its real id is
   * what travels as `proofDocumentId`; Onsite carries none, matching the
   * existing UI (no file picker shown for that method). `applicationId` goes
   * on the upload itself too — omitted until 2026-09-25, which meant a
   * verifying officer had no way to actually see the proof they were asked
   * to verify: it never appeared as one of the application's own documents
   * anywhere in the Admin Portal, only its bare id sat on the payment row.
   */
  private async submitReal(applicationId: string): Promise<void> {
    const real = this.realOrderOfPayment()!;
    this.submitting.set(true);
    try {
      let proofDocumentId: string | null = null;
      if (this.method() === 'Bank Transfer' && this.proofFile) {
        if (this.proofFile.size > this.uploadLimits.maxFileBytes()) {
          this.error.set(
            `"${this.proofFile.name}" is ${Math.round(this.proofFile.size / 1000)} KB. The Municipality's system ` +
            `accepts up to about ${Math.round(this.uploadLimits.maxFileBytes() / 1000)} KB.`,
          );
          return;
        }
        try {
          const contentBase64 = await toBase64(this.proofFile);
          const uploaded = await firstValueFrom(
            this.api.uploadDocument({
              fileName: this.proofFile.name, label: 'Proof of Payment', contentBase64, applicationId,
            }),
          );
          proofDocumentId = uploaded.documentId;
        } catch (error) {
          this.error.set(
            error instanceof ApiError
              ? error.citizenMessage
              : 'Your proof of payment could not be sent to the Municipality. Please try again.',
          );
          return;
        }
      }

      const reference = this.method() === 'Bank Transfer' ? this.proofFile!.name : `ONSITE-${Date.now()}`;
      const result = await this.store.submitPaymentReal(applicationId, {
        referenceNumber: reference,
        method: this.method(),
        paidOn: new Date().toISOString().slice(0, 10),
        amountCentavos: real.totalCentavos,
        proofDocumentId,
      });
      if (!result.ok) {
        this.error.set(result.error);
        return;
      }
      this.toast.success(
        result.settles
          ? 'Payment submitted to the Municipality — this settles your balance, pending verification.'
          : 'Payment submitted to the Municipality, pending verification.',
      );
      this.router.navigate(['/applications', applicationId]);
    } finally {
      this.submitting.set(false);
    }
  }
}
