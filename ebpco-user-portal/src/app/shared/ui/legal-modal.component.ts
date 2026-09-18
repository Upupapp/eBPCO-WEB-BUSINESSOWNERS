import { Component, computed, input, output } from '@angular/core';
import { PRIVACY_POLICY_SECTIONS, TERMS_CONDITIONS_TEXT } from '../../core/domain/legal-copy';

export type LegalDocument = 'terms' | 'privacy';

/**
 * Terms & Conditions / Privacy Policy, shown in place rather than by
 * navigating to /terms or /privacy.
 *
 * Those two routes still exist (Profile's Legal tab links to them, and they
 * work fine on their own), but linking to them from the middle of a
 * multi-step form is exactly the wrong shape: a real route navigation tears
 * down the form's component and every field the citizen has already typed
 * with it, and both pages' own "Back" link goes to /landing unconditionally
 * rather than back to wherever the citizen actually came from — so returning
 * from a Terms/Privacy read mid-registration landed on the public landing
 * page with the whole form gone, not back on the form. Reusing the same
 * source copy (`legal-copy.ts`) as an overlay avoids the navigation
 * entirely, so there's nothing for a real Back button to even need to undo.
 */
@Component({
  selector: 'app-legal-modal',
  template: `
    <div class="legal-modal-backdrop" (click)="close.emit()">
      <div
        class="legal-modal-panel"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (click)="$event.stopPropagation()"
      >
        <div class="legal-modal-head">
          <h2>{{ title() }}</h2>
          <button type="button" class="btn btn-ghost btn-sm" (click)="close.emit()" aria-label="Close">Close</button>
        </div>
        <div class="legal-modal-body">
          @if (document() === 'terms') {
            <p>{{ terms }}</p>
          } @else {
            @for (section of sections; track section.heading) {
              <div style="margin-bottom:14px;">
                <div class="card-title">{{ section.heading }}</div>
                @for (paragraph of section.paragraphs; track paragraph) {
                  <p class="small" style="margin:0 0 8px;">{{ paragraph }}</p>
                }
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .legal-modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.55);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; z-index: 200;
    }
    .legal-modal-panel {
      background: var(--white, #fff); border-radius: 12px; padding: 20px;
      width: 100%; max-width: 640px; max-height: 85vh; overflow: auto;
    }
    .legal-modal-head {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 12px; margin-bottom: 14px;
    }
    .legal-modal-head h2 { margin: 0; }
  `],
})
export class LegalModalComponent {
  readonly document = input.required<LegalDocument>();
  readonly close = output<void>();

  readonly title = computed(() => (this.document() === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'));

  readonly terms = TERMS_CONDITIONS_TEXT;
  readonly sections = PRIVACY_POLICY_SECTIONS;
}
