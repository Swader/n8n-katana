import type { RequestInit } from 'node-fetch';

export type RpcHeaders = Record<string, string>;

export async function makePublicClient(rpcUrl: string, headers?: RpcHeaders) {
  const { createPublicClient, http } = await import('viem');
  const transport = http(rpcUrl, {
    fetchOptions: headers ? { headers: headers } : undefined,
  });
  return createPublicClient({ transport });
}
