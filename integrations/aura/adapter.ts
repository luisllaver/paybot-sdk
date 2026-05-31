/**
 * AURA trust-check adapter — a zero-dependency, read-only reputation lookup.
 *
 * Drop this folder into any agent/payment project to gate a settlement behind
 * a backward-looking trust verdict for the *counterparty* agent. It does NOT
 * sign, hold keys, move funds, or touch your wallet. It makes one HTTPS GET
 * and returns a verdict.
 *
 * Design boundary (intentional):
 *   - read-only:   the only network call is GET /check?did=...
 *   - no auth:     /check is a public endpoint; no API key, no secret
 *   - no coupling: uses global fetch (Node 18+ / ESM). No third-party imports.
 *   - fail-closed: on network failure the verdict is `unknown`, and the default
 *                  gate (beforeSettle) rejects `unknown` — an unreachable AURA
 *                  never silently waves a counterparty through. Set
 *                  `failOpen: true` to invert that.
 */

export const DEFAULT_BASE_URL = 'https://agent.auraopenprotocol.org';
export const DEFAULT_TIMEOUT_MS = 8000;

/** Verdicts safe to proceed with by default — rejects high_risk + unknown. */
export const DEFAULT_ALLOW = ['trusted', 'caution', 'new'] as const;

export type Verdict = 'trusted' | 'caution' | 'high_risk' | 'new' | 'unknown';
const VERDICTS: readonly Verdict[] = ['trusted', 'caution', 'high_risk', 'new', 'unknown'];

export interface AuraVerdict {
  /** the DID that was checked */
  did: string;
  /** trusted | caution | high_risk | new | unknown */
  verdict: Verdict;
  /** human-readable explanation */
  reason: string;
  /** composite 0..1, or null when there is no history */
  score: number | null;
  /** True for verdicts safe to proceed with (trusted / caution) */
  ok: boolean;
  /** True once the agent has on-chain interactions */
  hasHistory: boolean;
  /** per-dimension breakdown (which axis is weak), or null */
  dimensions: Record<string, number> | null;
  /**
   * False only when AURA could not be reached (network/parse failure) and the
   * verdict is a synthetic `unknown`. A reachable AURA that genuinely returns
   * `unknown` has `reachable: true`. `failOpen` keys on this, not on the
   * verdict alone, so it can't wave through explicitly-unverified counterparties.
   */
  reachable: boolean;
  /** the untouched JSON body */
  raw: Record<string, unknown>;
}

/** Thrown by beforeSettle() when a counterparty fails the trust gate. */
export class AuraUntrusted extends Error {
  readonly verdict: AuraVerdict;
  constructor(verdict: AuraVerdict) {
    super(`trust gate rejected ${verdict.did}: ${verdict.verdict} — ${verdict.reason}`);
    this.name = 'AuraUntrusted';
    this.verdict = verdict;
  }
}

/** Injection seam: a fetch-compatible function. Defaults to global fetch. */
export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export interface VerdictOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /** Override for tests; production callers ignore it. */
  fetchImpl?: FetchLike;
}

export interface GateOptions extends VerdictOptions {
  allow?: readonly string[];
  /** Treat an unreachable AURA as a pass. Off by default. */
  failOpen?: boolean;
}

function toVerdict(did: string, body: Record<string, unknown>): AuraVerdict {
  let verdict = String(body.verdict ?? 'unknown') as Verdict;
  if (!VERDICTS.includes(verdict)) verdict = 'unknown';
  return {
    did: typeof body.did === 'string' ? body.did : did,
    verdict,
    reason: String(body.reason ?? ''),
    score: typeof body.score === 'number' ? body.score : null,
    ok: verdict === 'trusted' || verdict === 'caution',
    hasHistory: Boolean(body.has_history),
    dimensions: (body.dimensions as Record<string, number> | null) ?? null,
    reachable: true,
    raw: body,
  };
}

function unreachable(did: string, reason: string): AuraVerdict {
  return { did, verdict: 'unknown', reason, score: null, ok: false, hasHistory: false, dimensions: null, reachable: false, raw: {} };
}

/**
 * Look up the trust verdict for a counterparty DID. Never rejects on a
 * network/parse failure — resolves to an `unknown` verdict instead, leaving
 * the proceed/abort decision to the caller's policy (see beforeSettle).
 *
 *     const v = await auraVerdict('did:aura:z6Mk...');
 *     console.log(v.verdict, v.reason, v.score);
 */
export async function auraVerdict(did: string, opts: VerdictOptions = {}): Promise<AuraVerdict> {
  if (!did || !did.startsWith('did:')) {
    throw new Error(`invalid DID: ${JSON.stringify(did)} (must start with 'did:')`);
  }
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/check?did=${encodeURIComponent(did)}`;
  const doFetch = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const resp = await doFetch(url, { signal: controller.signal });
    if (!resp.ok) return unreachable(did, `AURA returned HTTP ${resp.status}`);
    const body = (await resp.json()) as Record<string, unknown>;
    if (typeof body !== 'object' || body === null) {
      return unreachable(did, 'AURA returned an unexpected shape');
    }
    return toVerdict(did, body);
  } catch (e) {
    return unreachable(did, `AURA unreachable: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gate a settlement behind a trust check. Resolves with the verdict on pass,
 * throws AuraUntrusted on fail.
 *
 *     try {
 *       await beforeSettle(counterpartyDid);   // rejects high_risk + unknown
 *       await client.pay({ resource, amount, payTo });
 *     } catch (e) {
 *       if (e instanceof AuraUntrusted) abort(e.message);
 *     }
 *
 * Tighten to reject brand-new agents too:
 *     await beforeSettle(did, { allow: ['trusted', 'caution'] });
 *
 * failOpen: true makes an *unreachable* AURA pass through (transport failure
 * only — a reachable AURA that returns `unknown` is still rejected). Off by
 * default — absence of evidence is not evidence of trust.
 */
export async function beforeSettle(did: string, opts: GateOptions = {}): Promise<AuraVerdict> {
  const allow = opts.allow ?? DEFAULT_ALLOW;
  const v = await auraVerdict(did, opts);
  if (allow.includes(v.verdict)) return v;
  // failOpen only excuses a transport failure, never a reachable `unknown`.
  if (opts.failOpen && !v.reachable) return v;
  throw new AuraUntrusted(v);
}

/** Alias — same gate, name that reads better at non-payment call sites. */
export const requireTrust = beforeSettle;
