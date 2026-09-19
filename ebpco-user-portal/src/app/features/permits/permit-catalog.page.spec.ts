import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PermitCatalogPage } from './permit-catalog.page';
import { PERMIT_TYPE_GROUPS, PermitType } from '../../core/domain/permit.model';
import { permitFormAssetFor } from '../../core/domain/permit-form-assets';

/**
 * Guards F-13: `permit-form-assets.ts` mapped every permit type to the
 * Municipality's own blank form, and NOTHING imported it. 13 of the 14 bundled
 * PDFs were unreachable from any screen — only the Unified Application Form
 * was, via a hard-coded href on the permit document page.
 *
 * The files existed and every path resolved, which is exactly why a
 * file-existence check missed it: a file existing is not the feature working.
 * These assertions are about REACHABILITY.
 */
const ALL_TYPES = PERMIT_TYPE_GROUPS.flatMap((g) => g.types) as PermitType[];

describe('Permit form assets (F-13: bundled forms must be reachable)', () => {
  it('covers every permit type the catalogue offers', () => {
    expect(ALL_TYPES.length).toBeGreaterThan(0);
    for (const type of ALL_TYPES) {
      const asset = permitFormAssetFor(type);
      expect(asset).toBeTruthy();
      expect(asset.fileName).toContain('assets/permit-forms/');
      expect(asset.label.length).toBeGreaterThan(0);
    }
  });

  it('reaches more than just the Unified Application Form', () => {
    // The regression this guards: everything collapsing back to one hard-coded
    // href, leaving the other bundled forms stranded.
    const distinct = new Set(ALL_TYPES.map((t) => permitFormAssetFor(t).fileName));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('renders a working download link once a permit\'s requirements popup is open', () => {
    // The defect was a module nobody imported, so assert the RENDER, not the
    // presence of the mapping. Reading the compiled template as a string does
    // not work — Angular compiles it to a function.
    TestBed.configureTestingModule({
      imports: [PermitCatalogPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PermitCatalogPage);
    fixture.detectChanges();

    // Deliberately NOT ALL_TYPES[0]: the first type is a Building Permit whose
    // form IS the Unified Application Form, so a regression that collapses every
    // link back to that one hard-coded href would still pass. Pick a type whose
    // form is distinct, or this test cannot fail.
    const type = ALL_TYPES.find(
      (t) => !permitFormAssetFor(t).fileName.includes('unified-application-form'),
    )!;
    expect(type).toBeTruthy();
    (fixture.componentInstance as unknown as { openRequirements(t: PermitType): void }).openRequirements(type);
    fixture.detectChanges();

    // RequirementsModalComponent re-parents itself onto <body> (same reason
    // LegalModalComponent does — see its own doc comment), so the popup's
    // content lives outside this fixture's own element.
    const links = [...document.body.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.includes('assets/permit-forms/'));

    expect(links).toContain(permitFormAssetFor(type).fileName);
    TestBed.resetTestingModule();
  });
});
