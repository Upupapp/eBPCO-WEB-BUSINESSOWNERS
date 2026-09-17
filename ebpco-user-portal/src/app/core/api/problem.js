export class ApiError extends Error {
    status;
    problem;
    bare;
    constructor(status, problem, 
    /** True when the body was not a problem document — a bare 413, a proxy page, an empty body. */
    bare) {
        super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}.`);
        this.status = status;
        this.problem = problem;
        this.bare = bare;
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
    get citizenMessage() {
        if (this.problem?.detail)
            return this.problem.detail;
        if (this.status === 413)
            return 'That file is too large to upload. Try a file under about 750 KB.';
        if (this.status === 404)
            return 'We could not find that. It may not exist, or it may not be on your account.';
        if (this.status === 0)
            return 'We could not reach the Municipality’s system. Check your connection and try again.';
        if (this.problem?.title)
            return this.problem.title;
        return 'Something went wrong at the Municipality’s system. Please try again.';
    }
}
export function problemFrom(body, status) {
    const looksLikeProblem = !!body && typeof body === 'object' && ('detail' in body || 'title' in body || 'type' in body);
    if (!looksLikeProblem)
        return new ApiError(status, null, true);
    const raw = body;
    return new ApiError(status, { ...raw, fieldErrors: raw.fieldErrors ?? raw.errors }, false);
}
