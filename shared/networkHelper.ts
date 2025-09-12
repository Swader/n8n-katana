import type { IExecuteFunctions, ILoadOptionsFunctions, IDataObject } from 'n8n-workflow';
import { getPresetByName } from './networkPresets';
import { DEFAULT_CLIENT_CONFIG } from './clientConfig';

export interface NetworkConfig {
  rpcUrl: string;
  headers?: Record<string, string>;
  chainId?: number;
  explorerUrl?: string;
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
  rateLimitPerSecond?: number;
}

export async function getNetworkConfig(
  context: IExecuteFunctions | ILoadOptionsFunctions,
  itemIndex: number = 0
): Promise<NetworkConfig> {
  // Get credentials
  const credentials = await context.getCredentials('evmRpcApi', itemIndex);
  
  // Get network preset if available
  const networkPreset = context.getNodeParameter('networkPreset', itemIndex, 'Custom') as string;
  
  // If using a preset (not Custom), use preset RPC
  if (networkPreset && networkPreset !== 'Custom') {
    const preset = getPresetByName(networkPreset);
    if (preset && preset.rpcUrl) {
      // Parse headers from credentials if they exist
      const headers: Record<string, string> = {};
      if (credentials.headers) {
        const headerData = credentials.headers as any;
        if (headerData.header && Array.isArray(headerData.header)) {
          headerData.header.forEach((h: any) => {
            if (h.name && h.value) {
              headers[h.name] = h.value;
            }
          });
        }
      }
      
      return {
        rpcUrl: preset.rpcUrl,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        chainId: preset.chainId,
        explorerUrl: preset.explorerUrl,
      };
    }
  }
  
  // Otherwise use credentials RPC URL
  const rpcUrl = credentials.rpcUrl as string;
  const headers: Record<string, string> = {};
  
  if (credentials.headers) {
    const headerData = credentials.headers as any;
    if (headerData.header && Array.isArray(headerData.header)) {
      headerData.header.forEach((h: any) => {
        if (h.name && h.value) {
          headers[h.name] = h.value;
        }
      });
    }
  }
  
  // Get advanced options if available
  let advancedOptions: IDataObject = {};
  try {
    advancedOptions = context.getNodeParameter('advancedOptions', itemIndex, {}) as IDataObject;
  } catch {
    // Node might not have advanced options
  }
  
  return {
    rpcUrl,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    retryCount: (advancedOptions.retryCount as number) ?? DEFAULT_CLIENT_CONFIG.retryCount,
    retryDelay: (advancedOptions.retryDelay as number) ?? DEFAULT_CLIENT_CONFIG.retryDelay,
    timeout: (advancedOptions.timeout as number) ?? DEFAULT_CLIENT_CONFIG.timeout,
    rateLimitPerSecond: (advancedOptions.rateLimitPerSecond as number) ?? DEFAULT_CLIENT_CONFIG.rateLimitPerSecond,
  };
}