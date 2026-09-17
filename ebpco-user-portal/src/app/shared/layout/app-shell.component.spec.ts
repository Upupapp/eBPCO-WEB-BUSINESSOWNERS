import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app-shell.component';

/**
 * F-14's demo disclosure (`.ds-demo-banner`) warned that applications,
 * documents, payments and businesses were not connected to a real backend.
 * All four are now real (Hardening Pass, Part 3c), and the banner's final
 * line — "do not file a real permit application here" — became actively
 * backwards the moment filing here genuinely reached the Municipality. This
 * guards the removal, not a message: nothing about the shell should re-show
 * a blanket "this is a demo" notice while the citizen surface remains real.
 */
describe('AppShell (F-14: the stale demo disclosure was removed)', () => {
  function render() {
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      // AppShellComponent injects AuthService, which injects CitizenIdentityApi
      // (real HTTP), which injects HttpClient — so this test needs a provider
      // for it even though rendering never fires a request.
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    return fixture;
  }
  afterEach(() => TestBed.resetTestingModule());

  it('no longer shows the stale demo banner', () => {
    const banner = (render().nativeElement as HTMLElement).querySelector('.ds-demo-banner');
    expect(banner).toBeNull();
  });

  it('renders the routed screen', () => {
    const outlet = (render().nativeElement as HTMLElement).querySelector('router-outlet');
    expect(outlet).toBeTruthy();
  });
});
