/**
 * Offline tests for the AURA trust-check adapter (vitest).
 *
 * No network: every call replays a recorded /check body via the `fetchImpl`
 * injection seam. Run with `vitest run`.
 *
 * Coverage: one assertion per verdict class, the beforeSettle gate
 * (allow-list pass/reject, custom allow, failOpen), the network-failure path
 * (fail-closed by default), and input validation.
 */

import { describe, it, expect } from 'vitest';
import {
  auraVerdict,
  beforeSettle,
  AuraUntrusted,
  type FetchLike,
} from './adapter.js';

// ── recorded /check bodies, one per verdict class ────────────────────────────
const RECORDED: Record<string, Record<string, unknown>> = {
  'did:aura:trusted-bot': {
    did: 'did:aura:trusted-bot', verdict: 'trusted',
    reason: 'strong on-chain track record (composite 0.86)',
    has_history: true, score: 0.86, interactions: 142,
    dimensions: { financial_integrity: 0.95, task_completion: 0.92 },
  },
  'did:aura:caution-bot': {
    did: 'did:aura:caution-bot', verdict: 'caution',
    reason: 'mixed history (composite 0.55)', has_history: true, score: 0.55,
  },
  'did:aura:risky-bot': {
    did: 'did:aura:risky-bot', verdict: 'high_risk',
    reason: 'poor track record (composite 0.22)', has_history: true, score: 0.22,
    dimensions: { financial_integrity: 0.12 },
  },
  'did:aura:fresh-bot': {
    did: 'did:aura:fresh-bot', verdict: 'new',
    reason: 'registered identity, no interactions yet', has_history: false, score: null,
  },
  'did:aura:ghost-bot': {
    did: 'did:aura:ghost-bot', verdict: 'unknown',
    reason: 'no track record — unverified counterparty', has_history: false, score: null,
  },
};

const okFetch: FetchLike = async (url) => {
  const did = new URL(url).searchParams.get('did') ?? '';
  const body = RECORDED[did] ?? RECORDED['did:aura:ghost-bot'];
  return { ok: true, status: 200, json: async () => body };
};

const failFetch: FetchLike = async () => {
  throw new Error('connection refused');
};

// ── verdict classes ──────────────────────────────────────────────────────────
describe('verdict classes', () => {
  const cases: [string, string, boolean][] = [
    ['did:aura:trusted-bot', 'trusted', true],
    ['did:aura:caution-bot', 'caution', true],
    ['did:aura:risky-bot', 'high_risk', false],
    ['did:aura:fresh-bot', 'new', false],
    ['did:aura:ghost-bot', 'unknown', false],
  ];
  it.each(cases)('%s -> %s', async (did, expected, ok) => {
    const v = await auraVerdict(did, { fetchImpl: okFetch });
    expect(v.verdict).toBe(expected);
    expect(v.ok).toBe(ok);
    expect(v.did).toBe(did);
    expect(v.reason.length).toBeGreaterThan(0);
  });

  it('exposes dimensions for agents with history', async () => {
    const v = await auraVerdict('did:aura:risky-bot', { fetchImpl: okFetch });
    expect(v.hasHistory).toBe(true);
    expect(v.dimensions?.financial_integrity).toBe(0.12);
  });

  it('new agent has null score', async () => {
    const v = await auraVerdict('did:aura:fresh-bot', { fetchImpl: okFetch });
    expect(v.score).toBeNull();
    expect(v.hasHistory).toBe(false);
  });
});

// ── the beforeSettle gate ─────────────────────────────────────────────────────
describe('beforeSettle gate', () => {
  it('allows trusted / caution / new by default', async () => {
    expect((await beforeSettle('did:aura:trusted-bot', { fetchImpl: okFetch })).verdict).toBe('trusted');
    expect((await beforeSettle('did:aura:caution-bot', { fetchImpl: okFetch })).verdict).toBe('caution');
    expect((await beforeSettle('did:aura:fresh-bot', { fetchImpl: okFetch })).verdict).toBe('new');
  });

  it('rejects high_risk', async () => {
    await expect(beforeSettle('did:aura:risky-bot', { fetchImpl: okFetch })).rejects.toBeInstanceOf(AuraUntrusted);
  });

  it('rejects unknown by default', async () => {
    await expect(beforeSettle('did:aura:ghost-bot', { fetchImpl: okFetch })).rejects.toBeInstanceOf(AuraUntrusted);
  });

  it('strict allow rejects new', async () => {
    await expect(
      beforeSettle('did:aura:fresh-bot', { allow: ['trusted', 'caution'], fetchImpl: okFetch }),
    ).rejects.toBeInstanceOf(AuraUntrusted);
  });
});

// ── network-failure path ───────────────────────────────────────────────────────
describe('network failure', () => {
  it('auraVerdict returns unknown, does not throw', async () => {
    const v = await auraVerdict('did:aura:trusted-bot', { fetchImpl: failFetch });
    expect(v.verdict).toBe('unknown');
    expect(v.reason.toLowerCase()).toContain('unreachable');
  });

  it('gate is fail-closed by default on unreachable', async () => {
    await expect(beforeSettle('did:aura:trusted-bot', { fetchImpl: failFetch })).rejects.toBeInstanceOf(AuraUntrusted);
  });

  it('gate passes on unreachable when failOpen', async () => {
    const v = await beforeSettle('did:aura:trusted-bot', { failOpen: true, fetchImpl: failFetch });
    expect(v.verdict).toBe('unknown');
    expect(v.reachable).toBe(false);
  });

  it('failOpen does NOT pass a reachable unknown (ghost DID)', async () => {
    // A reachable AURA that returns `unknown` is still rejected even with
    // failOpen — failOpen only excuses transport failures.
    await expect(
      beforeSettle('did:aura:ghost-bot', { failOpen: true, fetchImpl: okFetch }),
    ).rejects.toBeInstanceOf(AuraUntrusted);
  });

  it('reachable verdict is marked reachable', async () => {
    const v = await auraVerdict('did:aura:ghost-bot', { fetchImpl: okFetch });
    expect(v.reachable).toBe(true);
  });
});

// ── input validation ────────────────────────────────────────────────────────────
describe('input validation', () => {
  it.each(['', 'not-a-did', 'z6Mk-no-prefix'])('rejects bad DID %s', async (bad) => {
    await expect(auraVerdict(bad, { fetchImpl: okFetch })).rejects.toThrow();
  });
});
