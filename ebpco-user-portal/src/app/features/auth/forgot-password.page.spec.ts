import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForgotPasswordPage } from './forgot-password.page';

/**
 * Guards F-5: this screen must never claim to have sent something it did not
 * send. It reported "a password reset link has been sent" while doing nothing,
 * with no reset route anywhere to follow up on.
 */
describe('ForgotPasswordPage (F-5: claims no delivery it cannot make)', () => {
  function render() {
    TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();
    return fixture;
  }
  afterEach(() => TestBed.resetTestingModule());

  it('never tells the user a reset link was sent', () => {
    const text = (render().nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('has been sent');
    expect(text).not.toContain('Check your email');
  });

  it('says plainly that reset is unavailable, and offers a route that works', () => {
    const text = (render().nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('not available in this build');
    expect(text).toContain('09054818572');
    expect(text).toContain('meocastilla@gmail.com');
  });

  it('collects no address it cannot act on', () => {
    expect((render().nativeElement as HTMLElement).querySelector('input')).toBeNull();
  });
});
