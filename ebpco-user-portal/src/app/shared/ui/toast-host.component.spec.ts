import { TestBed } from '@angular/core/testing';
import { ToastHostComponent } from './toast-host.component';
import { ToastService } from './toast.service';

/**
 * Guards task 10. Without a live region a screen-reader user is never told an
 * action succeeded or failed — the toast appears, announces nothing, and is
 * gone in 3.5s. WCAG 2.1 4.1.3 Status Messages (AA). axe cannot flag this: the
 * rule can only judge a live region that already exists.
 */
describe('ToastHost (task 10: status messages are announced)', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [ToastHostComponent] });
    const fixture = TestBed.createComponent(ToastHostComponent);
    fixture.detectChanges();
    return fixture;
  }
  afterEach(() => TestBed.resetTestingModule());

  it('has a polite live region for confirmations', () => {
    const el = (render().nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(el).toBeTruthy();
    expect(el!.getAttribute('aria-live')).toBe('polite');
  });

  it('has an assertive region for errors, so a failure interrupts', () => {
    const el = (render().nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(el).toBeTruthy();
    expect(el!.getAttribute('aria-live')).toBe('assertive');
  });

  it('routes an error to the assertive region, not the polite one', () => {
    const fixture = render();
    TestBed.inject(ToastService).error('We could not save that.');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('We could not save that.');
    expect(host.querySelector('[role="status"]')?.textContent ?? '').not.toContain('We could not save that.');
  });
});
