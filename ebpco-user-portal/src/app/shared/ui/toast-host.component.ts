import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toast-host">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class.success]="t.kind === 'success'" [class.error]="t.kind === 'error'">{{ t.message }}</div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toast = inject(ToastService);
}
