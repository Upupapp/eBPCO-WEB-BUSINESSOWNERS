import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { CitizenApiClient, isOverResubmitLimit } from './citizen-api.client';
import { RESUBMIT_MAX_FILE_BYTES } from './api-config';
import { ResubmitResult } from './citizen-api.models';
import { ApiError } from './problem';

/** Refused before anything is sent, so the citizen is not made to wait for a 413. */
export class FileTooLargeError extends Error {
  constructor(readonly size: number, readonly limit: number) {
    super(`That file is ${Math.round(size / 1000)} KB. The Municipality's system accepts up to about ${Math.round(limit / 1000)} KB.`);
    this.name = 'FileTooLargeError';
  }
}

/**
 * Replacing a rejected document.
 *
 * THE IDEMPOTENCY KEY IS THE WHOLE DESIGN. The contract requires one, and:
 * *"A retry with the same key replays the identical 201 body rather than
 * creating a second document. The FILE is part of the fingerprint, so the same
 * key carrying a different replacement is refused 409 — never reuse a key
 * across files."*
 *
 * So a key must be **stable across retries of one attempt** and **new for a
 * different file**. Generating one per click would create duplicate documents
 * on a flaky connection; holding one forever would 409 the moment the citizen
 * picks a better scan. This service keys them on (document, file identity), so
 * both behaviours fall out without the caller thinking about it.
 */
@Injectable({ providedIn: 'root' })
export class DocumentResubmissionService {
  private readonly api = inject(CitizenApiClient);
  private readonly limit = inject(RESUBMIT_MAX_FILE_BYTES);

  /** (documentId + file identity) -> the key issued for that attempt. */
  private readonly keys = new Map<string, string>();

  /**
   * A file's identity for key purposes. Name, size and mtime is enough to tell
   * "the same file again" from "a different file" without reading the bytes —
   * and reading them to hash would mean loading it twice.
   */
  private fingerprint(documentId: string, file: File): string {
    return `${documentId}|${file.name}|${file.size}|${file.lastModified}`;
  }

  /** The key for this (document, file). Stable on retry, new for a different file. */
  keyFor(documentId: string, file: File): string {
    const fp = this.fingerprint(documentId, file);
    const existing = this.keys.get(fp);
    if (existing) return existing;
    const key = crypto.randomUUID();
    this.keys.set(fp, key);
    return key;
  }

  /** Whether this file can be sent at all. Checked BEFORE encoding, not after. */
  tooLarge(file: File): boolean {
    return isOverResubmitLimit(file, this.limit);
  }

  resubmit(applicationId: string, documentId: string, label: string, file: File): Observable<ResubmitResult> {
    // Size first: base64-encoding a 5MB file to then reject it wastes the
    // citizen's time and their phone's memory for nothing.
    if (this.tooLarge(file)) return throwError(() => new FileTooLargeError(file.size, this.limit));

    const key = this.keyFor(documentId, file);
    return from(toBase64(file)).pipe(
      switchMap((contentBase64) =>
        this.api.resubmitDocument(applicationId, documentId, { fileName: file.name, label, contentBase64 }, key),
      ),
    );
  }

  /**
   * What to tell the citizen. A 409 is not one thing: the contract says it is
   * "already replaced, already accepted by an officer, or the Idempotency-Key
   * was used for a different request", and that `detail` says which. Showing a
   * bare "conflict" for any of those tells them nothing about what to do.
   */
  explain(error: unknown): string {
    if (error instanceof FileTooLargeError) return error.message;
    if (error instanceof ApiError) {
      if (error.status === 422) {
        return 'That file did not pass the virus check and was not stored. Try a different copy.';
      }
      if (error.status === 409 && !error.problem?.detail) {
        return 'This document cannot be replaced — it may already have been replaced or accepted.';
      }
      return error.citizenMessage;
    }
    return 'We could not send that replacement. Please try again.';
  }
}

/** Base64 without the data: prefix, which the contract does not want. */
export async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  // Chunked: a single spread of a large array overflows the call stack.
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
