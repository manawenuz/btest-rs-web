interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries every 60 seconds
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
    // Stop the interval if the store is empty to avoid leaking timers
    if (store.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }, 60_000);
  // Allow the process to exit even if the interval is still active
  if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }
}

/**
 * Simple in-memory rate limiter.
 *
 * @param key   - A unique identifier for the rate limit bucket (e.g. IP address, user ID).
 * @param config - maxRequests allowed within windowMs milliseconds.
 * @returns { success: boolean, remaining: number }
 */
export function rateLimit(
  key: string,
  config: RateLimitConfig
): { success: boolean; remaining: number } {
  ensureCleanup();

  const now = Date.now();
  const entry = store.get(key);

  // No existing entry or window has expired -- start a fresh window
  if (!entry || now >= entry.resetAt) {
    store.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return { success: true, remaining: config.maxRequests - 1 };
  }

  // Within the current window
  if (entry.count < config.maxRequests) {
    entry.count += 1;
    return { success: true, remaining: config.maxRequests - entry.count };
  }

  // Limit exceeded
  return { success: false, remaining: 0 };
}
