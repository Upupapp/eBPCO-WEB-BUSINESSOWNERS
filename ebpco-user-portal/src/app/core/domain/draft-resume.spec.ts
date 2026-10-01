import { resumeStep } from './draft-resume';

describe('resumeStep — where a saved Draft reopens', () => {
  it('opens on the first step when the business or permit reference is not settled', () => {
    expect(resumeStep({ applicantDone: false, detailsDone: true, documentsDone: true })).toBe(1);
  });

  it('opens on Details when only the first step is done', () => {
    expect(resumeStep({ applicantDone: true, detailsDone: false, documentsDone: false })).toBe(2);
  });

  it('opens on Documents while a required document is missing', () => {
    expect(resumeStep({ applicantDone: true, detailsDone: true, documentsDone: false })).toBe(3);
  });

  it('opens on Review & Submit once everything is done', () => {
    expect(resumeStep({ applicantDone: true, detailsDone: true, documentsDone: true })).toBe(4);
  });
});
