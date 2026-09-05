/**
 * Seeded random number generator using a simple hash function.
 * This ensures deterministic randomness - same seed always produces same result.
 * Uses a variation of the xorshift algorithm seeded with a custom hash.
 */

/**
 * Simple string/number hash function
 * @param {string|number} str - Input to hash
 * @returns {number} Hash value
 */
function hashCode(str) {
    let hash = 0;
    const input = String(str);
    if (input.length === 0) return hash;
    
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

/**
 * Xorshift pseudo-random number generator
 * @param {number} seed - Seed value
 * @returns {number} Random number between 0 and 1
 */
function xorshift32(seed) {
    let x = seed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return Math.abs(x) / 0x7fffffff;
}

/**
 * Generate a seeded random number
 * @param {string|number} seed - Seed value (can be date, string, etc)
 * @param {number} max - Upper bound (exclusive)
 * @returns {number} Random integer from 0 to max-1
 */
export function seededRandom(seed, max) {
    if (max <= 0) return 0;
    const hash = hashCode(seed);
    const random = xorshift32(hash);
    return Math.floor(random * max);
}

/**
 * Generate a seeded random number within a range
 * @param {string|number} seed - Seed value
 * @param {number} min - Lower bound (inclusive)
 * @param {number} max - Upper bound (exclusive)
 * @returns {number} Random integer from min to max-1
 */
export function seededRandomRange(seed, min, max) {
    return min + seededRandom(seed, max - min);
}
