import { Component, computed, input, output } from '@angular/core';
import { ApplicationDocumentResponse } from '../../core/api/citizen-api.models';
import {
  DocumentChain, canResubmit, groupDocumentChains, rejectionExplanation, reviewLabel, securityState,
} from '../../core/api/document-chains';

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
@Component({
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

            @if (canReplace(chain)) {
              <button class="btn btn-primary btn-sm" type="button" (click)="replace.emit(chain.current)">
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
export class ApplicationDocumentsComponent {
  readonly documents = input.required<readonly ApplicationDocumentResponse[]>();
  /** The document the citizen wants to replace. */
  readonly replace = output<ApplicationDocumentResponse>();

  protected readonly chains = computed(() => groupDocumentChains(this.documents()));
  protected readonly label = reviewLabel;
  protected readonly explain = rejectionExplanation;
  protected readonly security = securityState;
  protected readonly canReplace = (c: DocumentChain) => canResubmit(c);

  /**
   * `null` is grey — "not yet reviewed". It must never take the green a citizen
   * reads as "this one is done"; the contract is explicit that null means
   * nobody has looked, not that nothing is wrong.
   */
  protected badgeClass(status: ApplicationDocumentResponse['reviewStatus']): string {
    switch (status) {
      case 'Accepted': return 'badge-green';
      case 'Rejected': return 'badge-red';
      case 'Revision Required':
      case 'Expired': return 'badge-amber';
      default: return 'badge-gray';
    }
  }
}
