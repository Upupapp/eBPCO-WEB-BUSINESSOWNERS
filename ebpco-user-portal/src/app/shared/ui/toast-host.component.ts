import { Component, computed, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  template: `
    <!--
      A live region. Without one, a screen-reader user is never told an action
      succeeded or failed — the toast appears, announces nothing, and vanishes
      after 3.5s. WCAG 2.1 4.1.3 Status Messages (AA).
      axe does not flag this: the rule can only judge a live region that exists.

      role="status" (polite) for ordinary confirmations; errors get their own
      assertive region, because "we could not save that" should interrupt rather
      than queue behind whatever is being read.
    -->
    <div class="toast-host">
      <div role="status" aria-live="polite" aria-atomic="false">
        @for (t of polite(); track t.id) {
          <div class="toast" [class.success]="t.kind === 'success'">{{ t.message }}</div>
        }
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="false">
        @for (t of errors(); track t.id) {
          <div class="toast error">{{ t.message }}</div>
        }
      </div>
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toast = inject(ToastService);
  protected readonly polite = computed(() => this.toast.toasts().filter((t) => t.kind !== 'error'));
  protected readonly errors = computed(() => this.toast.toasts().filter((t) => t.kind === 'error'));
}
