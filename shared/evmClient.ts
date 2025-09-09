import { createPublicClient, http } from 'viem';

export type RpcHeaders = Record<string, string>;

export function makePublicClient(rpcUrl: string, headers?: RpcHeaders) {
  const transport = http(rpcUrl, {
    fetchOptions: headers ? { headers } : undefined,
  });
  // No chain object needed for read-only calls
  return createPublicClient({ transport });
}