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
        const text = render().nativeElement.textContent ?? '';
        expect(text).not.toContain('verify your email and mobile number');
        expect(text).not.toContain('before submitting a permit application');
    });
    it('says verification is unavailable and blocks nothing', () => {
        const text = render().nativeElement.textContent ?? '';
        expect(text).toContain('not available yet');
        expect(text).toContain('does not block anything');
    });
    it('does not imply the account reached the Municipality', () => {
        const text = render().nativeElement.textContent ?? '';
        expect(text).toContain('demonstration build');
        expect(text).toContain('browser only');
    });
});
