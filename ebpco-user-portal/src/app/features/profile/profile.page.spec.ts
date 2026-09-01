import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfilePage } from './profile.page';
import { AuthService } from '../../core/session/auth.service';

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
