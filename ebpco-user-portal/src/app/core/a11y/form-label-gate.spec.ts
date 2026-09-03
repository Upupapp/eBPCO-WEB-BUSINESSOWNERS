import { checkSource } from '../../../../scripts/check-form-labels.mjs';

/**
 * The form-label gate, checked against itself.
 *
 * It ran for days with four defects at once, found only when the admin lane —
 * who had hit the same defect class — warned that a gate blind to Angular's
 * binding forms reports working code as broken. Measured, it did that AND
 * blessed `aria-label="••••••••"` AND went silently blind to any opening tag
 * over 200 characters. That last one is the worst: it made our own
 * `[for]`/`[id]` pair "pass" because the gate never saw the <select> at all.
 *
 * A gate nobody tests is a gate nobody can trust. The MUST-PASS half matters as
 * much as the MUST-FAIL half — a false positive on correct markup gets
 * "fixed", and the fix makes real code worse.
 */
describe('The form-label gate itself', () => {
  const ok = (html: string): string[] => checkSource('probe.html', html);

  describe('accepts correct markup', () => {
    it('a wrapping label around a select or textarea', () => {
      expect(ok('<label>Province <select id="p"><option>x</option></select></label>')).toEqual([]);
      expect(ok('<label>Scope <textarea id="s"></textarea></label>')).toEqual([]);
    });

    it("Angular's binding forms for for= and id=", () => {
      expect(ok('<label [for]="k">R</label><select [id]="k"><option>x</option></select>')).toEqual([]);
      expect(ok('<label [attr.for]="k">R</label><input [id]="k" />')).toEqual([]);
      expect(ok('<label bind-for="k">R</label><input bind-id="k" />')).toEqual([]);
    });

    it('a control whose opening tag is longer than any fixed window', () => {
      const long = 'x'.repeat(400);
      expect(ok(`<label for="z">Z</label><select id="z" class="${long}"><option>a</option></select>`)).toEqual([]);
    });

    it('an aria-label that actually names something, including an interpolated one', () => {
      expect(ok('<input aria-label="Search applications" />')).toEqual([]);
      expect(ok(`<input [attr.aria-label]="'Attach ' + d.label" />`)).toEqual([]);
      expect(ok('<input aria-label="{{ doc.label }}" />')).toEqual([]);
      expect(ok('<input aria-labelledby="doc-heading" />')).toEqual([]);
    });

    it('controls that carry their own name or are not user-facing', () => {
      expect(ok('<input type="hidden" name="csrf" />')).toEqual([]);
      expect(ok('<input type="submit" value="Send" />')).toEqual([]);
    });

    it('ignores markup that is commented out', () => {
      expect(ok('<!-- <input class="input" /> -->')).toEqual([]);
    });
  });

  describe('catches what a screen reader cannot name', () => {
    it('an aria-label made of characters that name nothing', () => {
      // Exactly the output the admin lane caught in review before committing.
      // The old gate checked presence and would have blessed it.
      expect(ok('<input aria-label="••••••••" type="password" />')).toHaveLength(1);
      expect(ok('<input aria-label="" />')).toHaveLength(1);
      expect(ok('<input aria-label="   " />')).toHaveLength(1);
    });

    it('a control with no name at all', () => {
      expect(ok('<input type="text" class="input" />')).toHaveLength(1);
      expect(ok('<select><option>x</option></select>')).toHaveLength(1);
      expect(ok('<textarea></textarea>')).toHaveLength(1);
    });

    it('the original F-20 defect: a visible label that points at nothing', () => {
      // 50 controls, 49 visible labels, zero for attributes.
      expect(ok('<label>Full Name</label><input class="input" />')).toHaveLength(1);
    });

    it('an id nothing points at', () => {
      expect(ok('<input id="orphan" />')).toHaveLength(1);
    });

    it('a for= that names a different control', () => {
      expect(ok('<label for="a">A</label><input id="b" />')).toHaveLength(1);
    });
  });
});
