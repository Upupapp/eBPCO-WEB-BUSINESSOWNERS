import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { DEFAULT_BANK_INFO, PaymentMethod } from '../../core/domain/payment.model';
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
              <div class="card" style="background:var(--secondary-50);">
                <div class="small"><strong>Bank:</strong> {{ bank.bankName }}</div>
                <div class="small"><strong>Account Name:</strong> {{ bank.accountName }}</div>
                <div class="small"><strong>Account Number:</strong> {{ bank.accountNumber }}</div>
                <div class="small"><strong>Branch:</strong> {{ bank.branch }}</div>
              </div>
              <div class="field" style="margin-top:12px;">
                <label>Proof of Payment*</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="onProofSelected($event)" />
              </div>
            } @else {
              <div class="card" style="background:var(--secondary-50);">
                <p class="small" style="margin:0;">Pay directly at the Building Permit and Certificate of Occupancy Office counter. Bring a copy of your Order of Payment.</p>
              </div>
            }

            @if (error()) { <div class="field error" style="margin-top:10px;">{{ error() }}</div> }
            <button class="btn btn-primary btn-block" style="margin-top:14px;" (click)="submit(a.id)">
              {{ method() === 'Bank Transfer' ? 'Submit Payment' : 'Mark as Paid' }}
            </button>
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
    this.toast.success('Payment submitted. It is now awaiting verification.');
    this.router.navigate(['/applications', applicationId]);
  }
}
