import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { API_BASE_URL, ApiNotConfiguredError, RESUBMIT_MAX_FILE_BYTES } from './api-config';
import { problemFrom } from './problem';
import {
  ApplicationDocumentResponse,
  PermitResponse,
  ResubmitRequest,
  ResubmitResult,
} from './citizen-api.models';

/**
 * Client for the three citizen endpoints.
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

  /** True when a base URL has been configured. False in this build. */
  get configured(): boolean {
    return !!this.baseUrl;
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
    if (!this.baseUrl) return throwError(() => new ApiNotConfiguredError());
    const url =
      `${this.baseUrl}/applications/${encodeURIComponent(applicationId)}` +
      `/documents/${encodeURIComponent(documentId)}/resubmit`;
    return this.http
      .post<ResubmitResult>(url, body, { headers: { 'Idempotency-Key': idempotencyKey } })
      .pipe(catchError((e) => throwError(() => this.toApiError(e))));
  }

  private get<T>(path: string): Observable<T> {
    if (!this.baseUrl) return throwError(() => new ApiNotConfiguredError());
    return this.http.get<T>(`${this.baseUrl}${path}`).pipe(catchError((e) => throwError(() => this.toApiError(e))));
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
