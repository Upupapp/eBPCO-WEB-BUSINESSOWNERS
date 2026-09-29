import { Component } from '@angular/core';
import { BackLinkComponent } from '../../shared/ui/back-link.component';
import { PRIVACY_POLICY_SECTIONS } from '../../core/domain/legal-copy';

@Component({
  selector: 'app-privacy',
  imports: [BackLinkComponent],
  template: `
    <div class="page" style="max-width:680px;">
      <app-back-link fallback="/landing" fallbackLabel="Home" [publicPage]="true" />
      <div class="page-header" style="margin-top:12px;">
        <h1>Privacy Policy</h1>
      </div>
      @for (section of sections; track section.heading) {
        <div class="card">
          <div class="card-title">{{ section.heading }}</div>
          @for (paragraph of section.paragraphs; track paragraph) {
            <p class="small" style="margin:0 0 8px;">{{ paragraph }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class PrivacyPage {
  protected readonly sections = PRIVACY_POLICY_SECTIONS;
}
