import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ProfilePage } from './profile.page';
import { AuthService } from '../../core/session/auth.service';
import { ToastService } from '../../shared/ui/toast.service';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { FakeCitizenIdentityApi } from '../../core/testing/fake-citizen-identity-api';
function configure() {
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
async function signInAndCreate() {
    const auth = TestBed.inject(AuthService);
    await auth.login('juan.delacruz@example.com', 'Password1');
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return { fixture, auth };
}
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
    async function setup() {
        configure();
        return signInAndCreate();
    }
    afterEach(() => TestBed.resetTestingModule());
    it('reads preferences from the account, not from a fresh default each time', async () => {
        const { auth } = await setup();
        const stored = auth.notificationPreferencesFor();
        stored.smsNotifications = !stored.smsNotifications;
        auth.updateNotificationPreferences(stored);
        expect(auth.notificationPreferencesFor().smsNotifications).toBe(stored.smsNotifications);
    });
    it('survives a change round-trip through the page', async () => {
        const { fixture, auth } = await setup();
        const page = fixture.componentInstance;
        const before = auth.notificationPreferencesFor().emailNotifications;
        page.prefs['emailNotifications'] = !before;
        page.savePreferences();
        expect(auth.notificationPreferencesFor().emailNotifications).toBe(!before);
    });
    it('offers a control to save them', async () => {
        const { fixture } = await setup();
        fixture.componentInstance.tab.set('notifications');
        fixture.detectChanges();
        const labels = [...fixture.nativeElement.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '');
        expect(labels).toContain('Save Preferences');
    });
    it('hands out a copy, so an unsaved edit cannot leak into the account', async () => {
        const { auth } = await setup();
        const a = auth.notificationPreferencesFor();
        a.pushNotifications = !a.pushNotifications;
        expect(auth.notificationPreferencesFor().pushNotifications).not.toBe(a.pushNotifications);
    });
});
/**
 * Guards F-20's ORIGINAL intent — Change Password must never silently accept
 * a blank/weak new password — under the real backend's constraints.
 *
 * F-20 itself no longer applies as written: there is no local password-set
 * path left to have a weak-input bug in. The backend has no "change password
 * while signed in" route at all (only forgot/reset by email — see
 * `AuthService.changePassword`'s own doc comment), so this now guards that
 * the screen is HONEST about that rather than pretending to change anything.
 */
describe('ProfilePage (Change Password honestly refuses — no backend route exists)', () => {
    async function setup() {
        configure();
        return signInAndCreate();
    }
    afterEach(() => TestBed.resetTestingModule());
    it('refuses any change, with an honest reason, rather than silently accepting one', async () => {
        const { fixture } = await setup();
        const page = fixture.componentInstance;
        page.currentPassword = 'Password1';
        page.newPassword = 'NewPassword2';
        page.confirmPassword = 'NewPassword2';
        page.changePassword();
        expect(page.passwordError()).toMatch(/isn.?t connected yet|forgot password/i);
    });
    it('still enforces its own client-side checks before even trying', async () => {
        const { fixture } = await setup();
        const page = fixture.componentInstance;
        page.currentPassword = 'Password1';
        page.newPassword = 'short1';
        page.confirmPassword = 'short1';
        page.changePassword();
        expect(page.passwordError()).toBe('Password must be at least 8 characters with at least 1 letter and 1 number.');
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
        const text = fixture.nativeElement.textContent ?? '';
        // A toast is gone in four seconds. This is the sentence that decides
        // whether someone rings the office about a permit going to an old address.
        expect(text).toMatch(/has no way yet to send a profile change|does not tell the office|stay on this device/i);
    });
    it('gives the citizen a real way to actually update their record', () => {
        const fixture = TestBed.createComponent(ProfilePage);
        fixture.detectChanges();
        const text = fixture.nativeElement.textContent ?? '';
        // Saying "we cannot do this" without saying who can is only half honest.
        expect(text).toMatch(/\d{4,}/); // a contact number is on screen
    });
    it('the confirmation does not claim the office received anything', () => {
        const fixture = TestBed.createComponent(ProfilePage);
        const page = fixture.componentInstance;
        fixture.detectChanges();
        const messages = [];
        const toast = TestBed.inject(ToastService);
        const realSuccess = toast.success.bind(toast);
        toast.success = (m) => { messages.push(m); realSuccess(m); };
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
