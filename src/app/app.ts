import { ChangeDetectionStrategy, Component, inject, signal, viewChild, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { LoginModal } from '@core/components/_index';
import { AdminToken } from './core/services/admin-token';
import { SwUpdate } from '@angular/service-worker';
import { IpVisibilityService } from './core/services/ip-visibility.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LoginModal],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit {
  protected readonly title = signal('gi-theatre-lineup-simulator');
  readonly adminToken = inject(AdminToken);
  readonly ipVisibility = inject(IpVisibilityService);
  private readonly router = inject(Router);
  private readonly swUpdate = inject(SwUpdate);
  loginModal = viewChild(LoginModal);

  ngOnInit() {
    if (this.swUpdate.isEnabled) {
      // Listen for ready-to-install updates
      this.swUpdate.versionUpdates.subscribe(evt => {
        console.log('SW Event:', evt.type); // Log all event types for debugging
        
        if (evt.type === 'VERSION_READY') {
          console.log('SW: New version ready detection');
          
          const lastReload = Number(localStorage.getItem('SW_LAST_RELOAD') || 0);
          const now = Date.now();
          
          if (now - lastReload > 60000) {
            localStorage.setItem('SW_LAST_RELOAD', now.toString());
            console.log('SW: Activating update and reloading...');
            this.swUpdate.activateUpdate().then(() => {
              window.location.reload();
            });
          } else {
            console.warn('SW: Version ready, but reload throttled');
          }
        }
      });

      // Manual check ONLY ONCE after a 5-minute delay
      // to ensure initial data sync is 100% finished
      setTimeout(() => {
        this.swUpdate.checkForUpdate().catch(() => {});
      }, 300000);
    }
  }

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
