import { TestBed } from '@angular/core/testing';
import { ToastService, toastDuration } from './toast.service';

/**
 * Guards tasks 9 and 10. Toasts dismissed themselves after 3.5s but nothing
 * stopped them accumulating: fourteen rapid actions left ten on screen,
 * covering the right of a 1440px display — the whole of a 390px phone.
 */
describe('ToastService (task 9: the stack is capped)', () => {
  let toast: ToastService;
  beforeEach(() => { TestBed.configureTestingModule({}); toast = TestBed.inject(ToastService); });
  afterEach(() => TestBed.resetTestingModule());

  it('never shows more than four at once, however fast they arrive', () => {
    for (let i = 0; i < 14; i++) toast.success(`Status updated: step ${i}`);
    expect(toast.toasts().length).toBe(4);
  });

  it('keeps the NEWEST, because that is the one the citizen acted on', () => {
    for (let i = 0; i < 14; i++) toast.success(`step ${i}`);
    expect(toast.toasts().at(-1)?.message).toBe('step 13');
    expect(toast.toasts().some((t) => t.message === 'step 0')).toBe(false);
  });

  it('coalesces a repeat instead of stacking it', () => {
    toast.success('Saved to this demo.');
    toast.success('Saved to this demo.');
    toast.success('Saved to this demo.');
    expect(toast.toasts().length).toBe(1);
  });

  it('does not coalesce different kinds carrying the same words', () => {
    toast.success('Payment recorded');
    toast.error('Payment recorded');
    expect(toast.toasts().length).toBe(2);
  });
});

describe('toastDuration (a message stays long enough to read)', () => {
  it('keeps a short confirmation for 3.5s', () => {
    expect(toastDuration('Draft saved.')).toBe(3_500);
  });

  it('keeps a two-sentence guidance message for twice as long or more', () => {
    const reuse = 'You already have this file in My Documents as "fsec.pdf". '
      + 'Reuse that one — it can be attached to any application.';
    expect(toastDuration(reuse)).toBeGreaterThanOrEqual(7_000);
  });

  it('never keeps one longer than 12s', () => {
    expect(toastDuration('word '.repeat(200))).toBe(12_000);
  });
});
