import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRIVACY_POLICY_SECTIONS } from '../../core/domain/legal-copy';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  template: `
    <div class="page" style="max-width:680px;">
      <a routerLink="/landing" class="small">&larr; Back</a>
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
