/**
 * AURA trust-check adapter — opt-in, read-only counterparty reputation.
 *
 *     import { beforeSettle, AuraUntrusted } from './integrations/aura';
 *
 *     try {
 *       await beforeSettle(counterpartyDid);
 *       await client.pay({ resource, amount, payTo });
 *     } catch (e) {
 *       if (e instanceof AuraUntrusted) abort(e.message);
 *     }
 *
 * Zero dependencies (global fetch). Does not sign, hold keys, or move funds.
 * See README.md for the enable section and THREAT_MODEL.md for the boundary.
 */
export {
  auraVerdict,
  beforeSettle,
  requireTrust,
  AuraUntrusted,
  DEFAULT_BASE_URL,
  DEFAULT_ALLOW,
} from './adapter.js';

export type { AuraVerdict, Verdict, VerdictOptions, GateOptions, FetchLike } from './adapter.js';
