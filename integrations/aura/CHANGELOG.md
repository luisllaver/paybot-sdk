# Changelog - AURA trust-check adapter

## 0.1.0
- `beforeSettle(did)` / `requireTrust(did)` gate; `auraVerdict(did)` returns a typed verdict.
- `reachable` flag: `failOpen` excuses only a transport failure, never a reachable `unknown`.
- Zero dependencies (global fetch); fail-closed by default; off until called.
- 19 offline vitest tests via a `fetchImpl` injection seam; README + THREAT_MODEL included.
- Reproduces the canonical `action_ref` (JCS RFC 8785 + SHA-256) used across the x402 receipt ecosystem.
