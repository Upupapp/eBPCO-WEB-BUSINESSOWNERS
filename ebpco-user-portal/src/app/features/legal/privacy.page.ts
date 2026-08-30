import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRIVACY_POLICY_TEXT } from '../../core/domain/legal-copy';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  template: `
    <div class="page" style="max-width:680px;">
      <a routerLink="/landing" class="small">&larr; Back</a>
      <div class="page-header" style="margin-top:12px;">
        <h1>Privacy Policy</h1>
      </div>
      <div class="card">
        <p>{{ privacy }}</p>
      </div>
    </div>
  `,
})
export class PrivacyPage {
  readonly privacy = PRIVACY_POLICY_TEXT;
}
