import { __decorate } from "tslib";
import { Component, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/session/auth.service';
import { NotificationStore } from '../../core/stores/notification.store';
import { ToastHostComponent } from '../ui/toast-host.component';
import { fullName } from '../../core/domain/user.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
let AppShellComponent = class AppShellComponent {
    auth = inject(AuthService);
    router = inject(Router);
    notifications = inject(NotificationStore);
    /** Off-canvas drawer state. Only meaningful below 1024px; above it the CSS
     *  ignores this entirely and the sidebar is always visible. */
    navOpen = signal(false);
    /** Desktop icon-only rail state. Only meaningful at/above 1024px — the CSS
     *  scopes every collapsed-mode rule to that breakpoint so a stale collapsed
     *  class can't fight the off-canvas drawer's own width/transform below it.
     *  Deliberately NOT reset on navigation (unlike navOpen): it's a standing
     *  layout preference, not a transient overlay. */
    sidebarCollapsed = signal(false);
    constructor() {
        // Close on navigation, or the drawer stays over the page the citizen just
        // asked for.
        this.router.events
            .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
            .subscribe(() => this.navOpen.set(false));
    }
    toggleNav() { this.navOpen.update((v) => !v); }
    closeNav() { this.navOpen.set(false); }
    toggleSidebarCollapse() { this.sidebarCollapsed.update((v) => !v); }
    onEscape() { this.closeNav(); }
    userName() {
        const u = this.auth.currentUser();
        return u ? fullName(u) : '';
    }
    userPhoto() {
        return this.auth.currentUser()?.photoPath ?? null;
    }
    async logout() {
        await this.auth.logout();
        this.router.navigate(['/login']);
    }
};
__decorate([
    HostListener('document:keydown.escape')
], AppShellComponent.prototype, "onEscape", null);
AppShellComponent = __decorate([
    Component({
        selector: 'app-shell',
        imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHostComponent],
        templateUrl: './app-shell.component.html',
        styleUrl: './app-shell.component.scss',
    })
], AppShellComponent);
export { AppShellComponent };
