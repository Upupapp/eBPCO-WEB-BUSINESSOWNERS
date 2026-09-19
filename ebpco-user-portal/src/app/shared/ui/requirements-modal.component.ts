import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { ApplicationAction, PermitType } from '../../core/domain/permit.model';
import { RequirementDocument, documentsFor, requirementsFor } from '../../core/domain/requirements-catalog';
import { permitFormAssetFor } from '../../core/domain/permit-form-assets';
import { CitizenApiClient } from '../../core/api/citizen-api.client';

const ACTIONS: readonly ApplicationAction[] = ['New', 'Renewal', 'Amendment'];

const ACTION_LABEL: Record<ApplicationAction, string> = {
  New: 'New Application',
  Renewal: 'Renewal',
  Amendment: 'Amendment',
};

/**
 * "View Requirements" for one permit type, as a popup over a grayed-out
 * page rather than the old expand-in-place list — every "View Requirements"
 * button in the portal opens this, there is no other form of it left.
 *
 * Documents vary by application action since backend migration 047
 * consolidated the three Building Permit sub-types into one 'Building
 * Permit' entry keyed by New/Renewal/Amendment instead of by permit-type
 * name — so this always offers the three-way picker, not just for Building
 * Permit. For a permit type that has never distinguished by action, the
 * three tabs simply show the same list, which is honest rather than a
 * missing feature.
 *
 * Fetches the real, live checklist from the same
 * `GET /requirements/{permitType}` the Application Wizard and
 * `ApplicationStore` use, falling back to the static, disclosed
 * `requirements-catalog.ts` only where the LGU has not published one yet —
 * same "start with what's known locally, swap in the real thing the moment
 * it arrives" shape used everywhere else real data has replaced a local
 * catalogue in this portal.
 */
@Component({
  selector: 'app-requirements-modal',
  template: `
    <div class="req-modal-backdrop" (click)="close.emit()">
      <div
        class="req-modal-panel"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Requirements for ' + permitType()"
        (click)="$event.stopPropagation()"
      >
        <div class="req-modal-head">
          <div>
            <h2>{{ permitType() }}</h2>
            <p class="small muted" style="margin:4px 0 0;">{{ entry().reviewingOffice }}</p>
          </div>
          <button type="button" class="req-modal-close" (click)="close.emit()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="18" height="18">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="req-modal-tabs" role="tablist" aria-label="Application type">
          @for (a of actions; track a) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="action() === a"
              class="req-modal-tab"
              [class.active]="action() === a"
              (click)="action.set(a)"
            >
              {{ actionLabel(a) }}
            </button>
          }
        </div>

        <div class="req-modal-body">
          @if (loading()) {
            <p class="small muted" style="margin:14px 0;">Checking for the LGU's published checklist…</p>
          }
          <ul class="req-modal-list">
            @for (d of documents(); track d.id) {
              <li class="small">
                <span class="badge" [class]="d.required ? 'badge-req' : 'badge-opt'">{{ d.required ? 'Required' : 'Optional' }}</span>
                <span>
                  {{ d.label }}
                  @if (d.description) { <span class="muted"> — {{ d.description }}</span> }
                </span>
              </li>
            }
          </ul>

          <a
            class="small req-modal-form-link"
            [href]="formAsset().fileName"
            target="_blank"
            rel="noopener"
          >
            Download the official blank form — {{ formAsset().label }}
          </a>
          @if (formAsset().isFallback) {
            <p class="small muted" style="margin:-6px 0 0;">
              Castilla has no dedicated form for this permit; the generic Unified Application Form is used.
            </p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .req-modal-backdrop {
      position: fixed; inset: 0; background: rgba(16, 24, 40, .6);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; z-index: 200;
      animation: req-modal-fade 0.18s ease both;
    }
    .req-modal-panel {
      background: var(--white, #fff); border-radius: 16px; padding: 24px;
      width: 100%; max-width: 560px; max-height: 85vh; overflow: auto;
      box-shadow: 0 24px 60px -12px rgba(16, 24, 40, .35), 0 0 0 1px rgba(16, 24, 40, .04);
      animation: req-modal-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    .req-modal-head {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 12px; margin-bottom: 16px; padding-bottom: 14px;
      border-bottom: 1px solid var(--border-light, #e5e7eb);
    }
    .req-modal-head h2 { margin: 0; }
    .req-modal-close {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; flex-shrink: 0;
      border: none; border-radius: 8px; background: transparent;
      color: var(--gray-500, #667085); cursor: pointer;
      transition: background-color .15s ease, color .15s ease;
    }
    .req-modal-close:hover { background: var(--gray-100, #f3f4f6); color: var(--gray-900, #101828); }

    .req-modal-tabs {
      display: flex; gap: 6px; margin-bottom: 16px;
      background: var(--gray-100, #f3f4f6); border-radius: 10px; padding: 4px;
    }
    .req-modal-tab {
      flex: 1; border: none; background: transparent; border-radius: 8px;
      padding: 8px 10px; font-size: 13px; font-weight: 600; cursor: pointer;
      color: var(--gray-600, #4b5563); transition: background-color .15s ease, color .15s ease;
    }
    .req-modal-tab.active { background: var(--white, #fff); color: var(--gray-900, #101828); box-shadow: 0 1px 2px rgba(15,23,42,.08); }

    .req-modal-status { display: inline-block; margin-bottom: 14px; }

    .req-modal-list {
      list-style: none; display: flex; flex-direction: column; gap: 8px;
      padding-left: 0; margin: 0 0 18px;
    }
    .req-modal-list li { display: flex; align-items: flex-start; gap: 8px; }
    .req-modal-list .badge { border-radius: 6px; flex-shrink: 0; margin-top: 1px; }

    .req-modal-form-link { display: inline-block; }

    @keyframes req-modal-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes req-modal-pop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
  `],
})
export class RequirementsModalComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly permitType = input.required<PermitType>();
  readonly close = output<void>();

  protected readonly actions = ACTIONS;
  protected readonly action = signal<ApplicationAction>('New');
  protected readonly loading = signal(false);

  private readonly api = inject(CitizenApiClient);

  /**
   * The static entry's fixed metadata (office, form, verification badge) —
   * same as ApplicationStore's own use of the static catalog for these
   * fields even once the live documents list has loaded. `computed()`, not
   * a plain field initializer: a required `input()` has no value yet while
   * the class's OWN fields are being initialized, only once Angular has
   * bound it — reading it eagerly here is what NG8118 refuses to compile.
   */
  protected readonly entry = computed(() => requirementsFor(this.permitType()));
  protected readonly formAsset = computed(() => permitFormAssetFor(this.permitType()));

  /** Real checklist per action, once loaded; absent means "not asked yet or the LGU hasn't published one" — falls back to the static catalog either way. */
  private readonly real = signal<Partial<Record<ApplicationAction, RequirementDocument[]>>>({});

  protected readonly documents = computed<readonly RequirementDocument[]>(() => {
    const real = this.real()[this.action()];
    return real ?? documentsFor(this.permitType(), this.action());
  });

  /**
   * Not the constructor: a required `input()` throws NG0950 if read before
   * Angular has bound it, and that binding is not guaranteed to have
   * happened yet inside a component's own constructor body — only from
   * `ngOnInit` onward.
   */
  ngOnInit(): void {
    for (const a of ACTIONS) this.load(a);
  }

  protected actionLabel(a: ApplicationAction): string {
    return ACTION_LABEL[a];
  }

  private load(action: ApplicationAction): void {
    this.loading.set(true);
    this.api.getRequirementsForPermitType(this.permitType(), action).subscribe({
      next: (result) => {
        if (result.documents.length === 0) { this.loading.set(false); return; }
        const docs: RequirementDocument[] = result.documents.map((d) => ({
          id: d.code, label: d.label, required: d.required, description: d.description || undefined,
        }));
        this.real.update((m) => ({ ...m, [action]: docs }));
        this.loading.set(false);
      },
      // Not yet published for this permit type/action — the static catalog
      // above already stands in, same as everywhere else in this portal.
      error: () => this.loading.set(false),
    });
  }

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly domDocument = inject(DOCUMENT);

  /** Re-parented to <body> for the same reason LegalModalComponent is — see its own doc comment on the position:fixed containing-block bug this sidesteps. */
  ngAfterViewInit(): void {
    this.domDocument.body.appendChild(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.elementRef.nativeElement.remove();
  }
}
