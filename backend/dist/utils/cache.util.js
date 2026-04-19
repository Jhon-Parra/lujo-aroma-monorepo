"use strict";
/**
 * Simple TTL-based in-memory cache.
 *
 * Design decisions:
 * - Uses a plain Map for O(1) reads/writes — no external dependencies.
 * - TTL is checked on reads (lazy eviction) and on a periodic sweep (active eviction).
 * - Entries can be invalidated by exact key or by key prefix (e.g. 'catalog:').
 * - Default TTL: 5 minutes (300_000 ms).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_KEYS = exports.appCache = void 0;
class TtlCache {
    store = new Map();
    defaultTtlMs;
    sweepInterval;
    constructor(defaultTtlMs = 5 * 60 * 1000) {
        this.defaultTtlMs = defaultTtlMs;
        // Sweep expired entries every minute to prevent unbounded memory growth
        this.sweepInterval = setInterval(() => this.sweep(), 60_000);
        // Allow the process to exit even if this timer is running
        if (this.sweepInterval.unref)
            this.sweepInterval.unref();
    }
    /** Return cached value or undefined if missing/expired. */
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.data;
    }
    /** Store a value with an optional custom TTL (ms). */
    set(key, data, ttlMs = this.defaultTtlMs) {
        this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
    }
    /** Remove a specific key. */
    invalidate(key) {
        this.store.delete(key);
    }
    /**
     * Remove all keys that start with 'prefix'.
     * Useful to bust an entire resource group (e.g. 'catalog:').
     */
    invalidateByPrefix(prefix) {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
            }
        }
    }
    /** Clear the entire cache. */
    clear() {
        this.store.clear();
    }
    /** Current entry count (expired entries may still be present until swept). */
    get size() {
        return this.store.size;
    }
    sweep() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }
}
/** Shared application-wide cache instance (5-minute default TTL). */
exports.appCache = new TtlCache(5 * 60 * 1000);
/** Cache key prefixes — kept here so they're easy to refactor. */
exports.CACHE_KEYS = {
    CATALOG_ANON: 'catalog:anon', // anonymous public catalog (no user)
    CATALOG_Q: 'catalog:q:', // search queries  (prefix + query)
    AI_REFINE: 'ai:refine:', // AI search refinements
    NEWEST: 'catalog:newest:', // newest products (prefix + limit)
    PROMOTIONS: 'promotions:active', // active promotions list
};
