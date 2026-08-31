import { Component, signal } from '@angular/core';
import {
  INQUIRY_TURNAROUND,
  MUNICIPAL_ENGINEER,
  MUNICIPAL_HALL_ADDRESS,
  PLANNING_AND_DEVELOPMENT,
} from '../../core/domain/lgu-contact';

interface Faq {
  q: string;
  a: string;
}

@Component({
  selector: 'app-help-support',
  template: `
    <div class="page" style="max-width:700px;">
      <div class="page-header">
        <div>
          <h1>Help &amp; Support</h1>
          <div class="subtitle">Frequently asked questions and contact information.</div>
        </div>
      </div>

      <div class="card">
        @for (item of faqs; track item.q) {
          <div style="border-bottom:1px solid var(--border-light); padding:10px 0;">
            <div style="cursor:pointer; font-weight:600;" (click)="toggle(item.q)">{{ item.q }}</div>
            @if (open() === item.q) {
              <p class="small muted" style="margin-top:6px;">{{ item.a }}</p>
            }
          </div>
        }
      </div>

      <!--
        F-7: every value in this card comes from LGU_CONTACT, which transcribes
        bundled LGU documents and names its source. Do not add a number, address
        or mailbox here that is not in a source document — this card previously
        carried "(056) 000-0000" and "support@ebpco.gov.ph", both invented, while
        the real details sat in assets/.
      -->
      <div class="card">
        <div class="card-title">Contact</div>
        <p class="small muted" style="margin-bottom:12px;">{{ hallAddress }}</p>

        @for (office of offices; track office.shortName) {
          <div style="border-top:1px solid var(--border-light); padding:10px 0;">
            <div style="font-weight:600;">{{ office.name }}</div>
            <div class="small muted" style="margin-bottom:4px;">{{ office.handles }}</div>
            @if (office.mobile) {
              <div class="small"><strong>Mobile:</strong> {{ office.mobile }}</div>
            }
            <div class="small">
              <strong>Email:</strong> <a [href]="'mailto:' + office.email">{{ office.email }}</a>
            </div>
          </div>
        }

        <p class="small muted" style="margin-top:10px;">{{ turnaround }}</p>
        <button class="btn btn-primary btn-sm" (click)="contact()">Email the {{ engineer.shortName }}</button>
      </div>
    </div>
  `,
})
export class HelpSupportPage {
  readonly open = signal<string | null>(null);
  protected readonly offices = [MUNICIPAL_ENGINEER, PLANNING_AND_DEVELOPMENT];
  protected readonly engineer = MUNICIPAL_ENGINEER;
  protected readonly hallAddress = MUNICIPAL_HALL_ADDRESS;
  protected readonly turnaround = INQUIRY_TURNAROUND;
  readonly faqs: Faq[] = [
    { q: 'How do I apply for a permit?', a: 'Go to Permit Services, choose the permit type for your project, review the required documents, then start the application wizard.' },
    { q: 'How long does processing take?', a: 'Processing time varies by permit type and depends on document completeness and evaluation by the reviewing office (OBO, Zoning, or BFP).' },
    { q: 'Can I edit my application after submission?', a: 'Once submitted, you cannot edit an application directly, but if the reviewing office marks it "Revision Required," you can resubmit the requested documents.' },
    { q: 'What payment methods are accepted?', a: 'Onsite payment at the Office of the Municipal Engineer. Bank transfer is not available yet — the Municipality has not published a deposit account, so do not transfer permit fees to any account you have not confirmed with the Municipality directly.' },
    { q: 'Is my data secure?', a: 'This is a demonstration build: everything you enter stays in your browser and is never transmitted to the Municipality or anyone else. Your data is never shared with another citizen\'s account. See the Privacy Policy for what will be collected, and what the Municipality has not yet published.' },
  ];

  toggle(q: string): void {
    this.open.set(this.open() === q ? null : q);
  }

  contact(): void {
    window.location.href = `mailto:${MUNICIPAL_ENGINEER.email}`;
  }
}
