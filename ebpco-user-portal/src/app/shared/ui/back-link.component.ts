import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { NavigationHistory } from '../../core/utils/navigation-history';

/**
 * "← Back to …": the page's parent, named -- My Applications from an
 * application, My Businesses from a business (QA TC-19, TC-29, 2026-10-03).
 *
 * It used to name and return to whatever screen came before, which read
 * "Back to Application Form" right after submitting (and opened a blank new
 * application), "Back to Register a Business" after registering one, and
 * looped between a business and its Edit form. A fixed parent cannot do any
 * of that. A public page (the terms, the privacy notice) still returns to
 * where the reader came from, since that may be the sign-in screens.
 */
@Component({
  selector: 'app-back-link',
  template: `
    <button type="button" class="back-link" (click)="go()">
      <span aria-hidden="true">&larr;</span> {{ text() }}
    </button>
  `,
  styles: `
    :host { display: inline-block; }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
      border: 0;
      background: none;
      color: var(--primary-600);
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
    }
    .back-link:hover { text-decoration: underline; }
    .back-link:focus-visible { outline: 2px solid var(--primary-500); outline-offset: 2px; border-radius: 4px; }
  `,
})
export class BackLinkComponent {
  /** Where to go when there is no screen before this one. */
  readonly fallback = input.required<string>();
  /** What `fallback` is called. */
  readonly fallbackLabel = input.required<string>();
  /** A public page (the terms, the privacy notice), which may return to the sign-in screens. */
  readonly publicPage = input(false);

  private readonly history = inject(NavigationHistory);
  private readonly router = inject(Router);

  protected readonly text = computed(() => {
    if (!this.publicPage()) return `Back to ${this.fallbackLabel()}`;
    const label = this.history.label(this.fallbackLabel(), true);
    return label === 'Back' ? 'Back' : `Back to ${label}`;
  });

  protected go(): void {
    if (!this.publicPage()) {
      void this.router.navigateByUrl(this.fallback());
      return;
    }
    this.history.back(this.fallback(), true);
  }
}
