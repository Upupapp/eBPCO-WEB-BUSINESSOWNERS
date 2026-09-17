// Development only. `ng serve` forwards the API paths to a local instance so
// the portal is SAME-ORIGIN against it during development, which sidesteps
// two things a dev session does not need to deal with: a real cross-origin
// round trip, and remembering to run the local API with CORS origins that
// include whatever port `ng serve` happens to be on.
//
// Production does NOT use this same shape, deliberately. It sets
// EBPCO_API_BASE_URL to the API's real absolute URL (written into
// public/config.js at build time by write-runtime-config.mjs — see
// netlify.toml) and calls it CROSS-ORIGIN, allowed by the API's own CORS
// policy for exactly this portal's real deployed origin (`security.ts`,
// backend repo, reusing USER_PORTAL_BASE_URL as the allowlist). A same-origin
// gateway remains possible in production too, but is a separate deployment
// choice, not what this file's own approach is doing.
//
// Deliberately NOT done by setting EBPCO_API_BASE_URL to localhost in
// public/config.js. That file ships: a localhost value committed there would
// point the deployed portal at the citizen's own machine, where nothing
// answers, and the failure would look exactly like the API being down.
//
// ── Why this is .js, not .json, unlike the Admin Portal's proxy.conf.json ──
//
// Four of these prefixes are ALSO this app's own page routes: /applications,
// /documents, /notifications and /businesses are both real Angular routes
// (My Applications, My Documents, Notifications, Businesses) AND the exact
// URL path the citizen-facing list endpoints live at. A plain JSON proxy
// config can't tell "a browser navigated to this URL" from "the app fetched
// this URL" -- it forwards both to the backend. That meant hitting Refresh
// (or typing the URL, or opening a bookmark) on any of those four pages
// returned raw Problem+JSON instead of the Angular shell -- caught live
// while testing Stage 4 of the backend connection work, not in review.
//
// The Admin Portal's three prefixes (/auth, /me, /staff) happen not to
// collide with any of its own routes, so it never needed this.
//
// `bypass` is the standard fix: a top-level browser navigation always sends
// `Accept: text/html`; Angular's HttpClient never does.
//
// Returning a STRING rewrites the request's URL to that path and lets it
// fall through to Vite's own middleware chain (specifically its SPA
// html-fallback, which serves index.html for a GET with no matching static
// file) — this is NOT the same as webpack-dev-server's `bypass`, where
// returning `false` meant "skip proxying." Under Vite (which is what
// `@angular/build:dev-server` runs on), returning `false` from `bypass`
// answers the request with a bare 404 directly — confirmed by reading
// Vite's own proxy middleware source after this first attempt (returning
// false) broke every direct navigation to these four routes with a real
// 404 instead of the app shell.
function bypassBrowserNavigations(req) {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return '/index.html';
  }
}

const API_TARGET = 'http://localhost:3000';
const COMMON = { target: API_TARGET, secure: false, changeOrigin: true };

module.exports = {
  '/auth': COMMON,
  '/me': COMMON,
  '/requirements': COMMON,
  '/limits': COMMON,
  '/notification-preferences': COMMON,
  '/devices': COMMON,
  // These four collide with page routes of the same name — see above.
  '/applications': { ...COMMON, bypass: bypassBrowserNavigations },
  '/documents': { ...COMMON, bypass: bypassBrowserNavigations },
  '/notifications': { ...COMMON, bypass: bypassBrowserNavigations },
  '/businesses': { ...COMMON, bypass: bypassBrowserNavigations },
};
