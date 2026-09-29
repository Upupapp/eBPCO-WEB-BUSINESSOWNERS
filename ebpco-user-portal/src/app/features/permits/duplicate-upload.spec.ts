import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApplicationWizardPage } from './application-wizard.page';
import { AuthService } from '../../core/session/auth.service';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { FakeCitizenIdentityApi } from '../../core/testing/fake-citizen-identity-api';
import { RequirementDocument } from '../../core/domain/requirements-catalog';
import { UploadDocumentRequest, UploadDocumentResult } from '../../core/api/citizen-api.models';
import { duplicateOf, problemFrom } from '../../core/api/problem';

/**
 * The same file twice (owner request, 2026-09-29): the server refuses a second
 * upload of a file the citizen already has and names their copy. In the
 * wizard the citizen's intent is plain, so their copy is used for them.
 */
const DUPLICATE = {
  type: '/problems/conflict', title: 'You already have this file', status: 409,
  detail: 'You already uploaded this file ("valid-id.pdf"). Reuse it from My Documents instead of uploading it again.',
  reason: 'duplicate-document',
  existingDocument: { id: 'doc-existing', fileName: 'valid-id.pdf', label: 'Valid ID', applicationReference: null },
};

describe('duplicateOf', () => {
  it('names the copy the citizen already has', () => {
    expect(duplicateOf(problemFrom(DUPLICATE, 409))?.id).toBe('doc-existing');
  });

  it('is null for any other refusal', () => {
    expect(duplicateOf(problemFrom({ ...DUPLICATE, reason: 'something-else' }, 409))).toBeNull();
    expect(duplicateOf(problemFrom({ detail: 'Not yours.' }, 404))).toBeNull();
    expect(duplicateOf(new Error('boom'))).toBeNull();
  });
});

describe('The wizard, given a file the citizen already has', () => {
  const req: RequirementDocument = { id: 'valid-id', label: 'Valid ID', required: true };
  let page: ApplicationWizardPage;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: CitizenIdentityApi, useClass: FakeCitizenIdentityApi },
      ],
    });
    await TestBed.inject(AuthService).login('juan.delacruz@example.com', 'Password1');
    page = TestBed.createComponent(ApplicationWizardPage).componentInstance;
  });
  afterEach(() => TestBed.resetTestingModule());

  it('uses their copy instead of refusing, and says so', async () => {
    const sent: UploadDocumentRequest[] = [];
    const api = (page as unknown as { api: { uploadDocument: (b: UploadDocumentRequest) => Observable<UploadDocumentResult> } }).api;
    vi.spyOn(api, 'uploadDocument').mockImplementation((body: UploadDocumentRequest) => {
      sent.push(body);
      return body.reuseOf
        ? of({ documentId: 'doc-copy', status: 'Approved', removedMetadata: [] })
        : throwError(() => problemFrom(DUPLICATE, 409));
    });
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 1])], 'id-again.pdf', { type: 'application/pdf' });

    await (page as unknown as { uploadReal(d: RequirementDocument, f: File): Promise<void> }).uploadReal(req, file);

    expect(sent.map((b) => b.reuseOf ?? null)).toEqual([null, 'doc-existing']);
    expect((page as unknown as { uploadedDocumentIds(): Record<string, string> }).uploadedDocumentIds())
      .toEqual({ 'valid-id': 'doc-copy' });
    expect((page as unknown as { error(): string | null }).error()).toBeFalsy();
  });
});
