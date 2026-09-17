import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { API_BASE_URL, ApiNotConfiguredError, RESUBMIT_MAX_FILE_BYTES } from './api-config';
import { problemFrom } from './problem';
import {
  ApplicationDocumentResponse,
  ApplicationListResponse,
  ApplicationSummary,
  BusinessListResponse,
  BusinessSummary,
  ErasureReceipt,
  ExportContentResult,
  ExportRequestResult,
  ExportStatusResult,
  LimitsResponse,
  DocumentHistoryEntry,
  NotificationFeedResponse,
  PaymentHistoryEntry,
  PermitResponse,
  RequirementsChecklistResponse,
  ResubmitRequest,
  ResubmitResult,
  SubmitApplicationRequest,
  SubmitBusinessRequest,
  SubmitPaymentRequest,
  SubmitPaymentResult,
  TimelineEntryResponse,
  UploadDocumentRequest,
  UploadDocumentResult,
} from './citizen-api.models';
import { MeResponse, ProfileRectification, RectificationResult } from './citizen-profile';

/**
 * Client for the citizen endpoints.
 *
 * All three require a citizen bearer token and all three answer **404 for an
 * application that is not the caller's — the same 404 as one that does not
 * exist.** That is deliberate: a reference number that resolved differently
 * would confirm that a neighbour has applied. **Do not "improve" the UI by
 * distinguishing them**; rendering "you do not have access" where the server
 * said "not found" leaks exactly what the server refused to.
 */
@Injectable({ providedIn: 'root' })
export class CitizenApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * True when a base URL has been configured.
   *
   * `=== null`, not a truthiness check: '' is a real, configured value
   * meaning same-origin (see api-config.ts), and `!!''` is false in
   * JavaScript. A truthiness check here silently treated every same-origin
   * deployment as unconfigured — caught wiring this client to a live proxy
   * for the first time, where every call fell into the "unconfigured" branch
   * despite config.js having set EBPCO_API_BASE_URL = ''.
   */
  get configured(): boolean {
    return this.baseUrl !== null;
  }

  /**
   * `GET /applications/{id}/permit`
   *
   * 404 with a `detail` of "No permit has been issued for this application yet"
   * is a THIRD meaning of that status and is not an error to hide: an applicant
   * reading their own application is entitled to know it simply is not ready.
   */
  getPermit(applicationId: string): Observable<PermitResponse> {
    return this.get<PermitResponse>(`/applications/${encodeURIComponent(applicationId)}/permit`);
  }

  /**
   * `GET /applications` — the citizen's own applications, newest-updated
   * first, server-scoped by the token (never a parameter this client could
   * get wrong). `{ data, nextCursor }`, not a bare array — `nextCursor` is
   * always null today (the server has no cursor paging yet, only `limit`).
   */
  listApplications(limit?: number): Observable<ApplicationListResponse> {
    const query = limit === undefined ? '' : `?limit=${encodeURIComponent(String(limit))}`;
    return this.get<ApplicationListResponse>(`/applications${query}`);
  }

  /**
   * `GET /applications/{id}` — one application. 404 for "not yours" and for
   * "does not exist" alike, same reasoning as `getPermit`.
   */
  getApplication(applicationId: string): Observable<ApplicationSummary> {
    return this.get<ApplicationSummary>(`/applications/${encodeURIComponent(applicationId)}`);
  }

  /**
   * `GET /applications/{id}/timeline` — a bare array, the application's own
   * history in the applicant's vocabulary (no internal office/from-status).
   */
  getTimeline(applicationId: string): Observable<TimelineEntryResponse[]> {
    return this.get<TimelineEntryResponse[]>(`/applications/${encodeURIComponent(applicationId)}/timeline`);
  }

  /**
   * `GET /applications/{id}/payments` — every real payment this citizen has
   * submitted against this application, oldest first. The direct answer to
   * "did my payment go through" — the aggregate `payment.status` on
   * `ApplicationSummary` has no per-attempt detail (OR number, who verified
   * it, why one was rejected) and no way to show a rejection distinctly from
   * "never submitted".
   */
  getPayments(applicationId: string): Observable<PaymentHistoryEntry[]> {
    return this.get<PaymentHistoryEntry[]>(`/applications/${encodeURIComponent(applicationId)}/payments`);
  }

  /**
   * `GET /documents/me` — every document this citizen has ever uploaded,
   * attached or not (broadened; used to return only unattached ones).
   */
  getMyDocuments(): Observable<DocumentHistoryEntry[]> {
    return this.get<DocumentHistoryEntry[]>('/documents/me');
  }

  /**
   * `GET /documents/{id}/content` — a short-lived signed download URL, not
   * the bytes. Reuse-from-library spends this to fetch what a document
   * actually contains before re-uploading it against a new application:
   * there is no "attach by reference" route, only "upload fresh bytes".
   */
  getDocumentContent(documentId: string): Observable<{ url: string }> {
    return this.get<{ url: string }>(`/documents/${encodeURIComponent(documentId)}/content`);
  }

  /**
   * `GET /applications/{id}/requirements` — the checklist snapshot taken at
   * FILING, not the live catalogue: a filed application cannot become
   * non-compliant because the LGU later changed what it asks for.
   */
  getRequirements(applicationId: string): Observable<RequirementsChecklistResponse> {
    return this.get<RequirementsChecklistResponse>(`/applications/${encodeURIComponent(applicationId)}/requirements`);
  }

  /**
   * `GET /me` — the profile the Municipality actually holds.
   *
   * Every field is nullable and null means NOT RECORDED, not blank: nobody has
   * ever been asked for an address, so a null is the absence of a question, not
   * a citizen's answer.
   */
  getMe(): Observable<MeResponse> {
    return this.get<MeResponse>('/me');
  }

  /**
   * `PATCH /me` — the citizen's right to correct what the LGU holds.
   *
   * The body is a PARTIAL and the partiality is load-bearing: absent leaves a
   * field alone, `null` clears it. See buildRectification, which is where that
   * distinction is actually made.
   *
   * The schema is `.strict()`, so an unknown field is a 400 rather than being
   * silently dropped — which is the whole point. `email` is refused (400) and
   * not merely ignored: it is the sign-in identity, so changing it is a
   * transfer of who can reach the account rather than a correction, and it
   * needs its own request/confirm flow against the new address. Do NOT put an
   * email field on this screen.
   */
  patchMe(patch: ProfileRectification): Observable<RectificationResult> {
    if (this.baseUrl === null) return throwError(() => new ApiNotConfiguredError());
    return this.http
      .patch<RectificationResult>(`${this.baseUrl}/me`, patch)
      .pipe(catchError((e) => throwError(() => this.toApiError(e))));
  }

  /**
   * `GET /applications/{id}/documents`
   *
   * A BARE ARRAY, not an envelope. An empty array is a true answer — "your
   * application, nothing uploaded" — and is a different fact from 404.
   */
  listDocuments(applicationId: string): Observable<ApplicationDocumentResponse[]> {
    return this.get<ApplicationDocumentResponse[]>(
      `/applications/${encodeURIComponent(applicationId)}/documents`,
    );
  }

  /**
   * `POST /applications/{id}/documents/{documentId}/resubmit`
   *
   * `idempotencyKey` is REQUIRED and is taken as an argument rather than
   * generated here, because retrying must reuse the SAME key to replay the same
   * answer instead of creating a second document — and a caller that cannot
   * hold the key cannot retry safely.
   *
   * **The file is part of the fingerprint.** The same key carrying a different
   * replacement is refused 409, so never reuse a key across files: one key per
   * (document, file) attempt, reused only for retries of that attempt.
   */
  resubmitDocument(
    applicationId: string,
    documentId: string,
    body: ResubmitRequest,
    idempotencyKey: string,
  ): Observable<ResubmitResult> {
    if (this.baseUrl === null) return throwError(() => new ApiNotConfiguredError());
    const url =
      `${this.baseUrl}/applications/${encodeURIComponent(applicationId)}` +
      `/documents/${encodeURIComponent(documentId)}/resubmit`;
    return this.http
      .post<ResubmitResult>(url, body, { headers: { 'Idempotency-Key': idempotencyKey } })
      .pipe(catchError((e) => throwError(() => this.toApiError(e))));
  }

  /**
   * `POST /applications` — file a new application.
   *
   * `Idempotency-Key` is REQUIRED (same reasoning as `resubmitDocument`):
   * taken as an argument, never generated here, so a retry replays the same
   * filing instead of creating a second one. Returns the filed application in
   * the same shape `GET /applications/{id}` would — the server's own
   * `submit()` reads it back through the applicant projection rather than
   * building a partial response, so this client does not have to either.
   */
  fileApplication(body: SubmitApplicationRequest, idempotencyKey: string): Observable<ApplicationSummary> {
    return this.post<ApplicationSummary>('/applications', body, idempotencyKey);
  }

  /**
   * `POST /applications/{id}/payments` — submit proof of payment against an
   * already-issued Order of Payment. `no-order-of-payment` (422) and
   * `already settled`-type refusals (409) are surfaced via the server's own
   * `detail`, not guessed here.
   */
  submitPayment(
    applicationId: string,
    body: SubmitPaymentRequest,
    idempotencyKey: string,
  ): Observable<SubmitPaymentResult> {
    return this.post<SubmitPaymentResult>(
      `/applications/${encodeURIComponent(applicationId)}/payments`,
      body,
      idempotencyKey,
    );
  }

  /**
   * `POST /applications/{id}/cancel` — withdraw an application.
   *
   * Only accepted before an Order of Payment exists (E-4) — the server
   * enforces this, not this client; a refusal here surfaces the server's own
   * explanation (`ApiError.citizenMessage`) rather than a client-guessed one.
   */
  cancelApplication(
    applicationId: string,
    body: { reason?: string },
    idempotencyKey: string,
  ): Observable<{ status: string; version: number }> {
    return this.post<{ status: string; version: number }>(
      `/applications/${encodeURIComponent(applicationId)}/cancel`,
      body,
      idempotencyKey,
    );
  }

  /**
   * `GET /limits` — public, no bearer token attached even when signed in
   * (see `citizen-auth.interceptor.ts`; harmless either way, since this
   * route ignores auth entirely). The real, live ceiling — see
   * `UploadLimitsService`, which is what actually calls this.
   */
  getLimits(): Observable<LimitsResponse> {
    return this.get<LimitsResponse>('/limits');
  }

  /**
   * `POST /documents` — upload a file, optionally attached to an
   * application/requirement directly. No Idempotency-Key: unlike the
   * applicant-write routes, this one is not in `applicant-write.controller
   * .ts` and does not require one.
   */
  uploadDocument(body: UploadDocumentRequest): Observable<UploadDocumentResult> {
    if (this.baseUrl === null) return throwError(() => new ApiNotConfiguredError());
    return this.http
      .post<UploadDocumentResult>(`${this.baseUrl}/documents`, body)
      .pipe(catchError((e) => throwError(() => this.toApiError(e))));
  }

  /**
   * `POST /me/export` — RA 10173 §18. 202, not the file: an export reads
   * everything the applicant has, which is why this returns a request id to
   * poll rather than blocking on it. Pressing the button twice returns the
   * SAME request while one is queued, not a second one.
   */
  requestExport(): Observable<ExportRequestResult> {
    if (this.baseUrl === null) return throwError(() => new ApiNotConfiguredError());
    return this.http
      .post<ExportRequestResult>(`${this.baseUrl}/me/export`, {})
      .pipe(catchError((e) => throwError(() => this.toApiError(e))));
  }

  /** `GET /me/export/{requestId}` — where a request has got to. Polled by the caller, not pushed. */
  getExportStatus(requestId: string): Observable<ExportStatusResult> {
    return this.get<ExportStatusResult>(`/me/export/${encodeURIComponent(requestId)}`);
  }

  /** `GET /me/export/{requestId}/content` — a short-lived signed URL, minted fresh on each call. */
  getExportContent(requestId: string): Observable<ExportContentResult> {
    return this.get<ExportContentResult>(`/me/export/${encodeURIComponent(requestId)}/content`);
  }

  /**
   * `DELETE /me` — RA 10173 §16(e). Not idempotency-keyed: erasing an
   * already-erased account returns the same receipt, so a replay cannot
   * cause a second erasure.
   */
  eraseAccount(): Observable<ErasureReceipt> {
    if (this.baseUrl === null) return throwError(() => new ApiNotConfiguredError());
    return this.http
      .delete<ErasureReceipt>(`${this.baseUrl}/me`)
      .pipe(catchError((e) => throwError(() => this.toApiError(e))));
  }

  /**
   * `GET /businesses` — the citizen's own businesses, `{ data }` not a bare
   * array (matching the applications list's own envelope shape).
   */
  listBusinesses(): Observable<BusinessListResponse> {
    return this.get<BusinessListResponse>('/businesses');
  }

  /**
   * `POST /businesses` — register a business. No Idempotency-Key: not in
   * `applicant-write.controller.ts`, and there is genuinely no route to
   * change or remove one once created (C-5, write-once) — see
   * `business.store.ts`'s own doc comment on why an Edit action must not be
   * offered once this is wired for real.
   */
  registerBusiness(body: SubmitBusinessRequest): Observable<BusinessSummary> {
    if (this.baseUrl === null) return throwError(() => new ApiNotConfiguredError());
    return this.http
      .post<BusinessSummary>(`${this.baseUrl}/businesses`, body)
      .pipe(catchError((e) => throwError(() => this.toApiError(e))));
  }

  /** `GET /notifications` — the citizen's own feed, newest first. */
  getNotifications(limit?: number): Observable<NotificationFeedResponse> {
    const query = limit === undefined ? '' : `?limit=${encodeURIComponent(String(limit))}`;
    return this.get<NotificationFeedResponse>(`/notifications${query}`);
  }

  /**
   * `POST /notifications/{id}/read` — no Idempotency-Key: marking an
   * already-read notification read again is naturally idempotent, nothing
   * to replay-protect.
   */
  markNotificationRead(notificationId: string): Observable<{ read: boolean }> {
    if (this.baseUrl === null) return throwError(() => new ApiNotConfiguredError());
    return this.http
      .post<{ read: boolean }>(`${this.baseUrl}/notifications/${encodeURIComponent(notificationId)}/read`, {})
      .pipe(catchError((e) => throwError(() => this.toApiError(e))));
  }

  private get<T>(path: string): Observable<T> {
    if (this.baseUrl === null) return throwError(() => new ApiNotConfiguredError());
    return this.http.get<T>(`${this.baseUrl}${path}`).pipe(catchError((e) => throwError(() => this.toApiError(e))));
  }

  private post<T>(path: string, body: unknown, idempotencyKey: string): Observable<T> {
    if (this.baseUrl === null) return throwError(() => new ApiNotConfiguredError());
    return this.http
      .post<T>(`${this.baseUrl}${path}`, body, { headers: { 'Idempotency-Key': idempotencyKey } })
      .pipe(catchError((e) => throwError(() => this.toApiError(e))));
  }

  private toApiError(e: unknown) {
    if (e instanceof HttpErrorResponse) return problemFrom(e.error, e.status);
    return e;
  }
}

/**
 * One key per (document, file) attempt. Reuse it to RETRY the same upload;
 * never reuse it for a different file — the server refuses that 409.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * An OPTIMISTIC pre-check, so a citizen is told before spending an upload on a
 * file that cannot land.
 *
 * `limit` is passed in because it echoes the server's configurable
 * `BODY_LIMIT_BYTES`, which the backend has filed as needing to be raised for
 * production. **This is not the authority — the server's 413 is**, and the
 * client handles that regardless of what this returns.
 */
export function isOverResubmitLimit(file: { size: number }, limit: number): boolean {
  return file.size > limit;
}
