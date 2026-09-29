import { Component, computed, inject, input } from '@angular/core';

import { NavigationHistory } from '../../core/utils/navigation-history';

/**
 * "← Back to …": returns to the screen the citizen came from, and names it.
 * Opened directly (a bookmark, a new tab), it goes to `fallback` instead.
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

  protected readonly text = computed(() => {
    const label = this.history.label(this.fallbackLabel(), this.publicPage());
    return label === 'Back' ? 'Back' : `Back to ${label}`;
  });

  protected go(): void {
    this.history.back(this.fallback(), this.publicPage());
  }
}
