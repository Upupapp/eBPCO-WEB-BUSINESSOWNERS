import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app-shell.component';

/**
 * Guards F-14: the demo disclosure must be a property of the BUILD, shown on
 * every signed-in screen, not a per-screen afterthought.
 *
 * Before this, three screens carried the notice and all three carried it only
 * in their "we couldn't find that application" branch — so a citizen saw it
 * after their data was already gone, and never before spending an hour in the
 * application wizard. A disclosure that only appears on failure is a
 * consolation, not a warning.
 */
describe('AppShell (F-14: the demo disclosure is build-wide)', () => {
  function render() {
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      // AppShellComponent injects AuthService, which now injects
      // CitizenIdentityApi (real HTTP), which injects HttpClient — so this
      // test needs a provider for it even though rendering never fires a
      // request. provideHttpClientTesting() ensures nothing escapes to a
      // real network if a future change makes it try.
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    return fixture;
  }
  afterEach(() => TestBed.resetTestingModule());

  it('shows the notice on every screen the shell wraps', () => {
    const banner = (render().nativeElement as HTMLElement).querySelector('.ds-demo-banner');
    expect(banner).toBeTruthy();
  });

  it('says accounts are real but application data is lost on refresh', () => {
    // Updated once account sign-up/sign-in were wired to the real backend —
    // "the Municipality receives nothing" stopped being true the day
    // POST /auth/register started really creating a row. See the HTML's own
    // comment on `.ds-demo-banner` for the full reasoning.
    const text = (render().nativeElement as HTMLElement).querySelector('.ds-demo-banner')?.textContent ?? '';
    expect(text).toContain('Account sign-up and sign-in are real');
    expect(text).toContain('genuinely created and stored');
    expect(text).toContain('erased when you close or refresh');
  });

  it('gives a route that actually works, using the sourced MEO number', () => {
    const text = (render().nativeElement as HTMLElement).querySelector('.ds-demo-banner')?.textContent ?? '';
    expect(text).toContain('09054818572');
  });

  it('renders before the routed screen, not after it', () => {
    // Order matters: a notice below the fold on a long wizard is a notice
    // nobody reads before they invest the effort it is warning them about.
    const main = (render().nativeElement as HTMLElement).querySelector('.ds-main');
    const kids = [...(main?.children ?? [])];
    const banner = kids.findIndex((el) => el.classList.contains('ds-demo-banner'));
    const outlet = kids.findIndex((el) => el.tagName.toLowerCase() === 'router-outlet');
    expect(banner).toBeGreaterThan(-1);
    expect(outlet).toBeGreaterThan(-1);
    expect(banner).toBeLessThan(outlet);
  });
});
