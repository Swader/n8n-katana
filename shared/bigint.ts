export function normalizeBigInt(value: unknown): any {
    if (typeof value === 'bigint') return value.toString();
    if (Array.isArray(value)) return value.map(normalizeBigInt);
    if (value && typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = normalizeBigInt(v);
      }
      return out;
    }
    return value;
  }