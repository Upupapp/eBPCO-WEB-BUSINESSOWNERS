import { __decorate } from "tslib";
import { Component, computed, input } from '@angular/core';
import { MUNICIPAL_ENGINEER, MUNICIPAL_HALL_ADDRESS } from '../../core/domain/lgu-contact';
/**
 * The permit number, and whether it can be collected.
 *
 * The backend's note on why this endpoint exists: *"Before this, a citizen who
 * filed, paid and was approved had no way to learn their permit number."* This
 * portal was the same — `permitReleaseStatus` has existed in the model, with
 * the same three values the contract uses, and was **rendered nowhere**.
 *
 * FOUR STATES, and `null` is one of them. The contract is explicit that
 * `release` is *"ALWAYS PRESENT, and null until an officer has prepared the
 * release. Null is a fact to render — not an absent key."* So null is not
 * "no data": it means nobody has arranged collection yet, which is a different
 * fact from an officer having looked and said Not Ready.
 *
 * None of the four may read as collectable except 'Ready for Release'.
 */
let PermitReleaseComponent = class PermitReleaseComponent {
    permitNumber = input(null);
    issuedDate = input(null);
    /** The contract's `release`: null is a state, not a missing value. */
    release = input(null);
    engineer = MUNICIPAL_ENGINEER;
    hallAddress = MUNICIPAL_HALL_ADDRESS;
    headline = computed(() => {
        const r = this.release();
        if (!r)
            return 'Not yet ready to collect';
        switch (r.status) {
            case 'Ready for Release': return 'Ready to collect';
            case 'Released': return 'Collected';
            default: return 'Not yet ready to collect';
        }
    });
    detail = computed(() => {
        const r = this.release();
        // null and 'Not Ready' both mean "not yet", but they are different facts:
        // null is nobody has arranged it, 'Not Ready' is an officer saying so.
        // Neither may read as collectable.
        if (!r)
            return 'The Municipality has not arranged collection for this permit yet.';
        switch (r.status) {
            case 'Ready for Release':
                return r.method === 'Authorized Representative'
                    ? 'An authorised representative may collect this on your behalf.'
                    : 'Collect this in person.';
            case 'Released':
                return r.releasedAt
                    ? `Released on ${new Date(r.releasedAt).toLocaleDateString()}.`
                    : 'This permit has been released.';
            default:
                return 'The office has not finished preparing this permit for collection.';
        }
    });
    toneClass = computed(() => this.release()?.status === 'Ready for Release' ? 'release-ready' : 'release-waiting');
};
PermitReleaseComponent = __decorate([
    Component({
        selector: 'app-permit-release',
        template: `
    <div class="card">
      <div class="card-title">Your permit</div>

      @if (permitNumber()) {
        <div class="permit-number">{{ permitNumber() }}</div>
        @if (issuedDate()) { <div class="small muted">Issued {{ issuedDate() }}</div> }
      } @else {
        <p class="muted small">No permit has been issued for this application yet.</p>
      }

      <div class="release-state" [class]="toneClass()">
        <strong>{{ headline() }}</strong>
        <p class="small" style="margin:4px 0 0;">{{ detail() }}</p>
      </div>

      @if (release()?.status === 'Ready for Release') {
        <p class="small muted" style="margin-top:10px;">
          Collect from the {{ engineer.name }}, {{ hallAddress }}.
          Bring a valid ID{{ release()?.method === 'Authorized Representative' ? ' and a letter of authorisation' : '' }}.
        </p>
      }
    </div>
  `,
    })
], PermitReleaseComponent);
export { PermitReleaseComponent };
