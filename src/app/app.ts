import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { LoginModal } from '@core/components/_index';
import { AdminToken } from './core/services/admin-token';
import { IpVisibilityService } from './core/services/ip-visibility.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LoginModal],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  protected readonly title = signal('gi-theatre-lineup-simulator');
  readonly adminToken = inject(AdminToken);
  readonly ipVisibility = inject(IpVisibilityService);
  private readonly router = inject(Router);
  loginModal = viewChild(LoginModal);

  onLoginClick() {
    this.loginModal()?.open();
  }

  // Опціонально: логаут
  onLogout(): void {
    this.adminToken.removeToken();
    this.router.navigate(['/']);
  }

  // Доступ до наявності токена (для шаблону)
  hasAdminToken(): boolean {
    return this.adminToken.hasToken();
  }
}
