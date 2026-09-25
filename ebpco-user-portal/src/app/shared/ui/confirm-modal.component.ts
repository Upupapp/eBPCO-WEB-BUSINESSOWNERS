import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, inject, input, output } from '@angular/core';

/**
 * A styled stand-in for the native `confirm()` dialog.
 *
 * `window.confirm()` cannot be themed at all — it renders as the browser's
 * own chrome (found live 2026-09-20, next to every other panel in this
 * portal's own rounded/shadowed design language). Same backdrop/panel
 * shape as `legal-modal.component.ts`, including the re-parent-to-`<body>`
 * fix for the same transformed-ancestor issue documented there.
 */
@Component({
  selector: 'app-confirm-modal',
  template: `
    <div class="confirm-modal-backdrop" (click)="cancel.emit()">
      <div
        class="confirm-modal-panel"
        [class.confirm-modal-panel--danger]="tone() === 'danger'"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (click)="$event.stopPropagation()"
      >
        <h2 class="confirm-modal-title">{{ title() }}</h2>
        <p class="confirm-modal-message">{{ message() }}</p>
        <div class="confirm-modal-actions">
          <button type="button" class="btn btn-secondary" (click)="cancel.emit()">{{ cancelLabel() }}</button>
          <button
            type="button"
            [class]="tone() === 'danger' ? 'btn btn-danger' : 'btn btn-primary'"
            (click)="confirm.emit()"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-modal-backdrop {
      position: fixed; inset: 0; background: rgba(16, 24, 40, .6);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; z-index: 300;
      animation: confirm-modal-fade 0.18s ease both;
    }
    .confirm-modal-panel {
      background: var(--white, #fff); border-radius: 16px; padding: 24px;
      width: 100%; max-width: 420px;
      box-shadow: 0 24px 60px -12px rgba(16, 24, 40, .35), 0 0 0 1px rgba(16, 24, 40, .04);
      animation: confirm-modal-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      border-top: 4px solid var(--primary-500, #a5182a);
    }
    .confirm-modal-panel--danger {
      border-top-color: var(--danger-500, #dc2626);
    }
    .confirm-modal-title {
      margin: 0 0 10px;
      font-size: 17px;
    }
    .confirm-modal-message {
      margin: 0 0 22px;
      color: var(--gray-600, #565c6b);
      font-size: 14px;
      line-height: 1.55;
      /* A few callers (account deletion) pass several distinct warnings as
         one string, one per line — plain text stays plain text otherwise. */
      white-space: pre-line;
    }
    .confirm-modal-actions {
      display: flex; justify-content: flex-end; gap: 10px;
    }
    @keyframes confirm-modal-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes confirm-modal-pop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
  `],
})
export class ConfirmModalComponent implements AfterViewInit, OnDestroy {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  /** 'danger' tints the panel's top edge and the confirm button red — reserve it for an action that removes or destroys something. */
  readonly tone = input<'default' | 'danger'>('default');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly domDocument = inject(DOCUMENT);

  // Same re-parent-to-<body> fix as LegalModalComponent — see its own doc
  // comment for why a transformed ancestor otherwise shrinks the backdrop.
  ngAfterViewInit(): void {
    this.domDocument.body.appendChild(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.elementRef.nativeElement.remove();
  }
}
