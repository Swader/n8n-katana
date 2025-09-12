import type { RequestInit } from 'node-fetch';

export type RpcHeaders = Record<string, string>;

export interface ClientConfig {
  rpcUrl: string;
  headers?: RpcHeaders;
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
  rateLimitPerSecond?: number;
}

// Simple rate limiter
class RateLimiter {
  private requests: number[] = [];
  private limit: number;
  
  constructor(requestsPerSecond: number) {
    this.limit = requestsPerSecond;
  }
  
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 1000;
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => time > windowStart);
    
    if (this.requests.length >= this.limit) {
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + 1000 - now;
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.requests.push(Date.now());
  }
}

// Global rate limiters per RPC URL
const rateLimiters = new Map<string, RateLimiter>();

export async function makePublicClient(rpcUrl: string, headers?: RpcHeaders, config?: Partial<ClientConfig>) {
  const { createPublicClient, http } = await import('viem');
  
  const retryCount = config?.retryCount ?? 3;
  const retryDelay = config?.retryDelay ?? 1000;
  const timeout = config?.timeout ?? 30000;
  const rateLimitPerSecond = config?.rateLimitPerSecond ?? 10;
  
  // Get or create rate limiter for this RPC URL
  let rateLimiter = rateLimiters.get(rpcUrl);
  if (!rateLimiter) {
    rateLimiter = new RateLimiter(rateLimitPerSecond);
    rateLimiters.set(rpcUrl, rateLimiter);
  }
  
  const transport = http(rpcUrl, {
    fetchOptions: {
      ...(headers ? { headers } : {}),
      signal: AbortSignal.timeout(timeout),
    },
    retryCount,
    retryDelay,
    onFetchRequest: async () => {
      // Apply rate limiting before each request
      await rateLimiter!.waitIfNeeded();
    },
  });
  
  return createPublicClient({ transport });
}

// Backward compatibility
export async function makePublicClientLegacy(rpcUrl: string, headers?: RpcHeaders) {
  return makePublicClient(rpcUrl, headers);
}