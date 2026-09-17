/**
 * The three citizen endpoints, typed from
 * `contract/citizen-endpoints.openapi.yaml` in eBPCOBackend (C-1 f7eb40e,
 * C-2 5a0f18a, D-8 18028a8).
 *
 * Every field here is pinned by that contract against RECORDED responses — real
 * bytes from the real controllers over real PostgreSQL — and a parity spec on
 * their side fails if the contract and the samples disagree in either direction.
 * So these types describe what the server sends, not what we imagine it sends.
 * Do not add a field that is not in the contract.
 */
