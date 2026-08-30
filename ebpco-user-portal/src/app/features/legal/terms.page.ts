import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TERMS_CONDITIONS_TEXT } from '../../core/domain/legal-copy';

@Component({
  selector: 'app-terms',
  imports: [RouterLink],
  template: `
    <div class="page" style="max-width:680px;">
      <a routerLink="/landing" class="small">&larr; Back</a>
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
