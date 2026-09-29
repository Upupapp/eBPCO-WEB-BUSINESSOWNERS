import { Component } from '@angular/core';
import { BackLinkComponent } from '../../shared/ui/back-link.component';
import { TERMS_CONDITIONS_TEXT } from '../../core/domain/legal-copy';

@Component({
  selector: 'app-terms',
  imports: [BackLinkComponent],
  template: `
    <div class="page" style="max-width:680px;">
      <app-back-link fallback="/landing" fallbackLabel="Home" [publicPage]="true" />
      <div class="page-header" style="margin-top:12px;">
        <h1>Terms &amp; Conditions</h1>
      </div>
      <div class="card">
        <p>{{ terms }}</p>
      </div>
    </div>
  `,
})
export class TermsPage {
  readonly terms = TERMS_CONDITIONS_TEXT;
}
