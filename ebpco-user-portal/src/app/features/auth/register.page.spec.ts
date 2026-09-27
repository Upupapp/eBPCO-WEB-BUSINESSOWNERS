import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RegisterPage } from './register.page';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';

/**
 * Registration wizard's own email verification (Step 2): the citizen enters
 * an email, sends a real 6-digit code, and must confirm it before Continue
 * moves on — mirroring the server's own gate in
 * `RegistrationVerificationService`/`consumeConfirmedProof`. These tests
 * cover the client half of that contract. Since the owner's decision of
 * 2026-09-27, Continue is held back until the email is confirmed — always,
 * including when the Municipality's mail could not be sent (the citizen is
 * told to try again instead of being let through unverified).
 */
type Delivery = { kind: 'sent' | 'not-sent' | 'failed'; detail: string } | { kind: 'too-soon'; detail: string };
type Confirmation = { kind: 'confirmed' } | { kind: 'refused'; detail: string };

class ScriptedIdentityApi {
  nextRequest: Delivery = { kind: 'sent', detail: 'A 6-digit code was sent.' };
  nextConfirm: Confirmation = { kind: 'confirmed' };
  requestedEmails: string[] = [];
  confirmedCodes: string[] = [];

  async register(): Promise<void> {}
  async requestRegistrationEmailCode(email: string): Promise<Delivery> {
    this.requestedEmails.push(email);
    return this.nextRequest;
  }
  async confirmRegistrationEmailCode(_email: string, code: string): Promise<Confirmation> {
    this.confirmedCodes.push(code);
    return this.nextConfirm;
  }
}

describe('RegisterPage — Step 2 email verification', () => {
  let api: ScriptedIdentityApi;

  function render() {
    TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CitizenIdentityApi, useClass: ScriptedIdentityApi },
      ],
    });
    api = TestBed.inject(CitizenIdentityApi) as unknown as ScriptedIdentityApi;
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    return fixture;
  }
  afterEach(() => TestBed.resetTestingModule());

  /** Fills every Step 2 field Continue requires other than email verification itself. */
  function fillStep2Contact(page: RegisterPage): void {
    page.step.set(2);
    page.email = 'juan@example.com';
    page.mobileNumber = '09171234567';
    page.street = 'Purok 3';
    page.barangay = 'Poblacion';
    page.city = 'Castilla';
    page.province = 'Sorsogon';
    page.postalCode = '4713';
  }

  it('holds Continue back when a code was sent and never confirmed', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    fillStep2Contact(page);

    await page.sendVerificationCode();
    expect(page.codeSent()).toBe(true);
    expect(page.emailVerified()).toBe(false);

    page.toStep3();
    expect(page.step()).toBe(2);
    expect(page.emailError()).toContain('Enter the 6-digit code');
  });

  it('confirming the right code unlocks Continue', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    fillStep2Contact(page);

    await page.sendVerificationCode();
    page.verificationCode = '123456';
    await page.confirmVerificationCode();

    expect(page.emailVerified()).toBe(true);
    expect(api.confirmedCodes).toEqual(['123456']);

    page.toStep3();
    expect(page.step()).toBe(3);
  });

  it('a wrong code reports the server’s refusal and does not verify', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    fillStep2Contact(page);

    await page.sendVerificationCode();
    api.nextConfirm = { kind: 'refused', detail: 'That code was not accepted.' };
    page.verificationCode = '000000';
    await page.confirmVerificationCode();

    expect(page.emailVerified()).toBe(false);
    expect(page.codeError()).toBe('That code was not accepted.');
  });

  it('editing the email after verifying resets verification — a stale confirmation must not carry over', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    fillStep2Contact(page);

    await page.sendVerificationCode();
    page.verificationCode = '123456';
    await page.confirmVerificationCode();
    expect(page.emailVerified()).toBe(true);

    page.onEmailInput('someone-else@example.com');
    expect(page.emailVerified()).toBe(false);
    expect(page.codeSent()).toBe(false);
    expect(page.verificationCode).toBe('');
  });

  it('still blocks Continue when no mail provider is configured, and tells the citizen to try again', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    fillStep2Contact(page);
    api.nextRequest = { kind: 'not-sent', detail: 'Email delivery is not configured yet.' };

    await page.sendVerificationCode();
    expect(page.codeSent()).toBe(false);
    expect(page.emailVerified()).toBe(false);
    expect(page.skipVerification()).toContain('try Verify Email again');
    expect(page.skipVerification()).not.toContain('continue without verifying');

    page.toStep3();
    expect(page.step()).toBe(2);
  });

  it('still blocks Continue when a real provider just failed to send', async () => {
    const fixture = render();
    const page = fixture.componentInstance;
    fillStep2Contact(page);
    api.nextRequest = { kind: 'failed', detail: 'The mail server refused the message.' };

    await page.sendVerificationCode();
    page.toStep3();
    expect(page.step()).toBe(2);
  });

  it('blocks Continue when the email was never verified at all, and says what to do', () => {
    const fixture = render();
    const page = fixture.componentInstance;
    fillStep2Contact(page);

    page.toStep3();
    expect(page.step()).toBe(2);
    expect(page.emailError()).toContain('Verify Email');
    expect(api.requestedEmails).toEqual([]);
  });
});
