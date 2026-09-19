import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, computed, inject, input, output } from '@angular/core';
import { PRIVACY_POLICY_SECTIONS, TERMS_CONDITIONS_TEXT } from '../../core/domain/legal-copy';

export type LegalDocument = 'terms' | 'privacy';

/**
 * Terms & Conditions / Privacy Policy, shown in place rather than by
 * navigating to /terms or /privacy.
 *
 * Those two routes still exist and work fine on their own (the register
 * form and the Profile page's Legal tab both open this overlay instead), but
 * linking to them from the middle of a multi-step form is exactly the wrong
 * shape: a real route navigation tears
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
          <button type="button" class="legal-modal-close" (click)="close.emit()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="18" height="18">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
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
      position: fixed; inset: 0; background: rgba(16, 24, 40, .6);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; z-index: 200;
      animation: legal-modal-fade 0.18s ease both;
    }
    .legal-modal-panel {
      background: var(--white, #fff); border-radius: 16px; padding: 24px;
      width: 100%; max-width: 640px; max-height: 85vh; overflow: auto;
      box-shadow: 0 24px 60px -12px rgba(16, 24, 40, .35), 0 0 0 1px rgba(16, 24, 40, .04);
      animation: legal-modal-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    .legal-modal-head {
      display: flex; justify-content: space-between; align-items: center;
      gap: 12px; margin-bottom: 16px; padding-bottom: 14px;
      border-bottom: 1px solid var(--border-light, #e5e7eb);
    }
    .legal-modal-head h2 { margin: 0; }
    .legal-modal-close {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; flex-shrink: 0;
      border: none; border-radius: 8px; background: transparent;
      color: var(--gray-500, #667085); cursor: pointer;
      transition: background-color .15s ease, color .15s ease;
    }
    .legal-modal-close:hover { background: var(--gray-100, #f3f4f6); color: var(--gray-900, #101828); }
    @keyframes legal-modal-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes legal-modal-pop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
  `],
})
export class LegalModalComponent implements AfterViewInit, OnDestroy {
  readonly document = input.required<LegalDocument>();
  readonly close = output<void>();

  readonly title = computed(() => (this.document() === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'));

  readonly terms = TERMS_CONDITIONS_TEXT;
  readonly sections = PRIVACY_POLICY_SECTIONS;

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly domDocument = inject(DOCUMENT);

  /**
   * Moved to a direct child of `<body>` rather than left wherever this
   * component was opened from. A page's own entrance animation (e.g.
   * `.anim-pop-in`, used on the register/login cards) leaves a `transform`
   * on its element even after the animation ends (`animation-fill-mode:
   * both` keeps the final keyframe's computed style) — and any ancestor
   * with a `transform` other than `none` becomes the containing block for
   * a `position: fixed` descendant, per the CSS spec. That silently shrank
   * this modal's "cover the whole screen" backdrop down to just that
   * card's own box. Re-parenting to `<body>` sidesteps the problem outright
   * instead of chasing down every current and future animated ancestor
   * that might reopen it — Angular's bindings/listeners stay attached to
   * the actual DOM nodes, so moving them doesn't break anything.
   */
  ngAfterViewInit(): void {
    this.domDocument.body.appendChild(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.elementRef.nativeElement.remove();
  }
}
