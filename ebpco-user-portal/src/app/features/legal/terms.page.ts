import { Component } from '@angular/core';
import { BackLinkComponent } from '../../shared/ui/back-link.component';
import { TERMS_SECTIONS } from '../../core/domain/legal-copy';

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
        @for (section of sections; track section.heading) {
          <div style="margin-bottom:14px;">
            <div class="card-title">{{ section.heading }}</div>
            @for (paragraph of section.paragraphs; track paragraph) {
              <p class="small" style="margin:0 0 8px;">{{ paragraph }}</p>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class TermsPage {
  protected readonly sections = TERMS_SECTIONS;
}
