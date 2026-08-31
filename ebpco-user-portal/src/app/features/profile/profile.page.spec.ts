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
