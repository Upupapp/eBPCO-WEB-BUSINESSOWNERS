import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { DEFAULT_BANK_INFO, PaymentMethod } from '../../core/domain/payment.model';
import { MUNICIPAL_ENGINEER, MUNICIPAL_HALL_ADDRESS } from '../../core/domain/lgu-contact';
import { pesos } from '../../core/domain/assessment.model';
import { ToastService } from '../../shared/ui/toast.service';

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
                  <label for="payment-flow-proof-of-payment-1">Proof of Payment*</label>
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
              <button class="btn btn-primary btn-block" style="margin-top:14px;" (click)="submit(a.id)">
                {{ method() === 'Bank Transfer' ? 'Submit Payment' : 'Mark as Paid' }}
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

  protected readonly bank = DEFAULT_BANK_INFO;
  protected readonly engineer = MUNICIPAL_ENGINEER;
  protected readonly hallAddress = MUNICIPAL_HALL_ADDRESS;
  protected readonly pesos = pesos;
  readonly method = signal<PaymentMethod>('Bank Transfer');
  readonly error = signal<string | null>(null);
  proofFileName: string | null = null;

  private id(): string {
    return this.route.snapshot.paramMap.get('applicationId')!;
  }

  app() {
    return this.store.applicationById(this.id());
  }

  assessment() {
    return this.store.assessmentFor(this.id());
  }

  onProofSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.proofFileName = input.files?.[0]?.name ?? null;
  }

  submit(applicationId: string): void {
    if (this.method() === 'Bank Transfer' && !this.proofFileName) {
      this.error.set('Please attach your proof of payment.');
      return;
    }
    const reference = this.method() === 'Bank Transfer' ? this.proofFileName! : `ONSITE-${Date.now()}`;
    this.store.submitPayment(applicationId, this.method(), reference);
    // F-14: nobody will verify this. No payment record leaves the browser.
    this.toast.success('Recorded in this demo. No payment was sent or received.');
    this.router.navigate(['/applications', applicationId]);
  }
}
