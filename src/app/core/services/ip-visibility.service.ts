import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, of, take } from 'rxjs';

/**
 * Сервіс для керування видимістю елементів на основі IP-адреси користувача.
 */
@Injectable({
  providedIn: 'root'
})
export class IpVisibilityService {
  private readonly http = inject(HttpClient);
  private readonly MY_IP = '46.174.127.203'; // IP-адреса власника
  
  /** Сигнал, що вказує, чи має користувач доступ до прихованих секцій */
  public readonly isAuthorized = signal<boolean>(false);

  constructor() {
    this.checkIp();
  }

  /**
   * Запитує поточну IP-адресу клієнта та перевіряє її на відповідність дозволеній.
   */
  private checkIp(): void {
    this.http.get<{ ip: string }>('https://api.ipify.org?format=json')
      .pipe(
        take(1),
        map(response => response.ip === this.MY_IP),
        catchError(() => of(false))
      )
      .subscribe(isSame => {
        this.isAuthorized.set(isSame);
      });
  }
}
