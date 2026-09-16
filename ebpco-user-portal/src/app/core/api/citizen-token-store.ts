import { Injectable, computed, signal } from '@angular/core';

/**
 * The tokens a signed-in citizen holds.
 *
 * ── Why localStorage and not sessionStorage ─────────────────────────────
 *
 * The Admin Portal's equivalent (`token-store.ts`) deliberately uses
 * sessionStorage: staff share LGU terminals, so a token that outlives the
 * tab would hand the next officer somebody else's session. A citizen signs
 * in on their own phone or laptop, where the opposite failure is the real
 * one — logging them out every time they close the tab to check a permit
 * status trains them to stop bothering. localStorage survives that close,
 * by design (confirmed as the wanted behaviour, not inherited from the
 * Admin Portal's different threat model).
 *
 * Still readable by any script on the page — the honest mitigation is a
 * short access-token lifetime, enforced server-side, not a claim that this
 * is secure storage.
 */

const ACCESS = 'ebpco.citizen.access';
const REFRESH = 'ebpco.citizen.refresh';

@Injectable({ providedIn: 'root' })
export class CitizenTokenStore {
  private readonly _access = signal<string | null>(read(ACCESS));
  private readonly _refresh = signal<string | null>(read(REFRESH));

  readonly access = this._access.asReadonly();
  readonly hasSession = computed(() => this._access() !== null);

  set(tokens: { accessToken: string; refreshToken?: string | null }): void {
    this._access.set(tokens.accessToken);
    write(ACCESS, tokens.accessToken);
    if (tokens.refreshToken !== undefined && tokens.refreshToken !== null) {
      this._refresh.set(tokens.refreshToken);
      write(REFRESH, tokens.refreshToken);
    }
  }

  refreshToken(): string | null {
    return this._refresh();
  }

  clear(): void {
    this._access.set(null);
    this._refresh.set(null);
    write(ACCESS, null);
    write(REFRESH, null);
  }
}

/**
 * Storage can throw, and does: a browser set to block site data raises on
 * access rather than returning null, and so does a page opened from
 * `file://`. A portal that cannot read a token should ask the citizen to
 * sign in, not fail to start.
 */
function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    // Nothing to do. The signal above is the live copy; persistence is a
    // convenience across a reload, not the source of truth.
  }
}
