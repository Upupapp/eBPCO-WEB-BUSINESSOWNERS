/**
 * Type surface for the form-label gate, so its own tests can import it.
 * The gate is plain ESM (it runs under bare node in the verify chain, with no
 * build step); this declares only what the spec needs.
 */
export function checkSource(file: string, rawSrc: string): string[];
