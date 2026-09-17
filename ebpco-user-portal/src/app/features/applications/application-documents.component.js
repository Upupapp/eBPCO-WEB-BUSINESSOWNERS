import { __decorate } from "tslib";
import { Component, computed, input, output } from '@angular/core';
import { canResubmit, documentValidity, groupDocumentChains, rejectionExplanation, reviewLabel, securityState, } from '../../core/api/document-chains';
import { formatDate } from '../../core/utils/ids';
/**
 * The application's documents, and the office's verdict on each.
 *
 * Takes the CONTRACT shape (`ApplicationDocumentResponse`) rather than the
 * in-memory store's, so the same component serves the demo today and
 * `GET /applications/{id}/documents` unchanged once an API host exists.
 *
 * It renders CHAINS, not rows — see document-chains.ts. The old table showed
 * label / status / uploaded, which for a rejection told a citizen that
 * something was wrong and nothing about what.
 */
let ApplicationDocumentsComponent = class ApplicationDocumentsComponent {
    documents = input.required();
    /** The document the citizen wants to replace. */
    replace = output();
    /**
     * The document the citizen wants to LOOK at (DOC-003).
     *
     * Emits the contract shape, which carries no bytes — the server's document
     * response describes a document, it is not the document. The page resolves
     * the id back to the file this build actually kept.
     */
    preview = output();
    chains = computed(() => groupDocumentChains(this.documents()));
    label = reviewLabel;
    explain = rejectionExplanation;
    security = securityState;
    canReplace = (c) => canResubmit(c);
    /**
     * What the document's own expiry date says today.
     *
     * The office has been sending `expiresOn` all along; nothing in this portal
     * ever compared it to anything. Returns null when there is no date, so the
     * template says nothing rather than inventing a validity the issuing office
     * never stated.
     */
    validity(doc) {
        const v = documentValidity(doc.expiresOn);
        return v.state === 'no-expiry' ? null : v;
    }
    formatDate = formatDate;
    /**
     * `null` is grey — "not yet reviewed". It must never take the green a citizen
     * reads as "this one is done"; the contract is explicit that null means
     * nobody has looked, not that nothing is wrong.
     */
    badgeClass(status) {
        switch (status) {
            case 'Accepted': return 'badge-green';
            case 'Rejected': return 'badge-red';
            case 'Revision Required':
            case 'Expired': return 'badge-amber';
            default: return 'badge-gray';
        }
    }
};
ApplicationDocumentsComponent = __decorate([
    Component({
        selector: 'app-application-documents',
        template: `
    @if (chains().length === 0) {
      <p class="muted small">No documents attached.</p>
    } @else {
      <ul class="doc-list">
        @for (chain of chains(); track chain.current.id) {
          <li class="doc-item">
            <div class="doc-head">
              <span class="doc-name">{{ chain.current.label }}</span>
              <span class="badge" [class]="badgeClass(chain.current.reviewStatus)">
                {{ label(chain.current.reviewStatus) }}
              </span>
            </div>
            <div class="small muted">{{ chain.current.fileName }}</div>

            <!--
              The scanner is a DIFFERENT AXIS from the officer's verdict, so it
              is a separate line and only appears when there is something to
              say. A rejection is not a virus; a quarantine is not a verdict.
            -->
            @if (security(chain.current) === 'quarantined') {
              <p class="doc-note doc-note-danger">
                This file was held by the virus scanner and has not been reviewed. It is not a decision about your application.
              </p>
            } @else if (security(chain.current) === 'scanning') {
              <p class="doc-note">Being checked for viruses.</p>
            }

            @if (explain(chain.current); as why) {
              <p class="doc-note doc-note-danger"><strong>Why:</strong> {{ why }}</p>
            }

            <!--
              Validity is a THIRD axis, separate from the officer's verdict and
              from the scanner. An accepted document can still have expired
              since; an expiry is not a rejection, and saying so in the status
              badge would conflate a fact about the document with a decision
              about the application.
            -->
            @if (validity(chain.current); as v) {
              @switch (v.state) {
                @case ('expired') {
                  <p class="doc-note doc-note-danger">
                    <strong>This document expired on {{ formatDate(v.on) }}</strong>
                    ({{ v.daysAgo }} {{ v.daysAgo === 1 ? 'day' : 'days' }} ago). The Municipality is
                    likely to ask for a current one.
                  </p>
                }
                @case ('expiring') {
                  <p class="doc-note">
                    Valid until {{ formatDate(v.on) }} —
                    {{ v.daysLeft === 0 ? 'the last day' : v.daysLeft + (v.daysLeft === 1 ? ' day left' : ' days left') }}.
                  </p>
                }
                @case ('valid') {
                  <p class="doc-note muted">Valid until {{ formatDate(v.on) }}.</p>
                }
              }
            }

            <button class="btn btn-secondary btn-sm" type="button" data-action="preview" (click)="preview.emit(chain.current)">
              Preview
            </button>
            @if (canReplace(chain)) {
              <button class="btn btn-primary btn-sm" type="button" data-action="replace" (click)="replace.emit(chain.current)">
                Replace this document
              </button>
            }

            <!--
              The pair. "What was wrong" and "what I sent instead" only make a
              rejection actionable together, so the superseded document stays
              visible WITH its reason rather than being replaced by the newer one.
            -->
            @if (chain.superseded.length) {
              <details class="doc-history">
                <summary>{{ chain.superseded.length }} earlier version{{ chain.superseded.length === 1 ? '' : 's' }}</summary>
                @for (old of chain.superseded; track old.id) {
                  <div class="doc-old">
                    <div class="small"><strong>{{ old.fileName }}</strong> — {{ label(old.reviewStatus) }}</div>
                    @if (explain(old); as why) {
                      <p class="doc-note doc-note-danger small"><strong>Why:</strong> {{ why }}</p>
                    }
                  </div>
                }
              </details>
            }
          </li>
        }
      </ul>
    }
  `,
    })
], ApplicationDocumentsComponent);
export { ApplicationDocumentsComponent };
