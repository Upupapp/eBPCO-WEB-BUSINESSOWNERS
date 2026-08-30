import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { LIFECYCLE_SEQUENCE, applicantStatusOf, isTerminalStatus } from '../../core/domain/status.model';
import { pesos } from '../../core/domain/assessment.model';
import { formatDate, formatDateTime } from '../../core/utils/ids';

@Component({
  selector: 'app-application-details',
  imports: [RouterLink, StatusPillComponent],
  template: `
    @if (app(); as a) {
      <div class="page">
        <div class="page-header">
          <div>
            <h1>{{ a.permitType }}</h1>
            <div class="subtitle">{{ a.applicationNumber }} · {{ a.businessName }} · {{ a.applicationAction }}</div>
          </div>
          <app-status-pill [label]="applicantStatusOf(a.lifecycleStatus)" />
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

          @if (!isTerminal(a.lifecycleStatus)) {
            <button class="btn btn-secondary btn-sm" (click)="advance(a.id)">Demo: Simulate Office Update</button>
            <span class="small muted" style="margin-left:8px;">No backend exists yet — this simulates the reviewing office advancing your application.</span>
          }
        </div>

        @if (permit(); as p) {
          <div class="card" style="background:var(--success-100); border:none;">
            <strong style="color:var(--success-text)">Your permit has been issued</strong>
            <table class="table" style="margin-top:8px;">
              <tbody>
                <tr><td class="muted">Permit Number</td><td><strong>{{ p.permitNumber }}</strong></td></tr>
                <tr><td class="muted">Issued</td><td>{{ formatDate(p.issuedDate) }}</td></tr>
                <tr><td class="muted">Expiry</td><td>{{ p.expiryDate ? formatDate(p.expiryDate) : 'No fixed expiry' }}</td></tr>
                <tr><td class="muted">Approving Office</td><td>{{ p.approvingOffice }}</td></tr>
              </tbody>
            </table>
            <div style="display:flex; gap:8px; align-items:center; margin-top:10px; flex-wrap:wrap;">
              <a class="btn btn-primary btn-sm" [routerLink]="['/applications', a.id, 'permit']">Preview Permit</a>
            </div>
          </div>
        }

        @if (assessment(); as asmt) {
          <div class="card">
            <div class="card-title">Assessment (Order of Payment)</div>
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
            @if (asmt.balanceCentavos > 0) {
              <a class="btn btn-primary btn-sm" style="margin-top:10px;" [routerLink]="['/payments', a.id]">Pay Now</a>
            }
          </div>
        }

        <div class="card">
          <div class="card-title">Documents</div>
          @if (docs().length === 0) {
            <p class="muted small">No documents attached.</p>
          } @else {
            <table class="table">
              <thead><tr><th>Document</th><th>Status</th><th>Uploaded</th></tr></thead>
              <tbody>
                @for (d of docs(); track d.id) {
                  <tr>
                    <td>{{ d.label }}</td>
                    <td><app-status-pill kind="document" [label]="d.status" /></td>
                    <td>{{ formatDate(d.uploadedAt) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="card">
          <div class="card-title">Status Timeline</div>
          @for (t of timeline(); track t.timestamp) {
            <div style="display:flex; gap:12px; padding:8px 0; border-bottom:1px solid var(--border-light);">
              <div style="width:120px;" class="small muted">{{ formatDateTime(t.timestamp) }}</div>
              <div style="font-weight:600;">{{ t.status }}</div>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="page">
        <div class="card empty-state">
          <p>We couldn't find that application. This can happen after a page refresh, since this demo build keeps data in memory only (no backend yet — see the project README).</p>
          <a routerLink="/applications" class="btn btn-primary">Back to My Applications</a>
        </div>
      </div>
    }
  `,
})
export class ApplicationDetailsPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(ApplicationStore);

  protected readonly applicantStatusOf = applicantStatusOf;
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

  assessment() {
    return this.store.assessmentFor(this.id());
  }

  permit() {
    return this.store.permitFor(this.id());
  }

  timeline() {
    return this.store.timelineFor(this.id());
  }

  isTerminal(status: Parameters<typeof isTerminalStatus>[0]): boolean {
    return isTerminalStatus(status);
  }

  progressPct(status: Parameters<typeof applicantStatusOf>[0]): number {
    const idx = LIFECYCLE_SEQUENCE.indexOf(status);
    if (idx < 0) return 100;
    return Math.round((idx / (LIFECYCLE_SEQUENCE.length - 1)) * 100);
  }

  advance(id: string): void {
    this.store.advanceForDemo(id);
  }
}
