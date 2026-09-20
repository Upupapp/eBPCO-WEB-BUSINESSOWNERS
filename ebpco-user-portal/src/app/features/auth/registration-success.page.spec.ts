import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RegistrationSuccessPage } from './registration-success.page';

/**
 * Guards F-16: this screen told a new citizen to "verify your email and mobile
 * number from your Profile before submitting a permit application".
 *
 * The Profile screen has no verification action — only two read-only badges.
 * Nothing can send a verification email or an OTP. And the verified/pending
 * status gates nothing anywhere in the app, so it was not even a real
 * precondition. A dead instruction pointing at a control that does not exist.
 */
describe('RegistrationSuccessPage (F-16: no instruction without a control)', () => {
  function render() {
    TestBed.configureTestingModule({
      imports: [RegistrationSuccessPage],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(RegistrationSuccessPage);
    fixture.detectChanges();
    return fixture;
  }
  afterEach(() => TestBed.resetTestingModule());

  it('does not send the citizen to Profile to verify anything', () => {
    const text = (render().nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('verify your email and mobile number');
    expect(text).not.toContain('before submitting a permit application');
  });

  it('describes email verification as the sign-up step it now is, and mobile as recorded-not-verified', () => {
    // Sign-up confirms the email address with a real code since 2026-09-20,
    // so "not available yet" stopped being true. Mobile numbers are kept on
    // file and never verified — by decision, not as a gap — and the page
    // must not send anyone looking for a step that does not exist.
    const text = (render().nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('confirmed the code sent to your email during sign-up');
    expect(text).toContain('mobile number is kept on file and is not verified');
    expect(text).not.toContain('not available yet');
    expect(text).not.toMatch(/verify your mobile/i);
  });

  it('does not imply the account reached the Municipality', () => {
    // Used to assert 'demonstration build' / 'browser only' here, because
    // registration used to write to a local, in-browser store and that was
    // the honest thing to say. It now calls the real POST /auth/register
    // (auth.service.ts's register()), so the false half of the old claim --
    // the account isn't real -- is gone; what remains to guard is the other
    // half, that creating an account is not the same as an office having
    // reviewed anything.
    const text = (render().nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('account has been created');
    expect(text).not.toContain('reviewed');
    expect(text).not.toContain('approved');
  });
});
