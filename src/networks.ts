/**
 * Supported blockchain network configurations for PayBot.
 * Supports USDC on Ethereum, Base, Arbitrum, Optimism, and Polygon.
 */

export interface NetworkConfig {
  readonly name: string;
  readonly chainId: number;
  readonly caip2: string;
  readonly rpcUrl: string;
  readonly usdcAddress: string;
  readonly explorerUrl: string;
  readonly isTestnet: boolean;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  // --- Mainnets ---
  'eip155:1': {
    name: 'Ethereum Mainnet',
    chainId: 1,
    caip2: 'eip155:1',
    rpcUrl: 'https://eth.llamarpc.com',
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    explorerUrl: 'https://etherscan.io',
    isTestnet: false,
  },
  'eip155:8453': {
    name: 'Base',
    chainId: 8453,
    caip2: 'eip155:8453',
    rpcUrl: 'https://mainnet.base.org',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    explorerUrl: 'https://basescan.org',
    isTestnet: false,
  },
  'eip155:42161': {
    name: 'Arbitrum One',
    chainId: 42161,
    caip2: 'eip155:42161',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    explorerUrl: 'https://arbiscan.io',
    isTestnet: false,
  },
  'eip155:10': {
    name: 'Optimism',
    chainId: 10,
    caip2: 'eip155:10',
    rpcUrl: 'https://mainnet.optimism.io',
    usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    explorerUrl: 'https://optimistic.etherscan.io',
    isTestnet: false,
  },
  'eip155:137': {
    name: 'Polygon',
    chainId: 137,
    caip2: 'eip155:137',
    rpcUrl: 'https://polygon-rpc.com',
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    explorerUrl: 'https://polygonscan.com',
    isTestnet: false,
  },
  // --- Testnets ---
  'eip155:11155111': {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    caip2: 'eip155:11155111',
    rpcUrl: 'https://rpc.sepolia.org',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    explorerUrl: 'https://sepolia.etherscan.io',
    isTestnet: true,
  },
  'eip155:84532': {
    name: 'Base Sepolia',
    chainId: 84532,
    caip2: 'eip155:84532',
    rpcUrl: 'https://sepolia.base.org',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    explorerUrl: 'https://sepolia.basescan.org',
    isTestnet: true,
  },
  'eip155:421614': {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    caip2: 'eip155:421614',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    explorerUrl: 'https://sepolia.arbiscan.io',
    isTestnet: true,
  },
} as const;

/**
 * USDC token configuration shared across networks.
 */
export const USDC_CONFIG = {
  symbol: 'USDC',
  decimals: 6,
  name: 'USD Coin',
} as const;

/**
 * Get network config by CAIP-2 identifier.
 */
export function getNetwork(caip2: string): NetworkConfig | undefined {
  return NETWORKS[caip2];
}

/**
 * Get all supported network CAIP-2 identifiers.
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(NETWORKS);
}

/**
 * EIP-712 domain separators for USDC contracts.
 * Used for EIP-3009 transferWithAuthorization signature verification.
 */
export const EIP712_DOMAINS: Record<string, { name: string; version: string; chainId: number; verifyingContract: `0x${string}` }> = {
  // Mainnets
  'eip155:1': {
    name: 'USD Coin',
    version: '2',
    chainId: 1,
    verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  'eip155:8453': {
    name: 'USDC',
    version: '2',
    chainId: 8453,
    verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  'eip155:42161': {
    name: 'USDC',
    version: '2',
    chainId: 42161,
    verifyingContract: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  'eip155:10': {
    name: 'USDC',
    version: '2',
    chainId: 10,
    verifyingContract: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  },
  'eip155:137': {
    name: 'USDC',
    version: '2',
    chainId: 137,
    verifyingContract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  },
  // Testnets
  'eip155:11155111': {
    name: 'USDC',
    version: '2',
    chainId: 11155111,
    verifyingContract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  },
  'eip155:84532': {
    name: 'USDC',
    version: '2',
    chainId: 84532,
    verifyingContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  'eip155:421614': {
    name: 'USDC',
    version: '2',
    chainId: 421614,
    verifyingContract: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  },
} as const;

/**
 * EIP-3009 TransferWithAuthorization typed data definition.
 * Used for viem's signTypedData / verifyTypedData.
 */
export const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;
