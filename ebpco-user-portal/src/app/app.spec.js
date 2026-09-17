import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { App } from './app';
/**
 * F-9: this file was the untouched Angular CLI scaffold, still asserting an
 * `<h1>` containing "Hello, ebpco-user-portal". `App`'s template is a bare
 * `<router-outlet />` and never had an `<h1>`, so the assertion could not pass
 * at any commit — it was failing from the first day of the project.
 *
 * A suite whose only test cannot pass is worse than no suite: `npm test` was
 * red for a reason nobody was reading, so a genuine regression landing in it
 * would have looked exactly the same.
 */
describe('App', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [App],
            providers: [provideRouter([])],
        }).compileComponents();
    });
    it('creates the root component', () => {
        expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
    });
    it('renders the router outlet that every route is drawn into', async () => {
        const fixture = TestBed.createComponent(App);
        await fixture.whenStable();
        expect(fixture.debugElement.query(By.directive(RouterOutlet))).toBeTruthy();
    });
});
