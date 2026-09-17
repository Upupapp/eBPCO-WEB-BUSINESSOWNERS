import { __decorate } from "tslib";
import { Directive, ElementRef, HostListener, inject } from '@angular/core';
/**
 * The first letter of each word, uppercased — "juan dela cruz" becomes
 * "Juan Dela Cruz". Nothing else in the string is touched: a name typed as
 * "McDonald" or "DELA CRUZ" is left exactly as typed past its first letter,
 * because this is a courtesy for the common case (a citizen who typed their
 * own name in lowercase out of habit), not a claim that it knows how every
 * name is properly styled.
 *
 * `\p{L}` (Unicode letter), not `[a-z]`: this office serves names with ñ and
 * other accented letters, and a rule that only recognised the Latin
 * unaccented alphabet would silently skip exactly those.
 */
export function capitalizeName(value) {
    return value.replace(/(^|[\s-])\p{L}/gu, (match) => match.toUpperCase());
}
/**
 * Applies `capitalizeName` to a text input when the citizen leaves it (on
 * blur, not keystroke-by-keystroke) — see call sites for which fields these
 * are. Blur, specifically, because rewriting `input.value` while someone is
 * still typing fights the browser's own cursor position; there is nothing
 * to fight once the field is no longer focused.
 *
 * Applied only to genuine person-name fields (first/middle/last name,
 * professional-in-charge) — never a business name or anything else that may
 * be legitimately stylized.
 */
let CapitalizeNameDirective = class CapitalizeNameDirective {
    el = inject((ElementRef));
    onBlur() {
        const input = this.el.nativeElement;
        const capitalized = capitalizeName(input.value);
        if (capitalized === input.value)
            return;
        input.value = capitalized;
        // Not `input.dispatchEvent(new Event('change'))`: ngModel listens for
        // 'input', and dispatching that is what makes the bound property (and
        // therefore anything else reading it, like a submit handler) see the
        // corrected value rather than just the DOM display.
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
};
__decorate([
    HostListener('blur')
], CapitalizeNameDirective.prototype, "onBlur", null);
CapitalizeNameDirective = __decorate([
    Directive({
        selector: 'input[appCapitalizeName]',
        standalone: true,
    })
], CapitalizeNameDirective);
export { CapitalizeNameDirective };
