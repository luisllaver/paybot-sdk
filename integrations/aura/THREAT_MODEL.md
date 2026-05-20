# Threat model — AURA trust-check adapter

A short, honest boundary statement. The verdict is **one backward-looking
signal**, not a security guarantee. Read this before treating `trusted` as a
green light for an irreversible settlement.

## What the verdict proves

- The DID has (or lacks) an on-chain interaction history on AURA, summarized
  into a composite score and per-dimension breakdown.
- It is **backward-looking**: a statement about past recorded behavior, not a
  prediction or an authorization for the *current* payment.

## What it explicitly does NOT prove

- **Not payment-safety.** A `trusted` agent can still be the wrong recipient or
  request a bad amount. Keep this separate from PayBot's own checks
  (`TRUST_VIOLATION`, limits) so the settlement decision stays auditable.
- **Not execution quality.** It says nothing about whether *this* settle succeeds.
- **Not identity proof of the live caller.** It checks a DID's reputation, not
  that the entity you're paying controls that DID (see "Spoofed DID").

## Failure modes a caller must account for

| # | Threat | Mitigation in this adapter | Residual risk owned by caller |
|---|---|---|---|
| 1 | **Endpoint unreachable / timeout** | Resolves to `unknown` (never rejects). Gate is fail-closed by default; `AbortController` enforces `timeoutMs`. | Choose `failOpen` deliberately; pick a sane `timeoutMs`. |
| 2 | **Spoofed DID** — recipient claims a DID it doesn't control | Out of scope: adapter checks reputation, not control of the key. | Bind the DID to the `payTo` address / verify control before trusting. |
| 3 | **Stale verdict** — score lags very recent bad behavior | Each call is live (no caching here). | If you cache, bound the TTL; don't reuse a verdict across sessions. |
| 4 | **Endpoint MITM / response tampering** | HTTPS to a pinned host (`agent.auraopenprotocol.org`). Verdict strings validated against a fixed allow-list; unknown values collapse to `unknown`. | Don't point `baseUrl` at an untrusted mirror. |
| 5 | **Score gaming / Sybil** — cheap DIDs farming a `trusted` score | Inherited from AURA's on-chain cost + dispute dimension; not solvable in the adapter. | Weight `dimensions` (e.g. require non-trivial history) for high-value settlements rather than trusting the aggregate alone. |
| 6 | **Over-trust** — using the verdict as sole gate for an irreversible payment | `new`/`unknown` rejected by default; `dimensions` exposed. | Combine with PayBot limits + escrow + manual review for high-value flows. |

## Data handled

- **Sent:** only the counterparty DID, as a query parameter to `/check`. No
  PII, no payment payload, no secrets, no keys.
- **Stored:** nothing. The adapter is stateless.
- **Received:** the public `/check` JSON body. Surfaced verbatim on `.raw`.

## Trust boundary summary

```
PayBot host --(DID only, HTTPS GET)--> AURA /check --> verdict
   |                                                     |
   |  PayBot limits / TRUST_VIOLATION (separate, yours)  |
   v                                                     v
            settle decision (auditable, your code)
```

The adapter sits on the read-only reputation edge. Signing, USDC movement, and
the final settle decision stay in PayBot, where they can be audited.
