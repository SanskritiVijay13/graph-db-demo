// A short-TTL in-memory cache, deliberately scoped to ONE kind of read: raw
// edge lists (who follows/is followed by a given user). NOT for derived,
// aggregated values like a mutual-connection count or a ranked result list -
// those depend on a much larger, harder-to-invalidate set of writes (anyone
// in your network changing their own edges), so they stay live. A direct
// edge list only changes when that exact user follows/unfollows someone,
// which in this app only happens at two known call sites (syncNewContacts,
// resetSocialGraph) - both invalidate explicitly below, so the TTL is a
// backstop for anything else, not the primary correctness mechanism.
//
// In-memory and per-process: fine for a single dev server. A multi-instance
// deployment would swap this for Redis/Memcached, but the TTL+explicit-
// invalidation strategy is identical either way.
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 15_000;
const store = new Map<string, CacheEntry<unknown>>();

export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<{ value: T; hit: boolean }> {
  const now = Date.now();
  const entry = store.get(key);
  if (entry && entry.expiresAt > now) {
    return { value: entry.value as T, hit: true };
  }
  const value = await fn();
  store.set(key, { value, expiresAt: now + ttlMs });
  return { value, hit: false };
}

export function invalidateCached(key: string): void {
  store.delete(key);
}

export function clearCache(): void {
  store.clear();
}
