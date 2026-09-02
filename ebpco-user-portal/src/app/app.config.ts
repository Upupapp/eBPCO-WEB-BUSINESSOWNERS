import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { citizenAuthInterceptor } from './core/api/citizen-auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // The HTTP layer exists but is not wired to any host: API_BASE_URL is null
    // in this build and CitizenApiClient refuses to issue a request while it is.
    // The Municipality's API host is theirs to supply - see api-config.ts.
    provideHttpClient(withInterceptors([citizenAuthInterceptor])),
  ],
};
