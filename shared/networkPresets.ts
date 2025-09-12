export interface NetworkPreset {
  name: string;
  chainId: number;
  rpcUrl: string;
  description?: string;
  explorerUrl?: string;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const NETWORK_PRESETS: NetworkPreset[] = [
  {
    name: 'Katana',
    chainId: 1261120,
    rpcUrl: 'https://rpc.katana.network/',
    description: 'Katana Network',
    explorerUrl: 'https://katanascan.io',
    nativeCurrency: {
      name: 'Katana',
      symbol: 'KATANA',
      decimals: 18,
    },
  },
  {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    description: 'Ethereum Mainnet',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    description: 'Polygon PoS',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    description: 'Arbitrum One Mainnet',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    description: 'Base Mainnet',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  {
    name: 'BSC',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    description: 'BNB Smart Chain',
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
  },
  {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: 'https://rpc.sepolia.org',
    description: 'Ethereum Sepolia Testnet',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  {
    name: 'Custom',
    chainId: 0,
    rpcUrl: '',
    description: 'Use custom RPC endpoint from credentials',
  },
];

export function getPresetByName(name: string): NetworkPreset | undefined {
  return NETWORK_PRESETS.find(preset => preset.name === name);
}

export function getPresetOptions() {
  return NETWORK_PRESETS.map(preset => ({
    name: preset.name,
    value: preset.name,
    description: preset.description,
  }));
}