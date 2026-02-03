import { ApplicationConfig, provideZonelessChangeDetection, isDevMode } from '@angular/core';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { timer } from 'rxjs'; // Import timer

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    // Router
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // Zoneless change detection (без Zone.js)
    provideZonelessChangeDetection(),

    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && environment.production,
      registrationStrategy: () => timer(20000),
    }),
  ]
};
