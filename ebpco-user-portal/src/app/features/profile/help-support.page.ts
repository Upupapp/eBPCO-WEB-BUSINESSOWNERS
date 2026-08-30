import { Component, signal } from '@angular/core';

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

      <div class="card">
        <div class="card-title">Office Hours</div>
        <p class="small muted">Monday to Friday, 8:00 AM – 5:00 PM</p>
        <div class="card-title">Contact</div>
        <p class="small muted">Building Permit and Certificate of Occupancy Office, Castilla Municipal Hall, Castilla, Sorsogon</p>
        <p class="small muted">Phone: (056) 000-0000 &nbsp;·&nbsp; Email: support&#64;ebpco.gov.ph</p>
        <button class="btn btn-primary btn-sm" (click)="contact()">Contact Support</button>
      </div>
    </div>
  `,
})
export class HelpSupportPage {
  readonly open = signal<string | null>(null);
  readonly faqs: Faq[] = [
    { q: 'How do I apply for a permit?', a: 'Go to Permit Services, choose the permit type for your project, review the required documents, then start the application wizard.' },
    { q: 'How long does processing take?', a: 'Processing time varies by permit type and depends on document completeness and evaluation by the reviewing office (OBO, Zoning, or BFP).' },
    { q: 'Can I edit my application after submission?', a: 'Once submitted, you cannot edit an application directly, but if the reviewing office marks it "Revision Required," you can resubmit the requested documents.' },
    { q: 'What payment methods are accepted?', a: 'Bank Transfer (with proof of payment) and Onsite payment at the Building Permit and Certificate of Occupancy Office.' },
    { q: 'Is my data secure?', a: 'Your personal data is handled in accordance with the Philippine Data Privacy Act and is never shared with another applicant.' },
  ];

  toggle(q: string): void {
    this.open.set(this.open() === q ? null : q);
  }

  contact(): void {
    window.location.href = 'mailto:support@ebpco.gov.ph';
  }
}
