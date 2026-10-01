import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApplicationStore } from '../../core/stores/application.store';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { PaymentHistoryEntry } from '../../core/api/citizen-api.models';
import { pesos } from '../../core/domain/assessment.model';
import { PaymentStatus } from '../../core/domain/status.model';
import { formatDate } from '../../core/utils/ids';

type Tone = 'green' | 'amber' | 'red' | 'gray';

/** Where an Order of Payment stands. Each order is in exactly one, so the filter counts add up to All. */
export type OrderState = 'awaiting' | 'rejected' | 'verifying' | 'paid';

interface PaymentRow {
  applicationId: string;
  applicationNumber: string;
  permitType: string;
  totalCentavos: number;
  state: OrderState;
  /**
   * The server's status, except an issued-but-unpaid Order reads "Awaiting
   * Payment", and one whose last payment the cashier turned back reads
   * "Payment Rejected" (the history says why).
   */
  label: PaymentStatus | 'Awaiting Payment' | 'Payment Rejected';
  tone: Tone;
  canPay: boolean;
  orderNumber: string | null;
  issuedOn: string | null;
  dueOn: string | null;
}

/** One payment the citizen sent, as the history shows it. */
export interface PaymentAttemptView {
  label: 'Paid' | 'Pending Verification' | 'Rejected' | 'Voided' | 'Reversed' | 'Refunded' | 'Overdue';
  tone: Tone;
  /** The line under it: the receipt, or why it did not count. */
  detail: string;
}

/**
 * What one submitted payment came to, in the citizen's words. The server
 * keeps no "Rejected" status: a rejection resets the row to 'Not Yet
 * Available' and sets `rejectionReason`, so that is what marks one.
 */
export function paymentAttemptView(p: PaymentHistoryEntry): PaymentAttemptView {
  if (p.rejectionReason !== null) {
    return { label: 'Rejected', tone: 'red', detail: p.rejectionReason };
  }
  switch (p.status) {
    case 'Paid':
      return {
        label: 'Paid', tone: 'green',
        detail: [
          p.officialReceiptNumber ? `Official Receipt No. ${p.officialReceiptNumber}` : null,
          p.verifiedAt ? `confirmed ${formatDate(p.verifiedAt)}` : null,
        ].filter((part): part is string => part !== null).join(' · ') || 'Confirmed by the Treasurer’s Office.',
      };
    case 'Voided':
    case 'Reversed':
    case 'Refunded':
      return { label: p.status, tone: 'gray', detail: p.exceptionReason ?? '' };
    case 'Overdue':
      return { label: 'Overdue', tone: 'red', detail: 'The Order of Payment is past its due date.' };
    default:
      return {
        label: 'Pending Verification', tone: 'amber',
        detail: 'The Municipal Treasurer’s Office is checking this payment. Nothing more is needed from you.',
      };
  }
}

interface HistoryRow {
  entry: PaymentHistoryEntry;
  view: PaymentAttemptView;
  applicationId: string;
  applicationNumber: string;
  permitType: string;
}

type OrderFilter = 'all' | OrderState;
type HistoryFilter = 'all' | 'Paid' | 'Pending Verification' | 'Rejected' | 'Other';

const ORDER_FILTERS: ReadonlyArray<{ id: OrderFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'awaiting', label: 'Awaiting payment' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'verifying', label: 'Pending verification' },
  { id: 'paid', label: 'Paid' },
];

const HISTORY_FILTERS: ReadonlyArray<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'Paid', label: 'Paid' },
  { id: 'Pending Verification', label: 'Pending verification' },
  { id: 'Rejected', label: 'Rejected' },
  { id: 'Other', label: 'Voided or refunded' },
];

/**
 * Real data, unlike the demo store this page used to read (`assessmentFor`/
 * `paymentsFor`, populated only by local seed data — a real payment
 * submission never appeared here at all). `ApplicationStore.myApplications()`
 * is already real once the backend is configured, and `paymentStatus`/
 * `assessedAmountCentavos` on each row are ALREADY faithful to the server —
 * see `fromServerSummary()`'s own doc comment in `application.store.ts`.
 *
 * Redesigned 2026-10-01: totals at the top; the Orders of Payment as cards,
 * each with its last payment; and a Payment history tab, every payment sent
 * newest first (`GET /applications/{id}/payments` for each application with
 * an Order) — paid ones with their Official Receipt, ones still being
 * checked, and rejected ones with the cashier's reason. Both lists filter by
 * status, with counts, and search by reference, receipt or permit.
 */
@Component({
  selector: 'app-payments-list',
  imports: [RouterLink, FormsModule],
  styles: [`
    .pay-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 22px; }
    .pay-tile {
      position: relative; overflow: hidden; padding: 18px 20px;
      border: 1px solid var(--border-light); border-radius: var(--radius-lg); background: var(--surface);
      box-shadow: var(--shadow-sm);
    }
    .pay-tile-label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--gray-600); }
    .pay-tile-icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; }
    .pay-tile-amount { margin-top: 10px; font-size: 24px; font-weight: 700; letter-spacing: -.01em; color: var(--gray-900); font-variant-numeric: tabular-nums; }
    .pay-tile-note { margin-top: 2px; font-size: 12.5px; color: var(--gray-500); }
    .pay-tile--due { border-color: var(--primary-100); background: linear-gradient(135deg, #fff 55%, var(--primary-50)); }
    .pay-tile--due .pay-tile-icon { background: var(--primary-100); color: var(--primary-600); }
    .pay-tile--due .pay-tile-amount { color: var(--primary-600); }
    .pay-tile--verifying .pay-tile-icon { background: var(--warning-100); color: var(--warning-text); }
    .pay-tile--paid .pay-tile-icon { background: var(--success-100); color: var(--success-text); }

    .pay-tabs { display: flex; gap: 4px; padding: 4px; margin-bottom: 14px; width: fit-content; max-width: 100%;
      border-radius: 12px; background: var(--gray-100); }
    .pay-tab { all: unset; cursor: pointer; padding: 8px 16px; border-radius: 9px; font-size: 14px; font-weight: 600; color: var(--gray-600); white-space: nowrap; }
    .pay-tab:hover { color: var(--gray-900); }
    .pay-tab:focus-visible { outline: 2px solid var(--primary-500); outline-offset: 1px; }
    .pay-tab[aria-selected="true"] { background: var(--surface); color: var(--gray-900); box-shadow: 0 1px 3px rgba(20, 20, 40, .12); }
    .pay-tab-count { margin-left: 6px; font-weight: 500; color: var(--gray-500); }

    .pay-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
    .pay-chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .pay-chip {
      all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 12px; border-radius: 99px; border: 1px solid var(--border-medium); background: var(--surface);
      font-size: 13px; font-weight: 600; color: var(--gray-700);
    }
    .pay-chip:hover { border-color: var(--gray-300); }
    .pay-chip:focus-visible { outline: 2px solid var(--primary-500); outline-offset: 1px; }
    .pay-chip[aria-pressed="true"] { background: var(--primary-500); border-color: var(--primary-500); color: #fff; }
    .pay-chip-count { min-width: 18px; padding: 0 6px; border-radius: 99px; font-size: 11.5px; text-align: center; background: var(--gray-100); color: var(--gray-600); }
    .pay-chip[aria-pressed="true"] .pay-chip-count { background: rgba(255, 255, 255, .22); color: #fff; }
    .pay-search { position: relative; flex: 0 1 280px; min-width: 200px; }
    .pay-search svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--gray-400); pointer-events: none; }
    .pay-search input { width: 100%; box-sizing: border-box; padding-left: 34px; }

    .orders { display: flex; flex-direction: column; gap: 12px; }
    .order {
      display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 16px; align-items: start;
      padding: 18px 20px; border: 1px solid var(--border-light); border-radius: var(--radius-lg); background: var(--surface);
      box-shadow: var(--shadow-sm);
    }
    .order--rejected { border-color: #f6c9cd; }
    .order-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--primary-50); color: var(--primary-600); }
    .order-main { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .order-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .order-title strong { font-size: 16px; color: var(--gray-900); }
    .order-meta { font-size: 13px; color: var(--gray-500); }
    .order-last { margin-top: 6px; display: flex; gap: 8px; align-items: flex-start; font-size: 13px; color: var(--gray-700);
      padding: 8px 10px; border-radius: var(--radius-md); background: var(--gray-50); }
    .order-last--red { background: var(--danger-100); color: var(--danger-text); }
    .order-last--green { background: var(--success-100); color: var(--success-text); }
    .order-side { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
    .order-amount { font-size: 20px; font-weight: 700; color: var(--gray-900); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .order-actions { display: flex; gap: 8px; }

    .history { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border-light); border-radius: var(--radius-lg);
      background: var(--surface); box-shadow: var(--shadow-sm); overflow: hidden; }
    .history-day { padding: 10px 20px; font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
      color: var(--gray-500); background: var(--gray-50); border-bottom: 1px solid var(--border-light); }
    .history-item { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; gap: 14px; align-items: start; padding: 16px 20px; }
    .history-item + .history-item, .history-item + .history-day, .history-day + .history-item { border-top: 1px solid var(--border-light); }
    .history-day + .history-item { border-top: 0; }
    .history-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; }
    .history-icon--green { background: var(--success-100); color: var(--success-text); }
    .history-icon--amber { background: var(--warning-100); color: var(--warning-text); }
    .history-icon--red { background: var(--danger-100); color: var(--danger-text); }
    .history-icon--gray { background: var(--gray-100); color: var(--gray-600); }
    .history-body { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .history-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .history-title strong { color: var(--gray-900); }
    .history-meta { font-size: 13px; color: var(--gray-500); }
    .history-detail { font-size: 13px; color: var(--gray-700); }
    .history-detail--red { color: var(--danger-text); }
    .history-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .history-amount { font-weight: 700; color: var(--gray-900); font-variant-numeric: tabular-nums; white-space: nowrap; }

    .pay-empty { padding: 34px 20px; text-align: center; color: var(--gray-500); border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); }
    .pay-empty button { all: unset; cursor: pointer; color: var(--primary-600); font-weight: 600; }

    @media (max-width: 760px) {
      /* Three small totals side by side, and chips that scroll sideways instead of wrapping into rows. */
      .pay-summary { gap: 8px; margin-bottom: 16px; }
      .pay-tile { padding: 12px; }
      .pay-tile-label { font-size: 12px; }
      .pay-tile-icon { display: none; }
      .pay-tile-amount { margin-top: 4px; font-size: 16px; }
      .pay-tile-note { display: none; }
      .pay-toolbar { flex-direction: column; align-items: stretch; }
      .pay-chips { flex-wrap: nowrap; overflow-x: auto; margin: 0 -16px; padding: 2px 16px; scrollbar-width: none; }
      .pay-chips::-webkit-scrollbar { display: none; }
      .pay-chip { flex: none; }
      .order { grid-template-columns: 40px minmax(0, 1fr); }
      .order-side { grid-column: 1 / -1; flex-direction: row; align-items: center; justify-content: space-between; }
      .history-item { grid-template-columns: 32px minmax(0, 1fr); padding: 14px 16px; }
      .history-side { grid-column: 2; flex-direction: row; align-items: center; justify-content: space-between; }
      .pay-search { flex: none; width: 100%; min-width: 0; }
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Payments</h1>
          <div class="subtitle">What you owe, what is being checked, and every payment you have sent.</div>
        </div>
      </div>

      @if (rows().length === 0) {
        <div class="card empty-state">No assessments issued yet. Once your application is evaluated, its Order of Payment will appear here.</div>
      } @else {
        <div class="pay-summary">
          <div class="pay-tile pay-tile--due">
            <div class="pay-tile-label">
              <span class="pay-tile-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></svg>
              </span>
              To pay
            </div>
            <div class="pay-tile-amount">{{ pesos(totalOf(stateRows('awaiting', 'rejected'))) }}</div>
            <div class="pay-tile-note">{{ countLabel(stateRows('awaiting', 'rejected').length, 'Order of Payment', 'Orders of Payment') }} waiting for payment</div>
          </div>
          <div class="pay-tile pay-tile--verifying">
            <div class="pay-tile-label">
              <span class="pay-tile-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </span>
              Pending verification
            </div>
            <div class="pay-tile-amount">{{ pesos(totalOf(stateRows('verifying'))) }}</div>
            <div class="pay-tile-note">{{ countLabel(stateRows('verifying').length, 'payment') }} with the Treasurer’s Office</div>
          </div>
          <div class="pay-tile pay-tile--paid">
            <div class="pay-tile-label">
              <span class="pay-tile-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
              Paid
            </div>
            <div class="pay-tile-amount">{{ pesos(totalOf(stateRows('paid'))) }}</div>
            <div class="pay-tile-note">{{ countLabel(stateRows('paid').length, 'Order of Payment', 'Orders of Payment') }} settled</div>
          </div>
        </div>

        <div class="pay-tabs" role="tablist" aria-label="Payments">
          <button class="pay-tab" role="tab" [attr.aria-selected]="tab() === 'orders'" (click)="tab.set('orders')">
            Orders of Payment<span class="pay-tab-count">{{ rows().length }}</span>
          </button>
          @if (api.configured) {
            <button class="pay-tab" role="tab" [attr.aria-selected]="tab() === 'history'" (click)="tab.set('history')">
              Payment history@if (history(); as items) {<span class="pay-tab-count">{{ items.length }}</span>}
            </button>
          }
        </div>

        <div class="pay-toolbar">
          <div class="pay-chips" role="group" aria-label="Filter by status">
            @if (tab() === 'orders') {
              @for (f of orderFilters; track f.id) {
                <button class="pay-chip" [attr.aria-pressed]="orderFilter() === f.id" (click)="orderFilter.set(f.id)">
                  {{ f.label }}<span class="pay-chip-count">{{ orderCount(f.id) }}</span>
                </button>
              }
            } @else {
              @for (f of historyFilters; track f.id) {
                @if (f.id !== 'Other' || historyCount('Other') > 0) {
                  <button class="pay-chip" [attr.aria-pressed]="historyFilter() === f.id" (click)="historyFilter.set(f.id)">
                    {{ f.label }}<span class="pay-chip-count">{{ historyCount(f.id) }}</span>
                  </button>
                }
              }
            }
          </div>
          <label class="pay-search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input class="input" type="search" [ngModel]="search()" (ngModelChange)="search.set($event)"
                   placeholder="Search reference, receipt or permit" aria-label="Search payments" />
          </label>
        </div>

        @if (tab() === 'orders') {
          @if (visibleRows().length === 0) {
            <div class="pay-empty">No Orders of Payment match. <button type="button" (click)="clearFilters()">Show all</button></div>
          } @else {
            <div class="orders">
              @for (row of visibleRows(); track row.applicationId) {
                <article class="order" [class.order--rejected]="row.state === 'rejected'">
                  <div class="order-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" stroke-linecap="round" /></svg>
                  </div>
                  <div class="order-main">
                    <div class="order-title">
                      <strong>{{ row.permitType }}</strong>
                      <span class="badge" [class]="'badge-' + row.tone">{{ row.label }}</span>
                    </div>
                    <div class="order-meta">
                      {{ row.applicationNumber }}
                      @if (row.orderNumber) { · Order No. {{ row.orderNumber }} }
                      @if (row.issuedOn) { · Issued {{ formatDate(row.issuedOn) }} }
                      @if (row.dueOn && row.canPay) { · Due {{ formatDate(row.dueOn) }} }
                    </div>
                    @if (lastPayment(row.applicationId); as last) {
                      <div class="order-last" [class.order-last--red]="last.view.tone === 'red'" [class.order-last--green]="last.view.tone === 'green'">
                        @if (last.view.label === 'Rejected') {
                          <span><strong>Your last payment was rejected.</strong> {{ last.view.detail }}</span>
                        } @else if (last.view.label === 'Paid') {
                          <span><strong>Paid.</strong> {{ last.view.detail }}</span>
                        } @else {
                          <span>Payment sent {{ formatDate(last.entry.submittedAt) }} (Ref. {{ last.entry.referenceNumber }}). {{ last.view.detail }}</span>
                        }
                      </div>
                    }
                  </div>
                  <div class="order-side">
                    <div class="order-amount">{{ pesos(row.totalCentavos) }}</div>
                    <div class="order-actions">
                      @if (row.canPay) {
                        <a [routerLink]="['/payments', row.applicationId]" class="btn btn-primary btn-sm">
                          {{ row.state === 'rejected' ? 'Pay Again' : 'Pay Now' }}
                        </a>
                      } @else {
                        <a [routerLink]="['/payments', row.applicationId, 'receipt']" class="btn btn-secondary btn-sm">View Receipt</a>
                      }
                    </div>
                  </div>
                </article>
              }
            </div>
          }
        } @else {
          @if (historyError()) {
            <div class="pay-empty">Your payment history could not be loaded. Refresh the page to try again.</div>
          } @else if (history() === null) {
            <div class="pay-empty">Loading your payment history…</div>
          } @else if (history()!.length === 0) {
            <div class="pay-empty">No payments sent yet. Payments you send appear here, with their Official Receipts once confirmed.</div>
          } @else if (visibleHistory().length === 0) {
            <div class="pay-empty">No payments match. <button type="button" (click)="clearFilters()">Show all</button></div>
          } @else {
            <ul class="history">
              @for (item of visibleHistory(); track item.entry.id; let i = $index) {
                @if (i === 0 || dayOf(visibleHistory()[i - 1]) !== dayOf(item)) {
                  <li class="history-day">{{ formatDate(item.entry.submittedAt) }}</li>
                }
                <li class="history-item">
                  <span class="history-icon" [class]="'history-icon history-icon--' + item.view.tone" aria-hidden="true">
                    @switch (item.view.tone) {
                      @case ('green') { <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> }
                      @case ('red') { <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17" /></svg> }
                      @case ('amber') { <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></svg> }
                      @default { <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12h16" /></svg> }
                    }
                  </span>
                  <div class="history-body">
                    <div class="history-title">
                      <strong>{{ item.permitType }}</strong>
                      <span class="badge" [class]="'badge-' + item.view.tone">{{ item.view.label }}</span>
                    </div>
                    <div class="history-meta">
                      {{ item.applicationNumber }} ·
                      {{ item.entry.method === 'Onsite' ? 'Paid at the Treasurer’s Office' : item.entry.method }} ·
                      Ref. {{ item.entry.referenceNumber }}
                    </div>
                    @if (item.view.detail) {
                      <div class="history-detail" [class.history-detail--red]="item.view.tone === 'red'">
                        @if (item.view.label === 'Rejected') { <strong>Why:</strong>&nbsp;}{{ item.view.detail }}
                      </div>
                    }
                  </div>
                  <div class="history-side">
                    <span class="history-amount">{{ pesos(item.entry.amountCentavos) }}</span>
                    <a [routerLink]="['/payments', item.applicationId, 'receipt']" class="small">View</a>
                  </div>
                </li>
              }
            </ul>
          }
        }
      }
    </div>
  `,
})
export class PaymentsListPage {
  private readonly store = inject(ApplicationStore);
  protected readonly api = inject(CitizenApiClient);
  protected readonly pesos = pesos;
  protected readonly formatDate = formatDate;
  protected readonly orderFilters = ORDER_FILTERS;
  protected readonly historyFilters = HISTORY_FILTERS;

  protected readonly tab = signal<'orders' | 'history'>('orders');
  protected readonly orderFilter = signal<OrderFilter>('all');
  protected readonly historyFilter = signal<HistoryFilter>('all');
  protected readonly search = signal('');

  /** Every payment sent, newest first; null while loading. */
  protected readonly history = signal<HistoryRow[] | null>(null);
  protected readonly historyError = signal(false);
  /** Which applications the history was last loaded for, so a store refresh with the same set does not reload it. */
  private historyFor = '';

  constructor() {
    effect(() => {
      const apps = this.store.myApplications().filter((a) => a.assessedAmountCentavos !== null);
      const key = apps.map((a) => `${a.id}:${a.paymentStatus}`).join(',');
      if (!this.api.configured || key === this.historyFor) return;
      this.historyFor = key;
      void this.loadHistory(apps.map((a) => ({ id: a.id, number: a.applicationNumber, permitType: a.permitType })));
    });
  }

  private async loadHistory(apps: { id: string; number: string; permitType: string }[]): Promise<void> {
    try {
      const perApp = await Promise.all(apps.map(async (app) => {
        const entries = await firstValueFrom(this.api.getPayments(app.id));
        return entries.map((entry): HistoryRow => ({
          entry, view: paymentAttemptView(entry),
          applicationId: app.id, applicationNumber: app.number, permitType: app.permitType,
        }));
      }));
      this.history.set(perApp.flat().sort((a, b) => b.entry.submittedAt.localeCompare(a.entry.submittedAt)));
      this.historyError.set(false);
    } catch {
      this.historyError.set(true);
    }
  }

  /** The application's most recent payment, if it has sent any. */
  protected lastPayment(applicationId: string): HistoryRow | undefined {
    return (this.history() ?? []).find((h) => h.applicationId === applicationId);
  }

  rows(): PaymentRow[] {
    return this.store
      .myApplications()
      .filter((a) => a.assessedAmountCentavos !== null)
      .map((a): PaymentRow => {
        // The only state that offers to take a payment is one the Municipality
        // is still owed for. 'Pending Verification' does not offer it again —
        // a citizen who has already sent proof must not be invited to send it
        // twice while an officer is still looking at the first one.
        const canPay = a.paymentStatus === 'Not Yet Available' || a.paymentStatus === 'Overdue';
        const rejected = canPay && this.lastPayment(a.id)?.view.label === 'Rejected';
        const state: OrderState = rejected ? 'rejected' : canPay ? 'awaiting' : a.paymentStatus === 'Paid' ? 'paid' : 'verifying';
        const order = this.store.orderOfPaymentFor(a.id);
        return {
          applicationId: a.id,
          applicationNumber: a.applicationNumber,
          permitType: a.permitType,
          totalCentavos: a.assessedAmountCentavos!,
          state,
          // The server says "Not Yet Available" for both "no Order yet" and
          // "Order issued, nothing paid". This list only shows rows WITH an
          // Order, so here it always means the fee is waiting to be paid.
          label: rejected ? 'Payment Rejected' : a.paymentStatus === 'Not Yet Available' ? 'Awaiting Payment' : a.paymentStatus,
          tone: state === 'paid' ? 'green' : state === 'rejected' || a.paymentStatus === 'Overdue' ? 'red' : 'amber',
          canPay,
          orderNumber: order?.number ?? null,
          issuedOn: order?.assessedAt ?? null,
          dueOn: order?.dueDate ?? null,
        };
      });
  }

  protected stateRows(...states: OrderState[]): PaymentRow[] {
    return this.rows().filter((r) => states.includes(r.state));
  }

  protected orderCount(filter: OrderFilter): number {
    return filter === 'all' ? this.rows().length : this.stateRows(filter).length;
  }

  private matches(...fields: (string | null)[]): boolean {
    const words = this.search().toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const haystack = fields.filter((f): f is string => !!f).join(' ').toLowerCase();
    return words.every((w) => haystack.includes(w));
  }

  protected visibleRows(): PaymentRow[] {
    const filter = this.orderFilter();
    return this.rows().filter((r) => (filter === 'all' || r.state === filter)
      && this.matches(r.applicationNumber, r.permitType, r.orderNumber, r.label));
  }

  private historyFilterOf(item: HistoryRow): HistoryFilter {
    const label = item.view.label;
    return label === 'Paid' || label === 'Pending Verification' || label === 'Rejected' ? label : 'Other';
  }

  protected historyCount(filter: HistoryFilter): number {
    const items = this.history() ?? [];
    return filter === 'all' ? items.length : items.filter((h) => this.historyFilterOf(h) === filter).length;
  }

  protected visibleHistory(): HistoryRow[] {
    const filter = this.historyFilter();
    return (this.history() ?? []).filter((h) => (filter === 'all' || this.historyFilterOf(h) === filter)
      && this.matches(h.applicationNumber, h.permitType, h.entry.referenceNumber, h.entry.officialReceiptNumber, h.view.label));
  }

  /** The calendar day a payment was sent, for the history's day headings. */
  protected dayOf(item: HistoryRow): string {
    return formatDate(item.entry.submittedAt);
  }

  protected clearFilters(): void {
    this.orderFilter.set('all');
    this.historyFilter.set('all');
    this.search.set('');
  }

  protected totalOf(rows: PaymentRow[]): number {
    return rows.reduce((sum, r) => sum + r.totalCentavos, 0);
  }

  protected countLabel(n: number, noun: string, plural = `${noun}s`): string {
    return `${n} ${n === 1 ? noun : plural}`;
  }
}
