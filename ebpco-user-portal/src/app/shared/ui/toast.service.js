import { __decorate } from "tslib";
import { Injectable, signal } from '@angular/core';
let seq = 0;
/**
 * How many toasts may be on screen at once.
 *
 * There was no cap. Each dismissed itself after 3.5s, but nothing stopped them
 * accumulating in the meantime: fourteen rapid actions left **ten stacked**,
 * covering the right of a 1440px screen — and on a 390px phone that is the whole
 * screen, sitting above the content the citizen is trying to read.
 *
 * Four is enough to show a burst is happening without becoming the page.
 */
const MAX_VISIBLE = 4;
let ToastService = class ToastService {
    toasts = signal([]);
    show(message, kind = 'info') {
        const id = ++seq;
        this.toasts.update((list) => {
            // Repeats coalesce rather than stack. Clicking the same action twice
            // should say the same thing once, not twice.
            const withoutRepeat = list.filter((t) => !(t.message === message && t.kind === kind));
            // Oldest fall off the top; the newest is always the one the citizen sees.
            return [...withoutRepeat, { id, message, kind }].slice(-MAX_VISIBLE);
        });
        setTimeout(() => this.dismiss(id), 3500);
    }
    success(message) {
        this.show(message, 'success');
    }
    error(message) {
        this.show(message, 'error');
    }
    dismiss(id) {
        this.toasts.update((list) => list.filter((t) => t.id !== id));
    }
};
ToastService = __decorate([
    Injectable({ providedIn: 'root' })
], ToastService);
export { ToastService };
