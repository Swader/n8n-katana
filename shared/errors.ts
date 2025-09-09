import { NodeOperationError } from 'n8n-workflow';

export function wrapAsNodeError(ctx: unknown, err: unknown, details?: object) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  throw new NodeOperationError(ctx as any, message, { description: JSON.stringify(details ?? {}) });
}