import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProfilePage } from './profile.page';
import { AuthService } from '../../core/session/auth.service';
import { ToastService } from '../../shared/ui/toast.service';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { API_BASE_URL } from '../../core/api/api-config';
import { NotificationPreferencesResponse } from '../../core/api/citizen-api.models';
import { FakeCitizenIdentityApi } from '../../core/testing/fake-citizen-identity-api';

const BASE = 'https://api.example.gov.ph';

function configure(): void {
  TestBed.configureTestingModule({
    imports: [ProfilePage],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: CitizenIdentityApi, useClass: FakeCitizenIdentityApi },
    ],
  });
}

/** Same as `configure()`, plus a real `API_BASE_URL` so `CitizenApiClient` calls actually reach `HttpTestingController` instead of throwing `ApiNotConfiguredError`. */
function configureWithBackend(): void {
  TestBed.configureTestingModule({
    imports: [ProfilePage],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: CitizenIdentityApi, useClass: FakeCitizenIdentityApi },
      { provide: API_BASE_URL, useValue: BASE },
    ],
  });
}

async function signInAndCreate() {
  const auth = TestBed.inject(AuthService);
  await auth.login('juan.delacruz@example.com', 'Password1');
  const fixture = TestBed.createComponent(ProfilePage);
  fixture.detectChanges();
  return { fixture, auth };
}

/**
 * Guards F-15's ORIGINAL intent — the Notification Preferences panel must
 * actually persist a change, not merely look like it does — now against the
 * real `GET`/`PUT /notification-preferences` route this screen used to have
 * nothing behind at all.
 *
 * F-15 itself was about eight checkboxes bound to a freshly-built local
 * object nothing stored; every control HAD a binding, which is why a
 * dead-control scan reported the screen clean. "Bound" was never "persisted"
 * — and now that this really is a `PUT`, the test that matters is that the
 * PUT actually happens and carries what was on screen.
 */
describe('ProfilePage (preferences round-trip through the real backend)', () => {
  async function setup() {
    configureWithBackend();
    return signInAndCreate();
  }
  afterEach(() => TestBed.resetTestingModule());

  const SAMPLE: NotificationPreferencesResponse = {
    categories: {
      applicationUpdates: true, payments: true, permitStatus: true,
      documentReminders: true, appointments: true, account: false,
    },
    quietHours: { enabled: false, start: '22:00', end: '06:00' },
  };

  it('fetches the real preferences the first time the tab is opened, not a client default', async () => {
    const { fixture } = await setup();
    const http = TestBed.inject(HttpTestingController);
    const page = fixture.componentInstance as unknown as {
      selectTab(t: string): void;
      preferences: () => NotificationPreferencesResponse | null;
    };

    page.selectTab('notifications');
    const req = http.expectOne(`${BASE}/notification-preferences`);
    expect(req.request.method).toBe('GET');
    req.flush(SAMPLE);
    await fixture.whenStable();

    expect(page.preferences()).toEqual(SAMPLE);
    http.verify();
  });

  it('saving sends the SAME categories and quiet hours shown on screen', async () => {
    const { fixture } = await setup();
    const http = TestBed.inject(HttpTestingController);
    const page = fixture.componentInstance as unknown as {
      selectTab(t: string): void;
      toggleCategory(c: keyof NotificationPreferencesResponse['categories']): void;
      savePreferences(): Promise<void>;
    };

    page.selectTab('notifications');
    http.expectOne(`${BASE}/notification-preferences`).flush(SAMPLE);
    await fixture.whenStable();

    page.toggleCategory('account');
    const save = page.savePreferences();
    const put = http.expectOne(`${BASE}/notification-preferences`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      ...SAMPLE,
      categories: { ...SAMPLE.categories, account: true },
    });
    put.flush({ ...SAMPLE, categories: { ...SAMPLE.categories, account: true } });
    await save;
    http.verify();
  });

  it('offers a control to save them', async () => {
    const { fixture } = await setup();
    const http = TestBed.inject(HttpTestingController);
    const page = fixture.componentInstance as unknown as { selectTab(t: string): void };
    page.selectTab('notifications');
    http.expectOne(`${BASE}/notification-preferences`).flush(SAMPLE);
    await fixture.whenStable();
    fixture.detectChanges();

    const labels = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].map(
      (b) => b.textContent?.trim() ?? '',
    );
    expect(labels).toContain('Save Preferences');
    http.verify();
  });
});

/**
 * Guards F-20's ORIGINAL intent — Change Password must never silently accept
 * a blank/weak new password — now against the REAL `POST
 * /auth/password/change` route (see `password-reset-tripwire.spec.ts` for
 * the test proving that route, not this client, is what decides whether a
 * candidate password is accepted).
 *
 * `FakeCitizenIdentityApi.changePassword()` always answers `{ kind: 'done'
 * }` — there is no server here to refuse a weak password with, so this file
 * only guards what belongs to the CLIENT: the two checks that must happen
 * before a round trip is even attempted, and that a real success actually
 * ends the session rather than merely closing a form.
 */
describe('ProfilePage (Change Password: client-side checks and a real success)', () => {
  async function setup() {
    configure();
    return signInAndCreate();
  }
  afterEach(() => TestBed.resetTestingModule());

  type PasswordPage = {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    passwordError: () => string | null;
    changePassword(): Promise<void>;
  };

  it('refuses a blank current or new password before any round trip', async () => {
    const { fixture } = await setup();
    const page = fixture.componentInstance as unknown as PasswordPage;
    page.currentPassword = '';
    page.newPassword = 'A New Passphrase!2';
    page.confirmPassword = 'A New Passphrase!2';
    await page.changePassword();
    expect(page.passwordError()).toMatch(/enter your current password/i);
  });

  it('refuses when the new and confirm fields do not match', async () => {
    const { fixture } = await setup();
    const page = fixture.componentInstance as unknown as PasswordPage;
    page.currentPassword = 'Password1';
    page.newPassword = 'A New Passphrase!2';
    page.confirmPassword = 'Something Else Entirely!3';
    await page.changePassword();
    expect(page.passwordError()).toBe('New passwords do not match.');
  });

  it('on a real success, signs the citizen out and sends them to sign in again', async () => {
    const { fixture, auth } = await setup();
    const router = TestBed.inject(Router);
    const navigated: unknown[][] = [];
    router.navigate = (commands: unknown[]) => {
      navigated.push(commands);
      return Promise.resolve(true);
    };
    const page = fixture.componentInstance as unknown as PasswordPage;

    page.currentPassword = 'Password1';
    page.newPassword = 'A New Passphrase!2';
    page.confirmPassword = 'A New Passphrase!2';
    await page.changePassword();

    expect(page.passwordError()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigated).toEqual([['/login']]);
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
 *
 * Still true after real auth landed: `PATCH /me` exists on the backend now,
 * but this portal's `API_BASE_URL` in a unit test is not the live proxy, so
 * `CitizenApiClient.configured` is false here exactly as it always was —
 * the screen's "not connected" branch is still the one under test.
 */
describe('ProfilePage (F-25: a profile change reaches no office)', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    configure();
    await signInAndCreate();
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

    page.street = '77 New Street, Barangay Bagumbayan';
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
    page.street = '77 New Street, Barangay Bagumbayan';
    page.saveProfile();
    expect(TestBed.inject(AuthService).currentUser()?.street).toBe('77 New Street, Barangay Bagumbayan');
  });
});
