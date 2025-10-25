/**
 * Utility functions for safe player ID comparison
 */

/**
 * Compare player IDs safely by normalizing to string when both are non-null.
 * Returns true only when both ids are present and equal after string coercion.
 *
 * @param a - First player ID (can be string, number, or null/undefined)
 * @param b - Second player ID (can be string, number, or null/undefined)
 * @returns true if both IDs are non-null and equal as strings, false otherwise
 *
 * @example
 * ```typescript
 * playerIdEquals('123', '123') // true
 * playerIdEquals(123, '123') // true
 * playerIdEquals('123', null) // false
 * playerIdEquals(null, null) // false
 * playerIdEquals(undefined, '123') // false
 * ```
 */
export function playerIdEquals(a: any, b: any): boolean {
  if (a == null || b == null) return false;
  try {
    return String(a) === String(b);
  } catch (e) {
    return false;
  }
}
