import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DocumentResubmissionService, FileTooLargeError, toBase64 } from './document-resubmission.service';
import { API_BASE_URL } from './api-config';
import { UploadLimitsService } from './upload-limits.service';
import { CONTRACT_SAMPLES } from './contract-samples.fixture';

const BASE = 'https://api.example.gov.ph';
const APP = '00000000-0000-4000-8000-000000000000';
const DOC = '11111111-1111-4111-8111-111111111111';

const file = (name: string, bytes: number[], lastModified = 1) =>
  new File([new Uint8Array(bytes)], name, { type: 'application/pdf', lastModified });

describe('DocumentResubmission — the idempotency key lifecycle', () => {
  let svc: DocumentResubmissionService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: BASE }],
    });
    svc = TestBed.inject(DocumentResubmissionService);
  });
  afterEach(() => TestBed.resetTestingModule());

  it('reuses the key for a RETRY of the same file, so a flaky connection cannot create two documents', () => {
    const f = file('lot-plan.pdf', [1, 2, 3]);
    expect(svc.keyFor(DOC, f)).toBe(svc.keyFor(DOC, f));
  });

  it('issues a NEW key for a different file, because the file is part of the server fingerprint', () => {
    // "the same key carrying a different replacement is refused 409 — never
    // reuse a key across files."
    const first = svc.keyFor(DOC, file('lot-plan.pdf', [1, 2, 3]));
    expect(svc.keyFor(DOC, file('lot-plan-v2.pdf', [1, 2, 3]))).not.toBe(first);      // different name
    expect(svc.keyFor(DOC, file('lot-plan.pdf', [9, 9, 9, 9]))).not.toBe(first);      // different size
    expect(svc.keyFor(DOC, file('lot-plan.pdf', [1, 2, 3], 999))).not.toBe(first);    // different mtime
  });

  it('issues a different key per document, even for the same file', () => {
    const f = file('id.pdf', [1]);
    expect(svc.keyFor(DOC, f)).not.toBe(svc.keyFor('other-doc', f));
  });

  it('issues a UUID, which the contract requires', () => {
    expect(svc.keyFor(DOC, file('a.pdf', [1])))
      .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe('DocumentResubmission — refusing before the wire', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(),
                  { provide: API_BASE_URL, useValue: BASE },
                  // The real limit now comes from UploadLimitsService (a live
                  // signal fed by GET /limits), not a static injection token
                  // — stub the service itself rather than a token it no
                  // longer reads.
                  { provide: UploadLimitsService, useValue: { maxFileBytes: () => 1000 } }],
    });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('rejects an oversized file WITHOUT sending or encoding it', () => {
    const svc = TestBed.inject(DocumentResubmissionService);
    const http = TestBed.inject(HttpTestingController);
    let err: unknown;
    svc.resubmit(APP, DOC, 'Lot plan', file('big.pdf', new Array(2000).fill(1)))
      .subscribe({ error: (e) => (err = e) });
    expect(err).toBeInstanceOf(FileTooLargeError);
    // Nothing was sent: encoding a file only to have it refused wastes the
    // citizen's time and their phone's memory.
    http.expectNone(() => true);
  });
});

describe('DocumentResubmission — what the citizen is told', () => {
  let svc: DocumentResubmissionService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: BASE }],
    });
    svc = TestBed.inject(DocumentResubmissionService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => TestBed.resetTestingModule());

  /**
   * Encoding is genuinely async (File.arrayBuffer), so the request appears some
   * ticks later. Waiting a fixed number of microtasks is a guess that fails on
   * a slower machine; this waits for the request itself.
   */
  async function waitForRequest() {
    for (let i = 0; i < 50; i++) {
      // match() REMOVES what it matches, so it cannot be used to peek: an
      // earlier version of this loop consumed the very request it was waiting
      // for, and the expectOne after it then found none.
      const found = http.match(() => true);
      if (found.length) return found[0];
      await new Promise((r) => setTimeout(r, 0));
    }
    throw new Error('no request was issued');
  }

  async function sendAndFail(body: unknown, status: number): Promise<unknown> {
    let err: unknown;
    svc.resubmit(APP, DOC, 'Lot plan', file('a.pdf', [1, 2, 3])).subscribe({ error: (e) => (err = e) });
    (await waitForRequest()).flush(body as never, { status, statusText: 'x' });
    return err;
  }

  it('passes a 409 detail through rather than saying "conflict"', async () => {
    // The contract: 409 is "already replaced, already accepted by an officer,
    // or the key was used for a different request" — and detail says which.
    const err = await sendAndFail(
      { title: 'Conflict', status: 409, detail: 'This document has already been accepted by an officer.' }, 409);
    expect(svc.explain(err)).toContain('already been accepted by an officer');
  });

  it('says a 422 is a virus check, not a rejection by the office', async () => {
    const msg = svc.explain(await sendAndFail({ detail: 'x' }, 422));
    expect(msg).toContain('virus check');
    expect(msg).not.toMatch(/reject|officer/i);
  });

  it('still says something useful for a BARE 409 with no detail', async () => {
    expect(svc.explain(await sendAndFail('', 409))).toContain('already have been replaced or accepted');
  });

  it('returns removedMetadata, which the citizen is entitled to know about', async () => {
    // "a photograph of a site carries its coordinates, and an applicant is
    // entitled to know the LGU removed them."
    let result: { removedMetadata: string[] } | undefined;
    svc.resubmit(APP, DOC, 'Site photo', file('site.jpg', [1])).subscribe((r) => (result = r));
    (await waitForRequest()).flush(
      { ...CONTRACT_SAMPLES['applicant.applications.resubmitDocument'].body, removedMetadata: ['GPS', 'EXIF'] },
      { status: 201, statusText: 'Created' },
    );
    expect(result?.removedMetadata).toEqual(['GPS', 'EXIF']);
  });
});

describe('base64 encoding', () => {
  it('encodes without a data: prefix, which the contract does not want', async () => {
    expect(await toBase64(file('a.bin', [72, 101, 108, 108, 111]))).toBe('SGVsbG8=');
  });

  it('handles a file large enough to overflow a naive spread', async () => {
    const big = file('big.bin', new Array(200_000).fill(65));
    const encoded = await toBase64(big);
    expect(encoded.length).toBeGreaterThan(200_000);
    expect(encoded.startsWith('QUFB')).toBe(true);
  });
});
