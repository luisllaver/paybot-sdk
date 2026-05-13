/**
 * Public SDK types for paybot-sdk.
 * These are the types bot developers interact with.
 */

export interface PayBotConfig {
  /** PayBot API key for authentication */
  apiKey: string;
  /** PayBot facilitator URL (default: https://api.paybotcore.com) */
  facilitatorUrl?: string;
  /** Bot identifier */
  botId: string;
  /** Operator identifier */
  operatorId?: string;
  /** Bot wallet private key for EIP-3009 signing (hex with 0x prefix) */
  walletPrivateKey?: string;
  /** Maximum number of retries on network errors or 5xx responses (default: 1) */
  maxRetries?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export interface PaymentRequest {
  /** URL of the resource to pay for */
  resource: string;
  /** Amount in USDC (human-readable, e.g., '0.05') */
  amount: string;
  /** Recipient wallet address */
  payTo: string;
  /** Token contract (defaults to USDC on Base) */
  tokenContract?: string;
  /** Network CAIP-2 ID (default: eip155:84532 Base Sepolia) */
  network?: string;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  grossAmount: string;
  netAmount: string;
  commissionAmount: string;
  commissionRate: number;
  network?: string;
  error?: string;
  /** Machine-readable error code from the server (e.g. 'TRUST_VIOLATION') */
  errorCode?: string;
  /** Additional error context from the server */
  errorDetails?: Record<string, unknown>;
}

export interface BalanceResult {
  botId: string;
  trustLevel: number;
  trustLevelName: string;
  dailySpentUsd: number;
  dailyLimitUsd: number;
  dailyRemainingUsd: number;
  hourlyTransactions: number;
  hourlyLimit: number;
}

export interface TransactionHistoryItem {
  eventId: string;
  timestamp: string;
  eventType: string;
  action: string;
  details: Record<string, unknown>;
}

export interface LimitsConfig {
  maxTransactionUsd?: number;
  maxDailySpendUsd?: number;
  maxTransactionsPerHour?: number;
  allowedRecipients?: string[];
}

export interface RegisterResult {
  success: boolean;
  botId: string;
  trustLevel: number;
}

export interface HealthResult {
  status: string;
  version: string;
  uptime: number;
  timestamp: string;
  [key: string]: unknown;
}

export type TrustLevel = 0 | 1 | 2 | 3 | 4 | 5;

// --- Auth types (onboarding) ---

export interface SignupResult {
  operatorId: string;
  apiKey: string;
  botId: string;
  message: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  operator: {
    id: string;
    email: string;
    tier: string;
    displayName?: string;
  };
}

export interface ApiKeyResult {
  id: string;
  key: string;
  keyPrefix: string;
  operatorId: string;
  label?: string;
  permissions: string;
  rateLimit: number;
  createdAt: string;
}

export interface ApiKeyListItem {
  id: string;
  keyPrefix: string;
  operatorId: string;
  label?: string;
  permissions: string;
  rateLimit: number;
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

// --- Earning / receiving types ---

export interface WalletBalanceResult {
  /** Wallet address queried */
  address: string;
  /** USDC balance in base units (6 decimals) */
  balanceRaw: string;
  /** USDC balance as human-readable string (e.g. "12.50") */
  balanceUsd: string;
  /** Network queried */
  network: string;
}

export interface InvoiceRequest {
  /** Human-readable amount in USD (e.g. "0.50") */
  amount: string;
  /** Description of what the payment is for */
  resource: string;
  /** Network CAIP-2 ID (default: eip155:84532) */
  network?: string;
  /** Invoice expiry in seconds from now (default: 3600) */
  expiresIn?: number;
}

export interface Invoice {
  /** x402 version */
  x402Version: 1;
  /** Payment requirements array */
  accepts: Array<{
    scheme: 'exact';
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
  }>;
  /** Facilitator URL for verification */
  facilitatorUrl: string;
  /** Resource being sold */
  resource: string;
  /** Invoice creation timestamp (ISO 8601) */
  createdAt: string;
  /** Invoice expiry timestamp (ISO 8601) */
  expiresAt: string;
}

export interface IncomingPayment {
  /** Transaction hash */
  txHash: string;
  /** Payer bot ID */
  fromBotId: string;
  /** Amount received in base units */
  amount: string;
  /** Amount in human-readable USD */
  amountUsd: string;
  /** Network the payment was on */
  network: string;
  /** Resource that was paid for */
  resource: string;
  /** Payment timestamp */
  timestamp: string;
}

// --- Subscription types ---

export interface SubscriptionPlan {
  /** Unique plan identifier */
  planId: string;
  /** Human-readable plan name */
  name: string;
  /** Monthly price in USDC (human-readable, e.g. "2.00") */
  price: string;
  /** Plan description */
  description: string;
  /** Features included in this plan */
  features: string[];
  /** Network CAIP-2 ID (default: eip155:8453) */
  network?: string;
  /** Whether the plan is currently available */
  active: boolean;
  /** Plan creation timestamp */
  createdAt: string;
}

export interface SubscribeRequest {
  /** Plan ID to subscribe to */
  planId: string;
  /** Subscriber bot ID (defaults to client botId) */
  botId?: string;
  /** Network CAIP-2 ID (default: eip155:8453) */
  network?: string;
  /** Payment method: auto-deduce from wallet or manual */
  autoRenew?: boolean;
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId: string;
  planId: string;
  botId: string;
  status: 'active' | 'pending' | 'cancelled' | 'expired';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextPaymentAt: string;
  amount: string;
  network?: string;
  error?: string;
  errorCode?: string;
}

export interface SubscriptionStatus {
  subscriptionId: string;
  planId: string;
  planName: string;
  status: 'active' | 'pending' | 'cancelled' | 'expired';
  amount: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextPaymentAt: string;
  cancelledAt?: string;
}

export interface CancelSubscriptionResult {
  success: boolean;
  subscriptionId: string;
  status: 'cancelled';
  cancelledAt: string;
}

// --- Agent Identity Registry types ---

export interface AgentIdentity {
  /** Agent unique identifier */
  agentId: string;
  /** Agent display name */
  name: string;
  /** Agent description */
  description: string;
  /** Agent wallet address (optional at registration) */
  walletAddress?: string;
  /** Agent capabilities */
  capabilities?: string[];
  /** Agent metadata (custom key-value pairs) */
  metadata?: Record<string, string>;
  /** Trust level */
  trustLevel: number;
  /** Whether the agent is verified */
  verified: boolean;
  /** Registration timestamp */
  registeredAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

export interface RegisterAgentRequest {
  /** Agent display name */
  name: string;
  /** Agent description */
  description: string;
  /** Agent wallet address */
  walletAddress?: string;
  /** Agent capabilities */
  capabilities?: string[];
  /** Agent metadata */
  metadata?: Record<string, string>;
}

export interface AgentLookupResult {
  found: boolean;
  agent?: AgentIdentity;
}

// --- Commission types ---

export interface CommissionSummary {
  /** Total commission earned (base units) */
  totalEarned: string;
  /** Commission pending settlement */
  pending: string;
  /** Commission forwarded to collection wallet */
  forwarded: string;
  /** Commission deferred (below minimum threshold) */
  deferred: string;
  /** Commission rate as decimal (e.g. 0.025 = 2.5%) */
  commissionRate: number;
  /** Number of commission entries */
  entryCount: number;
}

export interface CommissionLedgerFilter {
  /** Filter by status: pending, forwarded, deferred */
  status?: 'pending' | 'forwarded' | 'deferred';
  /** Start date (ISO 8601) */
  startDate?: string;
  /** End date (ISO 8601) */
  endDate?: string;
  /** Maximum entries to return (default: 50) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface CommissionEntry {
  id: string;
  /** Related payment transaction hash */
  txHash: string;
  /** Gross payment amount (base units) */
  grossAmount: string;
  /** Net amount after commission (base units) */
  netAmount: string;
  /** Commission amount (base units) */
  commissionAmount: string;
  /** Commission rate applied */
  commissionRate: number;
  /** Entry status */
  status: 'pending' | 'forwarded' | 'deferred';
  /** When this entry was created */
  createdAt: string;
  /** When commission was forwarded (if applicable) */
  forwardedAt?: string;
}
