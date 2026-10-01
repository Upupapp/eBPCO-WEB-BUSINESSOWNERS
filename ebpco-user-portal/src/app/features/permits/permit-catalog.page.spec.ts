import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PermitCatalogPage } from './permit-catalog.page';
import { PERMIT_TYPE_GROUPS, PermitType } from '../../core/domain/permit.model';
import { ALL_BLANK_FORMS, blankFormFor } from '../../core/domain/permit-form-assets';

/**
 * Blank forms (2026-10-01): offered only where a requirement asks the citizen
 * to fill one in and upload it, the Building Permit's Unified Building Permit
 * Form and its ancillary forms. Every other permit is filed online, so Permit
 * Services offers no form download; the link sits on the document row. The
 * mobile app does the same.
 */
const ALL_TYPES = PERMIT_TYPE_GROUPS.flatMap((g) => g.types) as PermitType[];

describe('Blank forms: only where a document asks for one', () => {
  const FORM_CODES = [
    'bpnc-unified-form', 'bpnc-ancillary-electrical', 'bpnc-ancillary-fencing', 'bpnc-ancillary-architectural',
    'bpnc-ancillary-sanitary-plumbing', 'bpnc-ancillary-mechanical', 'bpnc-ancillary-civil-structural',
    'bpnc-ancillary-excavation', 'bpnc-ancillary-electronics',
  ];

  it('the Unified Building Permit Form and each ancillary form have their blank form, by code', () => {
    for (const code of FORM_CODES) expect(blankFormFor(code), code).not.toBeNull();
  });

  it('finds it by label for the built-in catalog, and nothing for a document that is not a form', () => {
    expect(blankFormFor('some-other-id', 'Unified Building Permit Form')).not.toBeNull();
    expect(blankFormFor('bpnc-valid-id', 'Valid ID')).toBeNull();
    expect(blankFormFor(null, null)).toBeNull();
  });

  it('links every form under the served folder, once each, and labels the Architectural one a reference template', () => {
    for (const form of ALL_BLANK_FORMS) expect(form.fileName.startsWith('assets/permit-forms/'), form.fileName).toBe(true);
    expect(new Set(ALL_BLANK_FORMS.map((f) => f.fileName)).size).toBe(ALL_BLANK_FORMS.length);
    expect(blankFormFor('bpnc-ancillary-architectural')!.isReferenceTemplate).toBe(true);
    expect(blankFormFor('bpnc-unified-form')!.isReferenceTemplate).toBe(false);
  });

  it('the requirements popup of a permit offers no form download', () => {
    TestBed.configureTestingModule({
      imports: [PermitCatalogPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PermitCatalogPage);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { openRequirements(t: PermitType): void }).openRequirements(ALL_TYPES[0]);
    fixture.detectChanges();
    const links = [...document.body.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.includes('assets/permit-forms/'));
    expect(links).toEqual([]);
    TestBed.resetTestingModule();
  });
});

describe('Permit Services: the FSEC and FSIC come from the BFP', () => {
  it('offers no FSEC or FSIC application, and sends the citizen to BFP-FSIS instead', () => {
    TestBed.configureTestingModule({
      imports: [PermitCatalogPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PermitCatalogPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    const cardNames = Array.from(page.querySelectorAll('.permit-card__name')).map((h) => h.textContent?.trim());
    expect(cardNames).not.toContain('FSEC for Building Permit (BFP)');
    expect(cardNames).not.toContain('FSIC for Occupancy Permit (BFP)');
    expect(cardNames).toContain('Certificate of Occupancy');

    const link = page.querySelector<HTMLAnchorElement>('.bfp-notice a');
    expect(link?.href).toBe('https://fsis.e-bfp.com/');
    expect(link?.rel).toContain('noopener');
  });
});
