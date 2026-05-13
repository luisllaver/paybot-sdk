import { describe, it, expect } from 'vitest';
import {
  NETWORKS,
  USDC_CONFIG,
  getNetwork,
  getSupportedNetworks,
  EIP712_DOMAINS,
  EIP3009_TYPES,
} from '../src/networks.js';

describe('NETWORKS', () => {
  it('should include Base Sepolia (testnet)', () => {
    const net = NETWORKS['eip155:84532'];
    expect(net).toBeDefined();
    expect(net.name).toBe('Base Sepolia');
    expect(net.chainId).toBe(84532);
    expect(net.isTestnet).toBe(true);
    expect(net.usdcAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('should include Base', () => {
    const net = NETWORKS['eip155:8453'];
    expect(net).toBeDefined();
    expect(net.name).toBe('Base');
    expect(net.chainId).toBe(8453);
    expect(net.isTestnet).toBe(false);
  });

  it('should include Ethereum Mainnet', () => {
    const net = NETWORKS['eip155:1'];
    expect(net).toBeDefined();
    expect(net.name).toBe('Ethereum Mainnet');
    expect(net.chainId).toBe(1);
    expect(net.isTestnet).toBe(false);
  });

  it('should include Arbitrum One', () => {
    const net = NETWORKS['eip155:42161'];
    expect(net).toBeDefined();
    expect(net.name).toBe('Arbitrum One');
    expect(net.chainId).toBe(42161);
    expect(net.isTestnet).toBe(false);
  });

  it('should include Optimism', () => {
    const net = NETWORKS['eip155:10'];
    expect(net).toBeDefined();
    expect(net.name).toBe('Optimism');
    expect(net.chainId).toBe(10);
    expect(net.isTestnet).toBe(false);
  });

  it('should include Polygon', () => {
    const net = NETWORKS['eip155:137'];
    expect(net).toBeDefined();
    expect(net.name).toBe('Polygon');
    expect(net.chainId).toBe(137);
    expect(net.isTestnet).toBe(false);
  });
});

describe('getNetwork', () => {
  it('should return config for known CAIP-2 ID', () => {
    const net = getNetwork('eip155:84532');
    expect(net).toBeDefined();
    expect(net!.caip2).toBe('eip155:84532');
  });

  it('should return undefined for unknown CAIP-2 ID', () => {
    expect(getNetwork('eip155:99999')).toBeUndefined();
  });
});

describe('getSupportedNetworks', () => {
  it('should return array of CAIP-2 IDs', () => {
    const networks = getSupportedNetworks();
    expect(networks).toContain('eip155:1');
    expect(networks).toContain('eip155:8453');
    expect(networks).toContain('eip155:42161');
    expect(networks).toContain('eip155:10');
    expect(networks).toContain('eip155:137');
    expect(networks).toContain('eip155:84532');
    expect(networks).toContain('eip155:11155111');
    expect(networks).toContain('eip155:421614');
    expect(networks.length).toBe(8);
  });
});

describe('USDC_CONFIG', () => {
  it('should have 6 decimals', () => {
    expect(USDC_CONFIG.decimals).toBe(6);
  });

  it('should have correct symbol', () => {
    expect(USDC_CONFIG.symbol).toBe('USDC');
  });
});

describe('EIP712_DOMAINS', () => {
  it('should have domain for Base Sepolia', () => {
    const domain = EIP712_DOMAINS['eip155:84532'];
    expect(domain).toBeDefined();
    expect(domain.chainId).toBe(84532);
    expect(domain.name).toBe('USDC');
    expect(domain.verifyingContract).toMatch(/^0x/);
  });

  it('should have domain for Base', () => {
    const domain = EIP712_DOMAINS['eip155:8453'];
    expect(domain).toBeDefined();
    expect(domain.chainId).toBe(8453);
  });

  it('should have domain for Ethereum Mainnet', () => {
    const domain = EIP712_DOMAINS['eip155:1'];
    expect(domain).toBeDefined();
    expect(domain.chainId).toBe(1);
    expect(domain.name).toBe('USD Coin');
  });

  it('should have domains for all mainnet chains', () => {
    for (const caip2 of ['eip155:1', 'eip155:8453', 'eip155:42161', 'eip155:10', 'eip155:137']) {
      expect(EIP712_DOMAINS[caip2]).toBeDefined();
      expect(EIP712_DOMAINS[caip2].verifyingContract).toBe(NETWORKS[caip2].usdcAddress);
    }
  });

  it('should use USDC address as verifyingContract', () => {
    const domain = EIP712_DOMAINS['eip155:84532'];
    expect(domain.verifyingContract).toBe(NETWORKS['eip155:84532'].usdcAddress);
  });
});

describe('EIP3009_TYPES', () => {
  it('should define TransferWithAuthorization fields', () => {
    const fields = EIP3009_TYPES.TransferWithAuthorization;
    expect(fields).toHaveLength(6);
    const names = fields.map((f) => f.name);
    expect(names).toEqual(['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce']);
  });
});
