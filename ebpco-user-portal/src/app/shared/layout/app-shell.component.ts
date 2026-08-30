import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/session/auth.service';
import { NotificationStore } from '../../core/stores/notification.store';
import { ToastHostComponent } from '../ui/toast-host.component';
import { fullName } from '../../core/domain/user.model';

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

  userName(): string {
    const u = this.auth.currentUser();
    return u ? fullName(u) : '';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
