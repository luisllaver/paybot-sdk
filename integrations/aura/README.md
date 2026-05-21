# AURA trust-check adapter (TypeScript)

Opt-in, **read-only** counterparty reputation for PayBot. One HTTPS GET
answers *"can I trust this agent before I settle a payment to it?"* — a
natural `beforeSettle` gate in front of `client.pay()`.

- **Zero dependencies** — global `fetch` (Node 18+), no new packages.
- **Read-only** — the only network call is `GET /check?did=...`. No auth, no key.
- **No coupling** — does not sign, hold keys, move USDC, or touch the wallet.
  PayBot's `pay()` flow is untouched; this sits *in front* of it.
- **Off by default** — nothing runs until you call it.

## Enable (opt-in)

Gate the settlement at the call site. No global hooks, no monkey-patching:

```ts
import { PayBotClient, type PaymentRequest } from 'paybot-sdk';
import { beforeSettle, AuraUntrusted } from './integrations/aura';

const client = new PayBotClient(config);   // your existing PayBot config

async function payChecked(counterpartyDid: string, req: PaymentRequest) {
  try {
    await beforeSettle(counterpartyDid);     // rejects high_risk + unknown
  } catch (e) {
    if (e instanceof AuraUntrusted) {
      console.warn('blocked:', e.message);   // your policy decides
      return;
    }
    throw e;
  }
  return client.pay(req);                     // existing flow, unchanged
}
```

`payTo` in a `PaymentRequest` is a wallet address; the AURA DID is the
counterparty's portable identity, supplied by your own mapping. The gate keys
on that DID — it composes cleanly with PayBot's existing `TRUST_VIOLATION`
error model as a *pre-flight* reputation axis.

Prefer to read the verdict instead of throwing?

```ts
import { auraVerdict } from './integrations/aura';

const v = await auraVerdict(counterpartyDid);
console.log(v.verdict);  // trusted | caution | high_risk | new | unknown
console.log(v.reason, v.score, v.ok);

// v.dimensions tells you *which* axis is weak, not just the aggregate:
if ((v.dimensions?.financial_integrity ?? 1) < 0.4) requireManualReview(); // placeholder for your own policy
```

> `v.ok` reflects the *verdict class* (true for `trusted`/`caution`), not the
> outcome of `beforeSettle` — the gate's default `allow` also lets `new`
> through. Use the gate's return/throw for the decision, `v.ok` for display.

## Verdicts

| verdict | meaning | `ok` |
|---|---|---|
| `trusted` | strong on-chain track record (composite ≥ 0.70) | ✅ |
| `caution` | mixed history (0.40–0.70) | ✅ |
| `high_risk` | poor track record (< 0.40) | ❌ |
| `new` | registered identity, no interactions yet | ❌ |
| `unknown` | no track record — or AURA was unreachable | ❌ |

## Policy knobs

```ts
await beforeSettle(did, { allow: ['trusted', 'caution'] });  // reject new too
await beforeSettle(did, { failOpen: true });                 // unreachable => pass
await beforeSettle(did, { baseUrl: 'https://my-mirror', timeoutMs: 5000 });
```

`requireTrust` is an alias of `beforeSettle` for non-payment call sites.

## Failure behavior

`auraVerdict()` **never rejects on a network error** — it resolves to an
`unknown` verdict with the reason set. The gate then decides:

- **default (`failOpen: false`)** — `unknown` rejected → unreachable AURA
  blocks the settlement. *Fail-closed.*
- **`failOpen: true`** — `unknown` from an unreachable endpoint passes, so AURA
  can never take your payment flow down. *Fail-open.*

The signal is **purely additive**: remove the adapter or take AURA down, and
PayBot behaves exactly as before.

## Tests

Offline — every call replays a recorded `/check` body via the `fetchImpl`
injection seam:

```bash
npx vitest run --config integrations/aura/vitest.config.ts
```

17 tests: all five verdict classes, the gate's allow-list + `failOpen`, the
unreachable path, and input validation.

## Boundary & threats

See [THREAT_MODEL.md](./THREAT_MODEL.md) — what the verdict does and does not
prove, and the failure modes a verifier should account for.

## What's behind the verdict

[AURA Open Protocol](https://auraopenprotocol.org) — W3C DID identity plus 8
on-chain reputation dimensions on Base L2. Docs: https://dev.auraopenprotocol.org
