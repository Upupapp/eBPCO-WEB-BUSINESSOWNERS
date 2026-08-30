import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/session/auth.guard';
import { AppShellComponent } from './shared/layout/app-shell.component';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/splash/splash.page').then((m) => m.SplashPage) },
  { path: 'onboarding', loadComponent: () => import('./features/onboarding/onboarding.page').then((m) => m.OnboardingPage) },
  { path: 'landing', loadComponent: () => import('./features/landing/landing.page').then((m) => m.LandingPage) },
  { path: 'how-it-works', loadComponent: () => import('./features/how-it-works/how-it-works.page').then((m) => m.HowItWorksPage) },
  { path: 'terms', loadComponent: () => import('./features/legal/terms.page').then((m) => m.TermsPage) },
  { path: 'privacy', loadComponent: () => import('./features/legal/privacy.page').then((m) => m.PrivacyPage) },
  // Public, no-login permit verification — the destination the QR block on
  // every generated permit points to.
  { path: 'verify/:permitNumber', loadComponent: () => import('./features/verify/verify-permit.page').then((m) => m.VerifyPermitPage) },
  { path: 'verify', loadComponent: () => import('./features/verify/verify-permit.page').then((m) => m.VerifyPermitPage) },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'registration-success',
    loadComponent: () => import('./features/auth/registration-success.page').then((m) => m.RegistrationSuccessPage),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'businesses', loadComponent: () => import('./features/business/business-list.page').then((m) => m.BusinessListPage) },
      { path: 'businesses/register', loadComponent: () => import('./features/business/register-business.page').then((m) => m.RegisterBusinessPage) },
      { path: 'businesses/:id', loadComponent: () => import('./features/business/business-details.page').then((m) => m.BusinessDetailsPage) },
      { path: 'permits', loadComponent: () => import('./features/permits/permit-catalog.page').then((m) => m.PermitCatalogPage) },
      { path: 'permits/apply', loadComponent: () => import('./features/permits/application-wizard.page').then((m) => m.ApplicationWizardPage) },
      { path: 'applications', loadComponent: () => import('./features/applications/my-applications.page').then((m) => m.MyApplicationsPage) },
      { path: 'applications/:id', loadComponent: () => import('./features/applications/application-details.page').then((m) => m.ApplicationDetailsPage) },
      { path: 'applications/:id/permit', loadComponent: () => import('./features/applications/permit-document.page').then((m) => m.PermitDocumentPage) },
      { path: 'documents', loadComponent: () => import('./features/documents/my-documents.page').then((m) => m.MyDocumentsPage) },
      { path: 'payments', loadComponent: () => import('./features/payments/payments-list.page').then((m) => m.PaymentsListPage) },
      { path: 'payments/:applicationId', loadComponent: () => import('./features/payments/payment-flow.page').then((m) => m.PaymentFlowPage) },
      { path: 'notifications', loadComponent: () => import('./features/notifications/notifications.page').then((m) => m.NotificationsPage) },
      { path: 'profile', loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage) },
      { path: 'help', loadComponent: () => import('./features/profile/help-support.page').then((m) => m.HelpSupportPage) },
      // No '**' here on purpose: an unmatched URL under this shell should
      // fall through to the real 404 page below (which already links
      // "Back to Home" to /dashboard for a signed-in visitor), not
      // silently redirect to Dashboard with no sign anything was wrong.
      // Angular backtracks past this whole route entry once none of its
      // children match, so the trailing '**' → not-found still applies.
    ],
  },
  { path: 'not-found', loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage) },
  { path: '**', redirectTo: 'not-found' },
];
