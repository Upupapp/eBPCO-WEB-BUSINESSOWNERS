import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CitizenApiClient, isOverResubmitLimit, newIdempotencyKey } from './citizen-api.client';
import { API_BASE_URL, ApiNotConfiguredError } from './api-config';
import { ApiError } from './problem';
import { CONTRACT_SAMPLES } from './contract-samples.fixture';

const BASE = 'https://api.example.gov.ph';
const APP = '00000000-0000-4000-8000-000000000000';

/**
 * Decodes the backend's OWN RECORDED RESPONSES — real bytes from the real
 * controllers over real PostgreSQL, copied from contract/response-samples.json.
 * A client tested against shapes we invented would prove only that we are
 * self-consistent.
 */
describe('CitizenApiClient against the recorded contract samples', () => {
  let api: CitizenApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: BASE }],
    });
    api = TestBed.inject(CitizenApiClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); });

  it('decodes a permit, keeping conditions as a list', () => {
    let got: unknown;
    api.getPermit(APP).subscribe((p) => (got = p));
    http.expectOne(`${BASE}/applications/${APP}/permit`).flush(CONTRACT_SAMPLES['applicant.applications.permit'].body);
    const p = got as { conditions: string[]; release: { status: string } | null; scope: string | null };
    expect(Array.isArray(p.conditions)).toBe(true);
    expect(p.conditions[0]).toContain('1.5m setback');
    expect(p.release?.status).toBe('Ready for Release');
  });

  it('treats release: null as a fact, not a missing value', () => {
    // Both branches are recorded server-side. Null means "not yet ready to
    // collect" — a client that reads it as "no data" contradicts a deliberate
    // answer.
    let got: { release: unknown } | undefined;
    api.getPermit(APP).subscribe((p) => (got = p));
    http.expectOne(`${BASE}/applications/${APP}/permit`)
      .flush(CONTRACT_SAMPLES['applicant.applications.permit.beforeRelease'].body);
    expect(got).toBeTruthy();
    expect('release' in (got as object)).toBe(true);   // present…
    expect(got!.release).toBeNull();                    // …and null
  });

  it('decodes documents as a bare array and keeps byteSize a STRING', () => {
    let got: { byteSize: unknown; reviewStatus: unknown }[] = [];
    api.listDocuments(APP).subscribe((d) => (got = d as never));
    http.expectOne(`${BASE}/applications/${APP}/documents`)
      .flush(CONTRACT_SAMPLES['applicant.applications.documents'].body);
    expect(Array.isArray(got)).toBe(true);
    // bigint column: a JSON number would lose precision, so it must stay a string.
    expect(typeof got[0].byteSize).toBe('string');
    // NULL MEANS NOBODY HAS LOOKED YET — never a pass.
    expect(got[0].reviewStatus).toBeNull();
  });

  it('sends the Idempotency-Key header on resubmit', () => {
    const key = newIdempotencyKey();
    api.resubmitDocument(APP, APP, { fileName: 'f.pdf', label: 'Lot plan', contentBase64: 'AAA' }, key).subscribe();
    const req = http.expectOne(`${BASE}/applications/${APP}/documents/${APP}/resubmit`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe(key);
    req.flush(CONTRACT_SAMPLES['applicant.applications.resubmitDocument'].body, { status: 201, statusText: 'Created' });
  });

  it('surfaces a problem+json detail to the citizen', () => {
    let err: ApiError | undefined;
    api.getPermit(APP).subscribe({ error: (e) => (err = e) });
    http.expectOne(`${BASE}/applications/${APP}/permit`)
      .flush(CONTRACT_SAMPLES['problem.notFound'].body, { status: 404, statusText: 'Not Found' });
    expect(err).toBeInstanceOf(ApiError);
    expect(err!.bare).toBe(false);
    expect(err!.citizenMessage.length).toBeGreaterThan(0);
  });

  it('survives a BARE 413, which is not a problem document', () => {
    // The adapter rejects an oversized body before any controller runs, so
    // there is no `detail` to read. Code that assumed one would show nothing.
    let err: ApiError | undefined;
    api.resubmitDocument(APP, APP, { fileName: 'f.pdf', label: 'L', contentBase64: 'A' }, newIdempotencyKey())
      .subscribe({ error: (e) => (err = e) });
    http.expectOne(`${BASE}/applications/${APP}/documents/${APP}/resubmit`)
      .flush('Payload Too Large', { status: 413, statusText: 'Payload Too Large' });
    expect(err!.bare).toBe(true);
    expect(err!.citizenMessage).toContain('too large');
  });
});

describe('CitizenApiClient when no API is configured', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => TestBed.resetTestingModule());

  // EVERY operation must refuse, not just the one that happened to be tested.
  // A first draft of this suite covered getPermit only, so removing the guard
  // from resubmitDocument changed nothing — the guard was real and the test was
  // blind to it.
  it('refuses on every operation rather than resolving to nothing', () => {
    const api = TestBed.inject(CitizenApiClient);
    expect(api.configured).toBe(false);
    const errs: unknown[] = [];
    api.getPermit(APP).subscribe({ error: (e) => errs.push(e) });
    api.listDocuments(APP).subscribe({ error: (e) => errs.push(e) });
    api
      .resubmitDocument(APP, APP, { fileName: 'f.pdf', label: 'L', contentBase64: 'A' }, newIdempotencyKey())
      .subscribe({ error: (e) => errs.push(e) });
    expect(errs.length).toBe(3);
    for (const e of errs) expect(e).toBeInstanceOf(ApiNotConfiguredError);
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});

describe('Resubmission size ceiling', () => {
  it('catches an oversized file before the upload is spent', () => {
    // base64 inflates by a third against a 1MB body limit, so ~750KB of file.
    expect(isOverResubmitLimit({ size: 700_000 })).toBe(false);
    expect(isOverResubmitLimit({ size: 800_000 })).toBe(true);
  });
});
