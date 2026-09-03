import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfilePage } from './profile.page';
import { AuthService } from '../../core/session/auth.service';
import { ToastService } from '../../shared/ui/toast.service';

/**
 * Guards F-15: the Notification Preferences panel bound eight checkboxes to a
 * freshly-built local object that nothing ever stored. Toggling one changed a
 * value discarded on navigation.
 *
 * Every control HAD a binding, which is why a dead-control scan — looking for
 * handler-less buttons and unbound selects — reported this screen clean.
 * Bound is not persisted.
 */
describe('ProfilePage (F-15: preferences must actually persist)', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [ProfilePage], providers: [provideRouter([])] });
    const auth = TestBed.inject(AuthService);
    auth.login('juan.delacruz@example.com', 'Password1');
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return { fixture, auth };
  }
  afterEach(() => TestBed.resetTestingModule());

  it('reads preferences from the account, not from a fresh default each time', () => {
    const { auth } = setup();
    const stored = auth.notificationPreferencesFor();
    stored.smsNotifications = !stored.smsNotifications;
    auth.updateNotificationPreferences(stored);
    expect(auth.notificationPreferencesFor().smsNotifications).toBe(stored.smsNotifications);
  });

  it('survives a change round-trip through the page', () => {
    const { fixture, auth } = setup();
    const page = fixture.componentInstance as unknown as {
      prefs: Record<string, boolean>;
      savePreferences(): void;
    };
    const before = auth.notificationPreferencesFor().emailNotifications;
    page.prefs['emailNotifications'] = !before;
    page.savePreferences();
    expect(auth.notificationPreferencesFor().emailNotifications).toBe(!before);
  });

  it('offers a control to save them', () => {
    const { fixture } = setup();
    (fixture.componentInstance as unknown as { tab: { set(t: string): void } }).tab.set('notifications');
    fixture.detectChanges();
    const labels = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].map(
      (b) => b.textContent?.trim() ?? '',
    );
    expect(labels).toContain('Save Preferences');
  });

  it('hands out a copy, so an unsaved edit cannot leak into the account', () => {
    const { auth } = setup();
    const a = auth.notificationPreferencesFor();
    a.pushNotifications = !a.pushNotifications;
    expect(auth.notificationPreferencesFor().pushNotifications).not.toBe(a.pushNotifications);
  });
});

/**
 * Guards F-20: Change Password only checked that the two new-password fields
 * matched each other, not that either one was a real password. Two blank
 * fields matched, so a correct current password plus nothing else silently
 * cleared the account's password.
 */
describe('ProfilePage (F-20: Change Password must enforce the same password rule as Register)', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [ProfilePage], providers: [provideRouter([])] });
    const auth = TestBed.inject(AuthService);
    auth.login('juan.delacruz@example.com', 'Password1');
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return { fixture, auth };
  }
  afterEach(() => TestBed.resetTestingModule());

  type PasswordPage = {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    passwordError: () => string | null;
    changePassword(): void;
  };

  it('rejects a blank new password instead of clearing the account password', () => {
    const { fixture, auth } = setup();
    const page = fixture.componentInstance as unknown as PasswordPage;
    page.currentPassword = 'Password1';
    page.newPassword = '';
    page.confirmPassword = '';
    page.changePassword();
    expect(page.passwordError()).toBe('Password must be at least 8 characters with at least 1 letter and 1 number.');
    expect(auth.login('juan.delacruz@example.com', 'Password1').ok).toBe(true);
  });

  it('rejects a new password that is too short or missing a letter/number', () => {
    const { fixture } = setup();
    const page = fixture.componentInstance as unknown as PasswordPage;
    page.currentPassword = 'Password1';
    page.newPassword = 'short1';
    page.confirmPassword = 'short1';
    page.changePassword();
    expect(page.passwordError()).toBe('Password must be at least 8 characters with at least 1 letter and 1 number.');
  });

  it('still accepts a valid new password', () => {
    const { fixture, auth } = setup();
    const page = fixture.componentInstance as unknown as PasswordPage;
    page.currentPassword = 'Password1';
    page.newPassword = 'NewPassword2';
    page.confirmPassword = 'NewPassword2';
    page.changePassword();
    expect(page.passwordError()).toBeNull();
    expect(auth.login('juan.delacruz@example.com', 'NewPassword2').ok).toBe(true);
  });
});

/**
 * F-25 — the profile save reaches nothing, and must not imply otherwise.
 *
 * No profile endpoint exists: not in CitizenApiClient, and not in the
 * backend's own citizen-endpoints contract. The mobile lane found the same
 * thing on their side and drew the distinction this follows — a mis-wired twin
 * gets fixed, a missing endpoint gets stated. Inventing a call here would have
 * been worse than the bug.
 *
 * The falsehood was never the verb. Within this app the profile IS updated.
 * What "Profile updated." implied was that the office now knows, and the field
 * where believing that costs most is the address: a citizen who moves, updates
 * it here and assumes their permit will be posted to the new one has been
 * misled by a screen rather than by a bug.
 */
describe('ProfilePage (F-25: a profile change reaches no office)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ProfilePage], providers: [provideRouter([])] });
    TestBed.inject(AuthService).login('juan.delacruz@example.com', 'Password1');
  });
  afterEach(() => TestBed.resetTestingModule());

  it('says on screen — not only in a toast — that the Municipality has not been told', () => {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // A toast is gone in four seconds. This is the sentence that decides
    // whether someone rings the office about a permit going to an old address.
    expect(text).toMatch(/has no way yet to send a profile change|does not tell the office|stay on this device/i);
  });

  it('gives the citizen a real way to actually update their record', () => {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // Saying "we cannot do this" without saying who can is only half honest.
    expect(text).toMatch(/\d{4,}/); // a contact number is on screen
  });

  it('the confirmation does not claim the office received anything', () => {
    const fixture = TestBed.createComponent(ProfilePage);
    const page = fixture.componentInstance;
    fixture.detectChanges();

    const messages: string[] = [];
    const toast = TestBed.inject(ToastService);
    const realSuccess = toast.success.bind(toast);
    toast.success = (m: string) => { messages.push(m); realSuccess(m); };

    page.address = '77 New Street, Barangay Bagumbayan';
    page.saveProfile();

    expect(messages.length).toBe(1);
    expect(messages[0]).toMatch(/not been told|this device/i);
    // The exact wording may change; what must not come back is a bare claim of
    // success over a request that was never made.
    expect(messages[0]).not.toBe('Profile updated.');
    expect(messages[0]).not.toMatch(/successfully/i);
  });

  it('and the change really is kept locally — the notice is honest in both directions', () => {
    const fixture = TestBed.createComponent(ProfilePage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.address = '77 New Street, Barangay Bagumbayan';
    page.saveProfile();
    expect(TestBed.inject(AuthService).currentUser()?.address).toBe('77 New Street, Barangay Bagumbayan');
  });
});
