import type { INodeProperties } from 'n8n-workflow';

// Default client configuration
export const DEFAULT_CLIENT_CONFIG = {
  retryCount: 3,
  retryDelay: 1000,
  timeout: 30000,
  rateLimitPerSecond: 10,
};

// Advanced options property that can be added to nodes
export const advancedClientOptions: INodeProperties = {
  displayName: 'Advanced Options',
  name: 'advancedOptions',
  type: 'collection',
  default: {},
  placeholder: 'Add Option',
  options: [
    {
      displayName: 'Retry Count',
      name: 'retryCount',
      type: 'number',
      default: DEFAULT_CLIENT_CONFIG.retryCount,
      description: 'Number of times to retry failed requests',
      typeOptions: {
        minValue: 0,
        maxValue: 10,
      },
    },
    {
      displayName: 'Retry Delay (ms)',
      name: 'retryDelay',
      type: 'number',
      default: DEFAULT_CLIENT_CONFIG.retryDelay,
      description: 'Delay between retry attempts in milliseconds',
      typeOptions: {
        minValue: 100,
        maxValue: 10000,
      },
    },
    {
      displayName: 'Request Timeout (ms)',
      name: 'timeout',
      type: 'number',
      default: DEFAULT_CLIENT_CONFIG.timeout,
      description: 'Request timeout in milliseconds',
      typeOptions: {
        minValue: 1000,
        maxValue: 120000,
      },
    },
    {
      displayName: 'Rate Limit (requests/sec)',
      name: 'rateLimitPerSecond',
      type: 'number',
      default: DEFAULT_CLIENT_CONFIG.rateLimitPerSecond,
      description: 'Maximum requests per second to the RPC endpoint',
      typeOptions: {
        minValue: 1,
        maxValue: 100,
      },
    },
  ],
};