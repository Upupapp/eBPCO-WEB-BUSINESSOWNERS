import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { citizenAuthInterceptor } from './core/api/citizen-auth.interceptor';
import { AuthService } from './core/session/auth.service';
import { UploadLimitsService } from './core/api/upload-limits.service';
import { NavigationHistory } from './core/utils/navigation-history';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // A new screen opens at its top, not at however far down the last one was
    // scrolled; Back returns to where the citizen was.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    // API_BASE_URL is read at runtime from public/config.js (see
    // api-config.ts) — '' in local dev and production alike, meaning
    // same-origin, forwarded by proxy.conf.json in dev and by the host
    // platform's redirect rules in production. Null only when config.js
    // never ran at all, which CitizenApiClient/CitizenIdentityApi refuse to
    // silently paper over.
    provideHttpClient(withInterceptors([citizenAuthInterceptor])),
    // Blocks the router's first navigation until a surviving token (if any)
    // has been checked against the server — see AuthService.restore()'s own
    // doc comment for why this can't just happen lazily in the guard.
    provideAppInitializer(() => inject(AuthService).restore()),
    // Fire-and-forget, unlike the initializer above: a few seconds on the
    // old 750,000-byte default costs nothing (the server's own 413 still
    // governs regardless) — see UploadLimitsService's doc comment.
    provideAppInitializer(() => void inject(UploadLimitsService).refresh()),
    // From the first navigation on, so a Back link knows the screen before.
    provideAppInitializer(() => {
      inject(NavigationHistory);
    }),
  ],
};
