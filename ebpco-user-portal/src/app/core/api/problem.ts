/**
 * RFC 9457 `application/problem+json`, which is what all three citizen
 * endpoints return for every non-2xx EXCEPT one.
 *
 * THE EXCEPTION MATTERS. A resubmission over the body limit answers a **bare
 * 413 that is not a problem document** — the HTTP adapter rejects it before any
 * controller runs. Code that assumes every error has a `detail` will read
 * `undefined` and show a citizen nothing at all, which is why `fromResponse`
 * below never assumes.
 */
export interface FieldError {
  /** JSON Pointer into the request body. */
  readonly pointer: string;
  readonly message: string;
}

export interface Problem {
  type?: string;
  title?: string;
  status?: number;
  /** The human-readable half. Prefer this for anything shown to a citizen. */
  detail?: string;
  instance?: string;
  correlationId?: string;
  /**
   * The server's own field is `errors` (see the Admin Portal's `problem.ts`,
   * which hit this same mismatch first: the wire never sent `fieldErrors`,
   * only `errors`). `fieldErrors` stays the name used on this side of the
   * boundary — `problemFrom` below is where the rename happens.
   */
  fieldErrors?: readonly FieldError[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: Problem | null,
    /** True when the body was not a problem document — a bare 413, a proxy page, an empty body. */
    readonly bare: boolean,
  ) {
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}.`);
    this.name = 'ApiError';
  }

  /**
   * What to put in front of a citizen. Never the status code alone: "413" tells
   * them nothing, and the bare-413 case has no server text to fall back on.
   *
   * `title` is checked before the generic catch-all, not after: a 401 for a
   * wrong password carries no `detail` but DOES carry a real, written-for-a-
   * reader `title` ("Check your email and password and try again" — see
   * auth.controller.ts's `token()`). Skipping straight to the generic
   * fallback for every status this method does not special-case would show
   * that generic line even when the server already wrote a better one —
   * caught wiring the real login flow, where this was the actual error path
   * for a wrong password, the single most common sign-in failure.
   */
  get citizenMessage(): string {
    if (this.problem?.detail) return this.problem.detail;
    if (this.status === 413) return 'That file is too large to upload. Try a file under about 750 KB.';
    if (this.status === 404) return 'We could not find that. It may not exist, or it may not be on your account.';
    if (this.status === 0) return 'We could not reach the Municipality’s system. Check your connection and try again.';
    if (this.problem?.title) return this.problem.title;
    return 'Something went wrong at the Municipality’s system. Please try again.';
  }
}

export function problemFrom(body: unknown, status: number): ApiError {
  const looksLikeProblem =
    !!body && typeof body === 'object' && ('detail' in body || 'title' in body || 'type' in body);
  if (!looksLikeProblem) return new ApiError(status, null, true);
  const raw = body as Problem & { errors?: readonly FieldError[] };
  return new ApiError(status, { ...raw, fieldErrors: raw.fieldErrors ?? raw.errors }, false);
}
