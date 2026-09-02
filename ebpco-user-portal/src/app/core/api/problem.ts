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
export interface Problem {
  type?: string;
  title?: string;
  status?: number;
  /** The human-readable half. Prefer this for anything shown to a citizen. */
  detail?: string;
  instance?: string;
  correlationId?: string;
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
   */
  get citizenMessage(): string {
    if (this.problem?.detail) return this.problem.detail;
    if (this.status === 413) return 'That file is too large to upload. Try a file under about 750 KB.';
    if (this.status === 404) return 'We could not find that. It may not exist, or it may not be on your account.';
    if (this.status === 0) return 'We could not reach the Municipality’s system. Check your connection and try again.';
    return 'Something went wrong at the Municipality’s system. Please try again.';
  }
}

export function problemFrom(body: unknown, status: number): ApiError {
  const looksLikeProblem =
    !!body && typeof body === 'object' && ('detail' in body || 'title' in body || 'type' in body);
  return new ApiError(status, looksLikeProblem ? (body as Problem) : null, !looksLikeProblem);
}
