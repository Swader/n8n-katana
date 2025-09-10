let cached: Promise<typeof import('viem')> | null = null;
export function getViem() {
  return (cached ??= import('viem'));
}
