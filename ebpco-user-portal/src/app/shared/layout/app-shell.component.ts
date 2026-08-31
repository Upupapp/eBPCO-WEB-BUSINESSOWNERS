import { Component, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/session/auth.service';
import { NotificationStore } from '../../core/stores/notification.store';
import { ToastHostComponent } from '../ui/toast-host.component';
import { fullName } from '../../core/domain/user.model';
import { MUNICIPAL_ENGINEER } from '../../core/domain/lgu-contact';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHostComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly notifications = inject(NotificationStore);
  protected readonly engineerMobile = MUNICIPAL_ENGINEER.mobile;

  /** Off-canvas drawer state. Only meaningful below 1024px; above it the CSS
   *  ignores this entirely and the sidebar is always visible. */
  protected readonly navOpen = signal(false);

  constructor() {
    // Close on navigation, or the drawer stays over the page the citizen just
    // asked for.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.navOpen.set(false));
  }

  protected toggleNav(): void { this.navOpen.update((v) => !v); }
  protected closeNav(): void { this.navOpen.set(false); }

  @HostListener('document:keydown.escape')
  protected onEscape(): void { this.closeNav(); }

  userName(): string {
    const u = this.auth.currentUser();
    return u ? fullName(u) : '';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
